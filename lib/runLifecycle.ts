import { put } from "@vercel/blob";
import { getRun, updateRun, type AgentType, type RunRow } from "@/lib/db";
import { getAgentDefinition } from "@/lib/agents";
import { getBrowserUseClient } from "@/lib/browserUseClient";
import type { BrowserUseClient, BrowserUseEvent, BrowserUseRun } from "@/lib/browserUse";

const BU_TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "stopped"]);
const OUR_TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "timed_out"]);

export function buildNamespaceTag(runId: string): string {
  return `LUZID-${runId.slice(0, 8)}`;
}

/**
 * Task prompts embed the live SAP password (see lib/agents/*.ts — the real
 * Browser Use v4 API has no secrets/credential-injection mechanism, so this
 * is the only way to get the agent logged in). Only ever persist this
 * redacted form; the real prompt should live only in memory for the single
 * call that launches the run.
 */
export function redactSecrets(text: string, secrets: string[]): string {
  let redacted = text;
  for (const secret of secrets) {
    if (!secret) continue;
    redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted;
}

/**
 * Creates the Browser Use run for an already-inserted "queued" row. This is
 * a single fast API call (unlike the old design, nothing here waits for the
 * agent to finish) so it can run synchronously inside the POST handler that
 * launches a run — no background process required, which matters once this
 * is deployed as short-lived serverless functions.
 *
 * Takes the real task prompt (with live credentials embedded — see
 * lib/agents/*.ts and NEXT.md) as a parameter rather than reading it back
 * from the DB: the row only ever stores a redacted copy, so the real
 * secret exists in memory just long enough to make this one call.
 */
export async function launchRun(
  runId: string,
  taskPrompt: string,
  agentType: AgentType
): Promise<void> {
  const client = getBrowserUseClient();
  const maxCostUsd = Number(process.env.RUN_MAX_COST_USD ?? "") || undefined;

  try {
    const {
      id: buRunId,
      sessionId,
      workspaceId,
    } = await client.createRun({
      task: taskPrompt,
      model: process.env.BROWSER_USE_MODEL,
      maxCostUsd,
      stubAgentType: agentType,
    });

    await updateRun(runId, {
      status: "running",
      browser_use_run_id: buRunId,
      browser_use_session_id: sessionId ?? undefined,
      browser_use_workspace_id: workspaceId ?? undefined,
    });
  } catch (err) {
    await updateRun(runId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Hard-cancels the Browser Use run itself (not just our own DB bookkeeping) — stops billing immediately, per the real /runs/{id}/cancel endpoint. */
export async function cancelRun(runId: string): Promise<void> {
  const row = await getRun(runId);
  if (row?.browser_use_run_id) {
    try {
      await getBrowserUseClient().cancelRun(row.browser_use_run_id);
    } catch {
      // best-effort: DB status still flips to cancelled below regardless
    }
  }
  await updateRun(runId, { status: "cancelled", summary: "Stopped by user." });
}

/**
 * Advances a run by exactly one poll tick: fetch the latest status/events
 * from Browser Use, persist progress, and finalize if it just reached a
 * terminal state. Callers (the /tick API route) call this repeatedly on a
 * client-driven interval — each call is a single short round trip, so it
 * works the same whether the process behind it lives for milliseconds
 * (serverless) or forever (local dev).
 */
export async function advanceRun(runId: string): Promise<RunRow | undefined> {
  const row = await getRun(runId);
  if (!row) return undefined;
  if (OUR_TERMINAL_STATUSES.has(row.status)) return row;
  if (!row.browser_use_run_id) return row;

  const timeoutMs = Number(process.env.RUN_TIMEOUT_SECONDS ?? 300) * 1000;
  if (Date.now() - row.created_at > timeoutMs) {
    await updateRun(runId, {
      status: "timed_out",
      error: `Run exceeded the ${timeoutMs / 1000}s timeout.`,
      summary: "Agent did not finish within the configured timeout.",
    });
    return getRun(runId);
  }

  const client = getBrowserUseClient();
  const [status, events] = await Promise.all([
    client.getStatus(row.browser_use_run_id),
    client.getEvents(row.browser_use_run_id),
  ]);

  const patch: Partial<RunRow> = { events_json: JSON.stringify(events) };
  if (!row.live_view_url) {
    const liveUrl = extractLiveViewUrl(events);
    if (liveUrl) patch.live_view_url = liveUrl;
  }

  if (!BU_TERMINAL_STATUSES.has(status)) {
    await updateRun(runId, patch);
    return getRun(runId);
  }

  const full = await client.getRun(row.browser_use_run_id);
  await finalizeRun(runId, row.agent_type, full, events, row.browser_use_workspace_id, client, patch);
  return getRun(runId);
}

async function finalizeRun(
  runId: string,
  agentType: AgentType,
  full: BrowserUseRun,
  events: BrowserUseEvent[],
  workspaceId: string | null,
  client: BrowserUseClient,
  basePatch: Partial<RunRow>
) {
  const def = getAgentDefinition(agentType);
  const evidenceJson = await saveEvidence(runId, workspaceId, client);
  const cost = costJson(full, events);
  const common: Partial<RunRow> = { ...basePatch, result_raw: full.result, evidence_json: evidenceJson, cost_json: cost };

  if (full.status !== "completed") {
    await updateRun(runId, {
      ...common,
      status: "failed",
      error: `Browser Use run ended with status "${full.status}".`,
    });
    return;
  }

  const parsed = tryParseJson(full.result);
  if (parsed === undefined) {
    await updateRun(runId, {
      ...common,
      status: "completed",
      error: "Agent finished but did not return parseable JSON.",
    });
    return;
  }

  const validation = def.resultSchema.safeParse(parsed);
  if (!validation.success) {
    await updateRun(runId, {
      ...common,
      status: "completed",
      result_json: JSON.stringify(parsed),
      error: `Result did not match expected schema: ${validation.error.message}`,
    });
    return;
  }

  const verdict = def.toVerdict(validation.data);
  await updateRun(runId, {
    ...common,
    status: "completed",
    result_json: JSON.stringify(validation.data),
    verdict: verdict.status,
    summary: verdict.summary,
  });
}

function costJson(full: BrowserUseRun, events: BrowserUseEvent[]): string | undefined {
  const stepCount = events.filter((e) => e.type === "llm.response").length || null;
  if (full.costUsd == null && stepCount == null) return undefined;
  return JSON.stringify({ usd: full.costUsd ?? undefined, steps: stepCount ?? undefined });
}

function tryParseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function extractLiveViewUrl(events: BrowserUseEvent[]): string | null {
  const ready = events.find((e) => e.type === "browser.ready");
  const url = ready?.data?.live_view_url;
  return typeof url === "string" ? url : null;
}

/**
 * Evidence lives in the run's Browser Use workspace, not in events — the
 * task prompt explicitly instructs the agent to save screenshots there
 * (see lib/agents/*.ts). Workspace file URLs are presigned S3 links that
 * expire in ~60s, so they're downloaded and re-uploaded to Vercel Blob
 * (durable, publicly servable) immediately after listing.
 */
async function saveEvidence(
  runId: string,
  workspaceId: string | null,
  client: BrowserUseClient
): Promise<string | undefined> {
  if (!workspaceId) return undefined;

  let files;
  try {
    files = await client.getWorkspaceFiles(workspaceId);
  } catch {
    return undefined;
  }
  const images = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f.path) && f.url);
  if (images.length === 0) return undefined;

  const saved: { name: string; url: string }[] = [];
  for (const file of images) {
    try {
      const res = await fetch(file.url!);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const safeName = path_basename(file.path).replace(/[^a-zA-Z0-9._-]/g, "_");
      const blob = await put(`evidence/${runId}/${safeName}`, buf, {
        access: "public",
        contentType: res.headers.get("content-type") ?? "image/png",
        addRandomSuffix: true,
      });
      saved.push({ name: safeName, url: blob.url });
    } catch {
      // best-effort: evidence upload failures shouldn't fail the run
    }
  }
  return saved.length > 0 ? JSON.stringify(saved) : undefined;
}

function path_basename(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

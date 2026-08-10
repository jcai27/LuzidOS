import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { insertRun, listRuns, type AgentType } from "@/lib/db";
import { parseSpreadsheet } from "@/lib/spreadsheet";
import { getAgentDefinition } from "@/lib/agents";
import { launchRun, buildNamespaceTag, redactSecrets } from "@/lib/runLifecycle";

export async function GET() {
  return NextResponse.json({ runs: await listRuns() });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const agentType = form.get("agentType") as AgentType | null;
  const file = form.get("file") as File | null;

  if (!agentType || !["configuration", "unit_test"].includes(agentType)) {
    return NextResponse.json(
      { error: "agentType must be 'configuration' or 'unit_test'" },
      { status: 400 }
    );
  }
  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const sapUrl = process.env.SAP_URL ?? "";
  const sapUser = process.env.SAP_USERNAME ?? "";
  const sapPass = process.env.SAP_PASSWORD ?? "";
  if (!sapUrl || !sapUser || !sapPass) {
    return NextResponse.json(
      { error: "SAP_URL / SAP_USERNAME / SAP_PASSWORD are not configured (see .env.local)" },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows;
  try {
    rows = await parseSpreadsheet(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not parse spreadsheet: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "Spreadsheet has no data rows" }, { status: 400 });
  }

  const runId = randomUUID();
  const namespaceTag = buildNamespaceTag(runId);
  const def = getAgentDefinition(agentType);
  const taskPrompt = def.buildTask(
    rows,
    { url: sapUrl, username: sapUser, password: sapPass },
    namespaceTag
  );

  const now = Date.now();
  await insertRun({
    id: runId,
    agent_type: agentType,
    status: "queued",
    created_at: now,
    updated_at: now,
    input_filename: file.name,
    input_rows_json: JSON.stringify(rows),
    namespace_tag: namespaceTag,
    browser_use_run_id: null,
    browser_use_session_id: null,
    browser_use_workspace_id: null,
    live_view_url: null,
    task_prompt: redactSecrets(taskPrompt, [sapPass]),
    result_raw: null,
    result_json: null,
    verdict: null,
    summary: null,
    error: null,
    cost_json: null,
    evidence_json: null,
    events_json: null,
    retry_of: null,
  });

  // Single fast Browser Use API call — safe to await inline, no background process needed.
  // The real (unredacted) prompt is passed directly and never persisted.
  await launchRun(runId, taskPrompt, agentType);

  return NextResponse.json({ id: runId }, { status: 201 });
}

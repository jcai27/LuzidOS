import type { AgentType } from "@/lib/db";

const API_BASE = "https://api.browser-use.com/api/v4";

export interface CreateRunParams {
  task: string;
  model?: string;
  /** Provider-native params forwarded as-is, e.g. {"reasoning":{"effort":"low"}} for OpenAI models. gpt-5.6-luna defaults to "xhigh" effort unless this overrides it — a major source of latency on multi-step tasks. */
  modelParams?: Record<string, unknown>;
  maxCostUsd?: number;
  sessionId?: string;
  /** Only consumed by the stub client; never sent to the real API. */
  stubAgentType?: AgentType;
}

export interface BrowserUseRun {
  id: string;
  sessionId: string | null;
  workspaceId: string | null;
  status: string;
  result: string | null;
  costUsd: number | null;
  stepCount: number | null;
}

export interface BrowserUseEvent {
  id?: number;
  type: string;
  data: Record<string, unknown>;
  ts?: string;
}

export interface WorkspaceFile {
  path: string;
  size: number;
  url: string | null;
}

export interface BrowserUseClient {
  createRun(
    params: CreateRunParams
  ): Promise<{ id: string; sessionId: string | null; workspaceId: string | null }>;
  getRun(runId: string): Promise<BrowserUseRun>;
  getStatus(runId: string): Promise<string>;
  getEvents(runId: string, after?: string): Promise<BrowserUseEvent[]>;
  getWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]>;
  cancelRun(runId: string): Promise<void>;
}

function apiKey(): string {
  const key = process.env.BROWSER_USE_API_KEY;
  if (!key) throw new Error("BROWSER_USE_API_KEY is not set");
  return key;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "X-Browser-Use-API-Key": apiKey(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Browser Use API ${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Real client against the live Browser Use Cloud v4 API
 * (https://api.browser-use.com/api/v4). Field names below were verified
 * against the API's actual OpenAPI schema (GET /api/v4/openapi.json) and
 * live responses, not just docs — the docs described a `secrets` /
 * `allowed_domains` / `max_steps` request shape that the real
 * RunCreateRequest schema rejects outright (422 "Extra inputs are not
 * permitted"). There is no credential-injection mechanism on this endpoint
 * at all; see lib/agents/* and NEXT.md for how that's handled instead.
 */
export const realBrowserUseClient: BrowserUseClient = {
  async createRun(params) {
    const body: Record<string, unknown> = {
      task: params.task,
      model: params.model,
      modelParams: params.modelParams,
      maxCostUsd: params.maxCostUsd,
      sessionId: params.sessionId,
    };
    const data = await request<{ id: string; sessionId?: string; workspaceId?: string }>(
      "/runs",
      { method: "POST", body: JSON.stringify(body) }
    );
    return {
      id: data.id,
      sessionId: data.sessionId ?? null,
      workspaceId: data.workspaceId ?? null,
    };
  },

  async getStatus(runId) {
    const data = await request<{ status: string }>(`/runs/${runId}/status`);
    return data.status;
  },

  async getRun(runId) {
    const data = await request<{
      id: string;
      sessionId?: string;
      workspaceId?: string;
      status: string;
      result?: string | null;
      totalCostUsd?: string | number | null;
    }>(`/runs/${runId}`);
    return {
      id: data.id,
      sessionId: data.sessionId ?? null,
      workspaceId: data.workspaceId ?? null,
      status: data.status,
      result: data.result ?? null,
      costUsd: data.totalCostUsd != null ? Number(data.totalCostUsd) : null,
      stepCount: null,
    };
  },

  async getEvents(runId, after) {
    // The endpoint paginates at 50 events (response carries hasMore/nextAfter) — a run with
    // more activity than that would otherwise silently look frozen forever, since every tick
    // would keep re-fetching only the first page. Follow the cursor until it's exhausted.
    const events: BrowserUseEvent[] = [];
    let cursor = after;
    for (;;) {
      const qs = cursor ? `?after=${encodeURIComponent(cursor)}` : "";
      const data = await request<{
        events: BrowserUseEvent[];
        hasMore?: boolean;
        nextAfter?: string;
      }>(`/runs/${runId}/events${qs}`);
      events.push(...(data.events ?? []));
      if (!data.hasMore || !data.nextAfter) break;
      cursor = data.nextAfter;
    }
    return events;
  },

  async getWorkspaceFiles(workspaceId) {
    const data = await request<{ files: WorkspaceFile[] }>(
      `/workspaces/${workspaceId}/files?includeUrls=true`
    );
    return data.files ?? [];
  },

  async cancelRun(runId) {
    await request(`/runs/${runId}/cancel`, { method: "POST" });
  },
};

import type { AgentType } from "@/lib/db";

const API_BASE = "https://api.browser-use.com/api/v4";

export interface CreateRunParams {
  task: string;
  model?: string;
  secrets?: Record<string, string>;
  allowedDomains?: string[];
  maxSteps?: number;
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
 * against live responses, not just docs (the API is camelCase; totalCostUsd
 * comes back as a string; workspace file URLs are presigned S3 links that
 * expire in 60s so must be fetched immediately after listing).
 */
export const realBrowserUseClient: BrowserUseClient = {
  async createRun(params) {
    const body: Record<string, unknown> = {
      task: params.task,
      model: params.model,
      secrets: params.secrets,
      allowed_domains: params.allowedDomains,
      max_steps: params.maxSteps,
      session_id: params.sessionId,
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
    const qs = after ? `?after=${encodeURIComponent(after)}` : "";
    const data = await request<{ events: BrowserUseEvent[] }>(`/runs/${runId}/events${qs}`);
    return data.events ?? [];
  },

  async getWorkspaceFiles(workspaceId) {
    const data = await request<{ files: WorkspaceFile[] }>(
      `/workspaces/${workspaceId}/files?includeUrls=true`
    );
    return data.files ?? [];
  },
};

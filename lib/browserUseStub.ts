import type { BrowserUseClient, BrowserUseEvent, CreateRunParams } from "@/lib/browserUse";
import type { AgentType } from "@/lib/db";

/**
 * Offline stand-in for the real Browser Use API so the whole app
 * (UI, polling, persistence, evidence handling) can be built and exercised
 * with zero API spend. Enabled via BROWSER_USE_STUB=true.
 *
 * Deliberately stateless: the run id itself encodes agentType + createdAt,
 * and every method recomputes status/events from that instead of an
 * in-memory Map. A Map broke in production — createRun and getStatus can
 * land on different serverless instances, so anything kept in module-scope
 * memory is invisible to the next call. Encoding state in the id sidesteps
 * that entirely.
 */

const RUNNING_MS = 3000;
const COMPLETE_MS = 6000;

function encodeId(agentType: AgentType, createdAt: number): string {
  return `stub-run-${agentType}-${createdAt}`;
}

function decodeId(runId: string): { agentType: AgentType; createdAt: number } {
  const match = runId.match(/^stub-run-(configuration|unit_test)-(\d+)$/);
  if (!match) throw new Error(`Unknown stub run ${runId}`);
  return { agentType: match[1] as AgentType, createdAt: Number(match[2]) };
}

function fakeResult(agentType: AgentType): string {
  if (agentType === "configuration") {
    return JSON.stringify({
      applied: true,
      setting: "Date Format",
      before: "MM/DD/YYYY",
      after: "DD.MM.YYYY",
      summary: "Date format changed to DD.MM.YYYY and verified on the profile screen (stub run).",
    });
  }
  return JSON.stringify({
    pass: true,
    orderNumber: "5000012345",
    reason: "Sales order created and SAP returned confirmation number 5000012345 (stub run).",
  });
}

export const stubBrowserUseClient: BrowserUseClient = {
  async createRun(params: CreateRunParams) {
    const agentType = params.stubAgentType ?? "unit_test";
    const id = encodeId(agentType, Date.now());
    return { id, sessionId: `stub-session-${id}`, workspaceId: `stub-workspace-${id}` };
  },

  async getStatus(runId) {
    const { createdAt } = decodeId(runId);
    const elapsed = Date.now() - createdAt;
    if (elapsed < RUNNING_MS) return "queued";
    if (elapsed < COMPLETE_MS) return "running";
    return "completed";
  },

  async getRun(runId) {
    const { agentType, createdAt } = decodeId(runId);
    const elapsed = Date.now() - createdAt;
    const status = elapsed < RUNNING_MS ? "queued" : elapsed < COMPLETE_MS ? "running" : "completed";
    return {
      id: runId,
      sessionId: `stub-session-${runId}`,
      workspaceId: `stub-workspace-${runId}`,
      status,
      result: status === "completed" ? fakeResult(agentType) : null,
      costUsd: status === "completed" ? 0.11 : null,
      stepCount: status === "completed" ? 7 : null,
    };
  },

  async getEvents(runId): Promise<BrowserUseEvent[]> {
    const { agentType, createdAt } = decodeId(runId);
    const elapsed = Date.now() - createdAt;
    const events: BrowserUseEvent[] = [
      {
        type: "run.started",
        data: {},
        ts: new Date(createdAt).toISOString(),
      },
    ];
    if (elapsed >= 500) {
      events.push({
        type: "browser.ready",
        data: { live_view_url: "about:blank#stub-live-view" },
        ts: new Date(createdAt + 500).toISOString(),
      });
    }
    if (elapsed >= 1500) {
      events.push({
        type: "agent.step",
        data: { step: 1, description: "Logging in to SAP (stub)" },
        ts: new Date(createdAt + 1500).toISOString(),
      });
    }
    if (elapsed >= RUNNING_MS) {
      events.push({
        type: "agent.step",
        data: {
          step: 2,
          description:
            agentType === "configuration"
              ? "Navigating to user profile settings (stub)"
              : "Navigating to sales order creation (stub)",
        },
        ts: new Date(createdAt + RUNNING_MS).toISOString(),
      });
    }
    if (elapsed >= COMPLETE_MS) {
      events.push({
        type: "run.completed",
        data: { result: fakeResult(agentType) },
        ts: new Date(createdAt + COMPLETE_MS).toISOString(),
      });
    }
    return events;
  },

  async getWorkspaceFiles() {
    return [];
  },
};

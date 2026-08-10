"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RunRow } from "@/lib/db";
import { AGENT_LABEL, STATUS_COLOR, STATUS_LABEL, formatTime } from "@/lib/format";

const TERMINAL = new Set(["completed", "failed", "cancelled", "timed_out"]);
const TICK_MS = 2000;

interface BUEvent {
  type: string;
  data: Record<string, unknown>;
  ts?: string;
}

interface EvidenceFile {
  name: string;
  url: string;
}

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<RunRow | null>(null);
  const [stopping, setStopping] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Client-driven polling instead of server push (SSE): each tick is one
  // short request, so liveness doesn't depend on a function staying alive
  // for the run's whole duration — works the same locally and serverless.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      const res = await fetch(`/api/runs/${id}/tick`, { method: "POST" });
      if (cancelled) return;
      if (res.ok) {
        const data: { run: RunRow } = await res.json();
        setRun(data.run);
        if (TERMINAL.has(data.run.status)) return;
      }
      timer = setTimeout(tick, TICK_MS);
    }
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (!run) {
    return <div className="max-w-4xl mx-auto px-6 py-10 text-neutral-400">Loading…</div>;
  }

  const events: BUEvent[] = run.events_json ? JSON.parse(run.events_json) : [];
  const resultJson = run.result_json ? JSON.parse(run.result_json) : null;
  const cost = run.cost_json ? JSON.parse(run.cost_json) : null;
  const rows = run.input_rows_json ? JSON.parse(run.input_rows_json) : [];
  const evidence: EvidenceFile[] = run.evidence_json ? JSON.parse(run.evidence_json) : [];
  const isTerminal = TERMINAL.has(run.status);
  const isRunning = run.status === "queued" || run.status === "running";

  async function stop() {
    setStopping(true);
    await fetch(`/api/runs/${id}/stop`, { method: "POST" });
    setStopping(false);
  }

  async function retry() {
    setRetrying(true);
    const res = await fetch(`/api/runs/${id}/retry`, { method: "POST" });
    const data = await res.json();
    setRetrying(false);
    if (res.ok) router.push(`/runs/${data.id}`);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{AGENT_LABEL[run.agent_type]}</h1>
          <p className="text-xs text-neutral-500 mt-1">
            {run.namespace_tag} · launched {formatTime(run.created_at)} · input: {run.input_filename}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[run.status]}`}>
            {STATUS_LABEL[run.status] ?? run.status}
          </span>
          {isRunning && (
            <button
              onClick={stop}
              disabled={stopping}
              className="text-xs px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50"
            >
              {stopping ? "Stopping…" : "Stop"}
            </button>
          )}
          {isTerminal && (
            <button
              onClick={retry}
              disabled={retrying}
              className="text-xs px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50"
            >
              {retrying ? "Retrying…" : "Retry"}
            </button>
          )}
        </div>
      </div>

      {run.verdict && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            run.verdict === "pass"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border border-red-500/30 text-red-300"
          }`}
        >
          <span className="font-semibold uppercase tracking-wide">{run.verdict}</span>
          {run.summary && <span className="ml-2">{run.summary}</span>}
        </div>
      )}

      {run.error && !run.verdict && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-500/10 border border-red-500/30 text-red-300">
          {run.error}
        </div>
      )}

      {run.live_view_url && isRunning && (
        <div>
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Live view</h2>
          <iframe
            src={run.live_view_url}
            className="w-full aspect-video rounded border border-neutral-800"
          />
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Steps</h2>
        <div className="border border-neutral-800 rounded-lg divide-y divide-neutral-800 text-sm max-h-96 overflow-y-auto">
          {events.length === 0 && (
            <div className="px-4 py-3 text-neutral-500">Waiting for the agent to start…</div>
          )}
          {events.filter(shouldShowEvent).map((ev, i) => (
            <div key={i} className="px-4 py-2 flex gap-3">
              <span className="text-neutral-600 font-mono text-xs w-32 shrink-0">{ev.type}</span>
              <span className="text-neutral-300 truncate" title={describeEvent(ev)}>
                {describeEvent(ev)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {resultJson && (
        <div>
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Structured result</h2>
          <pre className="border border-neutral-800 rounded-lg p-4 text-xs overflow-x-auto bg-neutral-900/50">
            {JSON.stringify(resultJson, null, 2)}
          </pre>
        </div>
      )}

      {evidence.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Evidence</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {evidence.map((f) => (
              <a key={f.url} href={f.url} target="_blank" rel="noreferrer">
                <img
                  src={f.url}
                  alt={f.name}
                  className="rounded border border-neutral-800 w-full object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6 text-sm">
        <div>
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Input</h2>
          <div className="border border-neutral-800 rounded-lg divide-y divide-neutral-800">
            {rows.map((r: Record<string, string>, i: number) => (
              <div key={i} className="px-4 py-2 text-xs text-neutral-400">
                {Object.entries(r)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("  ·  ")}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Cost</h2>
          <div className="border border-neutral-800 rounded-lg px-4 py-3 text-xs text-neutral-400">
            {cost ? (
              <>
                {cost.usd != null && <div>${cost.usd.toFixed(3)} USD</div>}
                {cost.steps != null && <div>{cost.steps} steps</div>}
              </>
            ) : (
              <div className="text-neutral-600">Not reported for this run.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const NOISY_EVENT_TYPES = new Set([
  "llm.request",
  "worker.started",
  "worker.session_released",
  "run.dispatching",
  "workspace.ready",
  "core.spawn",
]);

function shouldShowEvent(ev: BUEvent): boolean {
  return !NOISY_EVENT_TYPES.has(ev.type);
}

/** Browser Use's real event stream is a fairly technical agent trace; this maps it to plain language for the live step log. */
function describeEvent(ev: BUEvent): string {
  switch (ev.type) {
    case "run.started":
    case "run.created":
      return "Run created";
    case "run.dispatched":
      return "Browser session dispatched";
    case "browser.ready":
      return "Browser session ready — live view available";
    case "browser.attached":
      return "Browser attached";
    case "browser.released":
      return "Browser session released";
    case "run.completed":
      return "Run completed";
    case "outputs.promoted":
      return "Saving outputs";
    case "state.promoted":
      return "Saving agent state";
    case "llm.response":
      return "Agent step";
    case "core.event": {
      const part = ev.data?.part as Record<string, unknown> | undefined;
      const partType = part?.type as string | undefined;
      if (partType === "tool") {
        const state = part?.state as Record<string, unknown> | undefined;
        const title = (state?.title as string) ?? (part?.tool as string) ?? "tool";
        return `Using tool: ${title}`;
      }
      if (partType === "text") {
        const text = part?.text as string | undefined;
        return text ? `Agent output: ${text.slice(0, 140)}` : "Agent output";
      }
      if (partType === "step-start") return "Step started";
      if (partType === "step-finish") return "Step finished";
      if (partType === "reasoning") return "Agent reasoning";
      return "Agent activity";
    }
    default:
      if (typeof ev.data?.description === "string") return ev.data.description;
      return ev.type;
  }
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RunRow } from "@/lib/db";
import { AGENT_LABEL, STATUS_MESSAGE, formatMs, formatTime, friendlyError } from "@/lib/format";
import StepTimeline, { type BUEvent } from "../../_components/StepTimeline";
import ResultSummary from "../../_components/ResultSummary";
import RowTable from "../../_components/RowTable";
import { CheckIcon, CrossIcon, SpinnerIcon } from "../../_components/icons";

const TERMINAL = new Set(["completed", "failed", "cancelled", "timed_out"]);
const TICK_MS = 2000;

interface AgentStats {
  count: number;
  avgDurationMs: number | null;
  avgCostUsd: number | null;
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
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!run) return;
    fetch(`/api/agents/${run.agent_type}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
    // Only need this once we know the agent type, not on every poll tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.agent_type]);

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
    return <div className="max-w-3xl mx-auto px-6 py-10 text-slate">Loading…</div>;
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
    <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{AGENT_LABEL[run.agent_type]}</h1>
          <p className="text-xs text-slate/70 mt-1.5">
            started {formatTime(run.created_at)} · from {run.input_filename} · {run.namespace_tag}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <button
              onClick={stop}
              disabled={stopping}
              className="text-xs px-3 py-1.5 rounded-lg border border-panel-border hover:border-slate/40 hover:text-white disabled:opacity-50 transition-colors"
            >
              {stopping ? "Stopping…" : "Stop"}
            </button>
          )}
          {isTerminal && (
            <button
              onClick={retry}
              disabled={retrying}
              className="text-xs px-3 py-1.5 rounded-lg border border-panel-border hover:border-slate/40 hover:text-white disabled:opacity-50 transition-colors"
            >
              {retrying ? "Starting…" : "Try again"}
            </button>
          )}
        </div>
      </div>

      <StatusBanner run={run} now={now} stats={stats} />

      {isRunning && (
        <div>
          <SectionLabel>Watch it happen</SectionLabel>
          {run.live_view_url ? (
            <iframe
              src={run.live_view_url}
              className="w-full aspect-video rounded-2xl border border-panel-border"
            />
          ) : (
            <div className="w-full aspect-video rounded-2xl border border-panel-border bg-panel flex items-center justify-center gap-2 text-slate/50 text-sm">
              <SpinnerIcon className="w-4 h-4" />
              Setting up the browser session…
            </div>
          )}
        </div>
      )}

      <StepTimeline events={events} isRunning={isRunning} />

      {resultJson && <ResultSummary result={resultJson} />}

      {evidence.length > 0 && (
        <div>
          <SectionLabel>Screenshot proof</SectionLabel>
          <div className="grid sm:grid-cols-2 gap-3">
            {evidence.map((f) => (
              <a key={f.url} href={f.url} target="_blank" rel="noreferrer">
                <img
                  src={f.url}
                  alt={f.name}
                  className="rounded-xl border border-panel-border w-full object-cover hover:border-brand/50 transition-colors"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6 text-sm">
        <div>
          <SectionLabel>What we tested</SectionLabel>
          <RowTable rows={rows} />
        </div>
        <div>
          <SectionLabel>Time &amp; cost</SectionLabel>
          <div className="border border-panel-border rounded-2xl px-4 py-3.5 text-xs text-slate bg-panel">
            {isTerminal && (
              <div className="text-white mb-1">{formatMs(run.updated_at - run.created_at)} total</div>
            )}
            {cost ? (
              <>
                {cost.usd != null && <div className="text-brand font-mono">${cost.usd.toFixed(3)} USD</div>}
                {cost.steps != null && <div className="mt-1">{cost.steps} steps taken</div>}
              </>
            ) : (
              <div className="text-slate/50">Cost not reported for this run.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBanner({
  run,
  now,
  stats,
}: {
  run: RunRow;
  now: number;
  stats: AgentStats | null;
}) {
  if (run.verdict) {
    const pass = run.verdict === "pass";
    return (
      <div
        className={`rounded-2xl px-6 py-5 flex items-start gap-4 ${
          pass
            ? "bg-emerald-500/10 border border-emerald-500/30"
            : "bg-red-500/10 border border-red-500/30"
        }`}
      >
        {pass ? (
          <CheckIcon className="text-emerald-400 w-7 h-7 shrink-0" />
        ) : (
          <CrossIcon className="text-red-400 w-7 h-7 shrink-0" />
        )}
        <div>
          <p className={`text-lg font-semibold ${pass ? "text-emerald-300" : "text-red-300"}`}>
            {pass ? "Passed" : "Failed"}
          </p>
          {run.summary && <p className="text-sm text-white/80 mt-1 leading-relaxed">{run.summary}</p>}
        </div>
      </div>
    );
  }

  const isRunning = run.status === "queued" || run.status === "running";
  const msg = STATUS_MESSAGE[run.status] ?? { headline: run.status, detail: "" };

  return (
    <div className="rounded-2xl px-6 py-5 flex items-start gap-4 bg-panel border border-panel-border">
      {isRunning ? (
        <SpinnerIcon className="text-brand w-7 h-7 shrink-0" />
      ) : (
        <CrossIcon className="text-amber-400 w-7 h-7 shrink-0" />
      )}
      <div className="flex-1">
        <p className="text-lg font-semibold text-white">{msg.headline}</p>
        <p className="text-sm text-slate mt-1">
          {run.error && !isRunning ? friendlyError(run.error) : msg.detail}
        </p>
        {isRunning && (
          <p className="text-xs text-brand font-mono mt-2">
            running for {formatMs(now - run.created_at)}
            {stats && stats.count > 0 && stats.avgDurationMs != null && (
              <span className="text-slate/60">
                {" "}
                · usually takes ~{formatMs(stats.avgDurationMs)}
                {stats.avgCostUsd != null ? `, ~$${stats.avgCostUsd.toFixed(3)}` : ""}
              </span>
            )}
          </p>
        )}
        {run.error && (
          <details className="mt-2">
            <summary className="text-xs text-slate/50 cursor-pointer hover:text-slate">
              Technical details
            </summary>
            <p className="text-xs text-slate/50 font-mono mt-1 break-words">{run.error}</p>
          </details>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-mono text-xs uppercase tracking-widest text-slate/70 mb-2.5">
      {children}
    </h2>
  );
}

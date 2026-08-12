"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AgentType, RunRow } from "@/lib/db";
import { AGENT_LABEL, STATUS_COLOR, STATUS_LABEL, formatTime } from "@/lib/format";
import { CheckIcon, CrossIcon } from "../_components/icons";

type OutcomeFilter = "all" | "pass" | "fail" | "in_progress";
type AgentFilter = "all" | AgentType;

const IN_PROGRESS = new Set(["queued", "running"]);

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [stats, setStats] = useState<{ totalUsd: number; capUsd: number | null } | null>(null);
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

  useEffect(() => {
    const load = () => {
      fetch("/api/runs")
        .then((r) => r.json())
        .then((d) => setRuns(d.runs));
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setStats);
    };
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    if (!runs) return null;
    return runs.filter((r) => {
      if (agentFilter !== "all" && r.agent_type !== agentFilter) return false;
      if (outcomeFilter === "pass" && r.verdict !== "pass") return false;
      if (outcomeFilter === "fail" && r.verdict !== "fail") return false;
      if (outcomeFilter === "in_progress" && !IN_PROGRESS.has(r.status)) return false;
      return true;
    });
  }, [runs, agentFilter, outcomeFilter]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Past runs</h1>
          <p className="text-slate text-sm mt-2">Everything that&apos;s been run, most recent first.</p>
        </div>
        {stats && (
          <div className="text-xs text-slate/70 text-right">
            <span className="text-brand font-mono">${stats.totalUsd.toFixed(2)}</span> spent so far
            {stats.capUsd ? ` (soft cap: $${stats.capUsd})` : ""}
          </div>
        )}
      </div>

      {runs && runs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <FilterGroup
            value={agentFilter}
            onChange={setAgentFilter}
            options={[
              { value: "all", label: "All agents" },
              { value: "configuration", label: "Configuration" },
              { value: "unit_test", label: "Unit Test" },
            ]}
          />
          <span className="text-panel-border">·</span>
          <FilterGroup
            value={outcomeFilter}
            onChange={setOutcomeFilter}
            options={[
              { value: "all", label: "All outcomes" },
              { value: "pass", label: "Passed" },
              { value: "fail", label: "Failed" },
              { value: "in_progress", label: "In progress" },
            ]}
          />
        </div>
      )}

      {!runs && <p className="text-slate text-sm">Loading…</p>}
      {runs && runs.length === 0 && (
        <p className="text-slate text-sm">
          Nothing yet — start one from{" "}
          <Link href="/" className="text-brand hover:text-brand-hover underline underline-offset-2">
            New Run
          </Link>
          .
        </p>
      )}
      {filtered && runs && runs.length > 0 && filtered.length === 0 && (
        <p className="text-slate text-sm">No runs match those filters.</p>
      )}

      {filtered && filtered.length > 0 && (
        <div className="border border-panel-border rounded-2xl divide-y divide-panel-border bg-panel overflow-hidden">
          {filtered.map((run) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className="flex items-center gap-4 px-5 py-3.5 text-sm hover:bg-white/5 transition-colors"
            >
              {run.verdict ? (
                run.verdict === "pass" ? (
                  <CheckIcon className="text-emerald-400 w-5 h-5 shrink-0" />
                ) : (
                  <CrossIcon className="text-red-400 w-5 h-5 shrink-0" />
                )
              ) : (
                <span className={`text-xs px-2.5 py-1 rounded-md font-mono shrink-0 ${STATUS_COLOR[run.status]}`}>
                  {STATUS_LABEL[run.status] ?? run.status}
                </span>
              )}
              <span className="w-40 shrink-0 text-white">{AGENT_LABEL[run.agent_type]}</span>
              <span className="flex-1 text-slate truncate">
                {run.summary ?? run.error ?? run.input_filename}
              </span>
              <span className="text-xs text-slate/50 shrink-0 w-40 text-right">
                {formatTime(run.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            value === opt.value
              ? "bg-brand/15 text-brand border-brand/40"
              : "text-slate/70 border-panel-border hover:text-white hover:border-slate/40"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

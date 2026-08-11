"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RunRow } from "@/lib/db";
import { AGENT_LABEL, STATUS_COLOR, STATUS_LABEL, formatTime } from "@/lib/format";
import { CheckIcon, CrossIcon } from "../_components/icons";

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [stats, setStats] = useState<{ totalUsd: number; capUsd: number | null } | null>(null);

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

      {runs && runs.length > 0 && (
        <div className="border border-panel-border rounded-2xl divide-y divide-panel-border bg-panel overflow-hidden">
          {runs.map((run) => (
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

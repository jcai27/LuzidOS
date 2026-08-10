"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RunRow } from "@/lib/db";
import { AGENT_LABEL, STATUS_COLOR, STATUS_LABEL, formatTime } from "@/lib/format";

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
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-6">
        <h1 className="text-xl font-semibold">Run history</h1>
        {stats && (
          <div className="text-xs text-neutral-500">
            ${stats.totalUsd.toFixed(3)} spent
            {stats.capUsd ? ` of $${stats.capUsd} cap` : ""}
          </div>
        )}
      </div>

      {!runs && <p className="text-neutral-500 text-sm">Loading…</p>}
      {runs && runs.length === 0 && (
        <p className="text-neutral-500 text-sm">No runs yet. Launch one from the Launch page.</p>
      )}

      {runs && runs.length > 0 && (
        <div className="border border-neutral-800 rounded-lg divide-y divide-neutral-800">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-neutral-900/50"
            >
              <span className={`text-xs px-2 py-1 rounded shrink-0 ${STATUS_COLOR[run.status]}`}>
                {STATUS_LABEL[run.status] ?? run.status}
              </span>
              <span className="w-40 shrink-0 text-neutral-300">{AGENT_LABEL[run.agent_type]}</span>
              <span className="flex-1 text-neutral-500 truncate">
                {run.summary ?? run.error ?? run.input_filename}
              </span>
              {run.verdict && (
                <span
                  className={`text-xs font-semibold uppercase shrink-0 ${
                    run.verdict === "pass" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {run.verdict}
                </span>
              )}
              <span className="text-xs text-neutral-600 shrink-0 w-40 text-right">
                {formatTime(run.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

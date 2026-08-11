"use client";

import { useState } from "react";
import { humanizeKey } from "@/lib/format";

/** Renders an agent's structured result (whatever shape — differs per agent type) as labeled fields instead of a raw JSON blob, with the JSON still available behind a toggle for anyone who wants it. */
export default function ResultSummary({ result }: { result: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false);
  const entries = Object.entries(result).filter(([, v]) => v !== null && v !== undefined && v !== "");

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate/70">Result details</h2>
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-slate/50 hover:text-slate transition-colors"
        >
          {showRaw ? "Hide" : "View"} raw data
        </button>
      </div>
      {showRaw ? (
        <pre className="border border-panel-border rounded-2xl p-4 text-xs overflow-x-auto bg-panel text-slate">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : (
        <div className="border border-panel-border rounded-2xl divide-y divide-panel-border bg-panel">
          {entries.map(([key, value]) => (
            <div key={key} className="px-4 py-2.5 flex gap-4 text-sm">
              <span className="text-slate/60 w-40 shrink-0">{humanizeKey(key)}</span>
              <span className="text-white break-words">
                {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

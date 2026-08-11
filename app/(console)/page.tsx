"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentType } from "@/lib/db";
import type { Row } from "@/lib/spreadsheet";
import { formatMs } from "@/lib/format";

const AGENTS: {
  type: AgentType;
  title: string;
  description: string;
  sample: string;
  columns: string;
}[] = [
  {
    type: "configuration",
    title: "Configuration Agent",
    description:
      "Applies a personalization change (e.g. a home-page section's visibility) on the provided user's SAP profile and verifies it took effect.",
    sample: "/samples/configuration-sample.xlsx",
    columns: "Setting | NewValue",
  },
  {
    type: "unit_test",
    title: "Unit Test Agent",
    description:
      "Executes a single SAP test case (e.g. create a sales order) end to end and reports PASS/FAIL with screenshot evidence.",
    sample: "/samples/unit-test-sample.xlsx",
    columns: "Field | Value (plus TestCase / ExpectedResult rows)",
  },
];

export default function LaunchPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-brand mb-3">
        Agent launch
      </p>
      <h1 className="text-3xl font-semibold mb-2 tracking-tight">Launch an agent</h1>
      <p className="text-slate mb-10 text-sm">
        Upload an Excel spreadsheet and launch a Browser Use agent against the SAP sandbox.
      </p>
      <div className="grid sm:grid-cols-2 gap-6 items-start">
        {AGENTS.map((agent) => (
          <AgentCard key={agent.type} agent={agent} />
        ))}
      </div>
    </div>
  );
}

interface AgentStats {
  count: number;
  avgDurationMs: number | null;
  avgCostUsd: number | null;
}

function AgentCard({ agent }: { agent: (typeof AGENTS)[number] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);

  useEffect(() => {
    fetch(`/api/agents/${agent.type}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [agent.type]);

  async function onFileChange(f: File | null) {
    setFile(f);
    setRows(null);
    setError(null);
    if (!f) return;
    setParsing(true);
    try {
      const form = new FormData();
      form.set("file", f);
      const res = await fetch("/api/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to parse spreadsheet");
      setRows(data.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  }

  function reset() {
    setFile(null);
    setRows(null);
    setError(null);
  }

  async function launch() {
    if (!file) return;
    setLaunching(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("agentType", agent.type);
      form.set("file", file);
      const res = await fetch("/api/runs", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to launch run");
      router.push(`/runs/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLaunching(false);
    }
  }

  const hasEstimate = stats && stats.count > 0;

  return (
    <div className="border border-panel-border rounded-2xl p-6 flex flex-col gap-4 bg-panel">
      <div>
        <h2 className="font-medium text-white">{agent.title}</h2>
        <p className="text-sm text-slate mt-1.5 leading-relaxed">{agent.description}</p>
      </div>

      <div className="text-xs text-slate/70">
        Expected columns: <code className="text-slate">{agent.columns}</code>
        {" · "}
        <a href={agent.sample} className="text-brand hover:text-brand-hover underline underline-offset-2" download>
          download sample
        </a>
      </div>

      {hasEstimate && (
        <div className="text-xs text-slate/70 font-mono">
          Past runs ({stats.count}): {stats.avgDurationMs != null ? `~${formatMs(stats.avgDurationMs)}` : "—"}
          {stats.avgCostUsd != null ? `, ~$${stats.avgCostUsd.toFixed(3)}` : ""} on average
        </div>
      )}

      {!rows && (
        <label className="text-sm">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            disabled={parsing}
            className="block w-full text-xs text-slate file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-ink file:text-slate hover:file:text-white file:cursor-pointer cursor-pointer disabled:opacity-50"
          />
        </label>
      )}

      {parsing && <p className="text-xs text-slate/70">Reading spreadsheet…</p>}

      {rows && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate/70">
              Read {rows.length} row{rows.length === 1 ? "" : "s"} from {file?.name} — review before launching:
            </p>
            <button onClick={reset} className="text-xs text-brand hover:text-brand-hover shrink-0 ml-2">
              choose different file
            </button>
          </div>
          <div className="border border-panel-border rounded-lg divide-y divide-panel-border max-h-40 overflow-y-auto bg-ink/40">
            {rows.map((r, i) => (
              <div key={i} className="px-3 py-2 text-xs text-slate">
                {Object.entries(r)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("  ·  ")}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={launch}
        disabled={!rows || launching || parsing}
        className="mt-auto bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-brand-hover transition-colors"
      >
        {launching ? "Launching…" : rows ? `Confirm & launch ${agent.title}` : `Launch ${agent.title}`}
      </button>
    </div>
  );
}

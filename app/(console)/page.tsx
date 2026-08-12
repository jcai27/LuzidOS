"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentType } from "@/lib/db";
import type { Row } from "@/lib/spreadsheet";
import { formatMs } from "@/lib/format";
import RowTable from "./_components/RowTable";

const AGENTS: {
  type: AgentType;
  title: string;
  tagline: string;
  description: string;
  sample: string;
  columns: string;
}[] = [
  {
    type: "configuration",
    title: "Configuration Agent",
    tagline: "Change a setting in SAP",
    description:
      "Updates a setting on a user's SAP profile — for example, what shows on their home page — and double-checks it actually saved.",
    sample: "/samples/configuration-sample.xlsx",
    columns: "Setting, NewValue",
  },
  {
    type: "unit_test",
    title: "Unit Test Agent",
    tagline: "Run a test in SAP",
    description:
      "Carries out a test in SAP — for example, creating a sales order — from start to finish, and gives you a clear Pass or Fail with a screenshot as proof.",
    sample: "/samples/unit-test-sample.xlsx",
    columns: "Field, Value (plus TestCase and ExpectedResult)",
  },
];

export default function LaunchPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2 tracking-tight">What would you like to do?</h1>
      <p className="text-slate mb-8 text-sm">
        Pick a task below, upload your spreadsheet, and an AI agent will carry it out in SAP for you.
      </p>

      <HowItWorks />

      <div className="grid sm:grid-cols-2 gap-6 mt-8">
        {AGENTS.map((agent) => (
          <AgentCard key={agent.type} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: 1, label: "Upload your spreadsheet" },
    { n: 2, label: "Watch it work in SAP, live" },
    { n: 3, label: "Get a Pass/Fail result with proof" },
  ];
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {steps.map((s) => (
        <div key={s.n} className="border border-panel-border rounded-xl px-4 py-3 bg-panel/50 flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-brand/15 text-brand text-xs font-semibold flex items-center justify-center shrink-0">
            {s.n}
          </span>
          <span className="text-sm text-slate">{s.label}</span>
        </div>
      ))}
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
      if (!res.ok) throw new Error(data.error ?? "We couldn't read that file.");
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
      if (!res.ok) throw new Error(data.error ?? "Failed to start the run.");
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
        <p className="font-mono text-xs uppercase tracking-widest text-brand mb-1.5">{agent.tagline}</p>
        <h2 className="font-medium text-white text-lg">{agent.title}</h2>
        <p className="text-sm text-slate mt-1.5 leading-relaxed">{agent.description}</p>
      </div>

      <div className="text-xs text-slate/70">
        Your spreadsheet should have columns: <code className="text-slate">{agent.columns}</code>
        {" · "}
        <a href={agent.sample} className="text-brand hover:text-brand-hover underline underline-offset-2" download>
          download an example
        </a>
      </div>

      {hasEstimate && (
        <div className="text-xs text-slate/70">
          Based on {stats.count} past run{stats.count === 1 ? "" : "s"}, this usually takes{" "}
          {stats.avgDurationMs != null ? `~${formatMs(stats.avgDurationMs)}` : "a few minutes"}
          {stats.avgCostUsd != null ? ` and costs ~$${stats.avgCostUsd.toFixed(2)}` : ""}.
        </div>
      )}

      {!rows && (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Choose or drag a spreadsheet to upload for the ${agent.title}`}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFileChange(f);
          }}
          className={`border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            dragOver ? "border-brand bg-brand/5" : "border-panel-border hover:border-slate/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            disabled={parsing}
            className="hidden"
          />
          <p className="text-sm text-slate">
            <span className="text-brand font-medium">Choose a file</span> or drag it here
          </p>
          <p className="text-xs text-slate/50 mt-1">.xlsx spreadsheet</p>
        </div>
      )}

      {parsing && <p className="text-xs text-slate/70">Reading your spreadsheet…</p>}

      {rows && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate/70">
              Here&apos;s what we found in <span className="text-slate">{file?.name}</span> — check it looks right:
            </p>
            <button onClick={reset} className="text-xs text-brand hover:text-brand-hover shrink-0 ml-2">
              choose a different file
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            <RowTable rows={rows} />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={launch}
        disabled={!rows || launching || parsing}
        className="mt-auto bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-brand-hover transition-colors"
      >
        {launching ? "Starting…" : rows ? "Looks good — start it" : "Start"}
      </button>
    </div>
  );
}

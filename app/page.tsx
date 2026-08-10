"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentType } from "@/lib/db";

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
      "Applies a configuration change (e.g. date format) on the provided user's SAP profile and verifies it took effect.",
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
      <div className="grid sm:grid-cols-2 gap-6">
        {AGENTS.map((agent) => (
          <AgentCard key={agent.type} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: (typeof AGENTS)[number] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    if (!file) {
      setError("Choose a spreadsheet first.");
      return;
    }
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

      <label className="text-sm">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-slate file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-ink file:text-slate hover:file:text-white file:cursor-pointer cursor-pointer"
        />
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={launch}
        disabled={launching}
        className="mt-auto bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-brand-hover transition-colors"
      >
        {launching ? "Launching…" : `Launch ${agent.title}`}
      </button>
    </div>
  );
}

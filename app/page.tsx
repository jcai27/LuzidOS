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
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-1">Launch an agent</h1>
      <p className="text-neutral-400 mb-8 text-sm">
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
    <div className="border border-neutral-800 rounded-lg p-5 flex flex-col gap-4 bg-neutral-900/40">
      <div>
        <h2 className="font-medium">{agent.title}</h2>
        <p className="text-sm text-neutral-400 mt-1">{agent.description}</p>
      </div>

      <div className="text-xs text-neutral-500">
        Expected columns: <code className="text-neutral-300">{agent.columns}</code>
        {" · "}
        <a href={agent.sample} className="underline hover:text-neutral-300" download>
          download sample
        </a>
      </div>

      <label className="text-sm">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700"
        />
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={launch}
        disabled={launching}
        className="mt-auto bg-neutral-100 text-neutral-900 rounded px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-white"
      >
        {launching ? "Launching…" : `Launch ${agent.title}`}
      </button>
    </div>
  );
}

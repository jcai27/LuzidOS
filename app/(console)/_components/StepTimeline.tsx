"use client";

import { useState } from "react";
import { CheckIcon, DotIcon } from "./icons";

export interface BUEvent {
  type: string;
  data: Record<string, unknown>;
  ts?: string;
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

/** Browser Use's real event stream is a fairly technical agent trace; this maps it to plain language for people who don't need to know what a "core.event" is. */
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

export default function StepTimeline({
  events,
  isRunning,
}: {
  events: BUEvent[];
  isRunning: boolean;
}) {
  const [showTechnical, setShowTechnical] = useState(false);
  const visible = events.filter(shouldShowEvent);

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate/70">What it&apos;s doing</h2>
        {visible.length > 0 && (
          <button
            onClick={() => setShowTechnical((v) => !v)}
            className="text-xs text-slate/50 hover:text-slate transition-colors"
          >
            {showTechnical ? "Hide" : "Show"} technical log
          </button>
        )}
      </div>
      <div className="border border-panel-border rounded-2xl divide-y divide-panel-border text-sm max-h-96 overflow-y-auto bg-panel">
        {visible.length === 0 && (
          <div className="px-4 py-3 text-slate/70">Waiting for the agent to start…</div>
        )}
        {visible.map((ev, i) => {
          const isLast = i === visible.length - 1;
          return (
            <div key={i} className="px-4 py-2.5 flex items-start gap-3">
              {isLast && isRunning ? (
                <DotIcon className="text-brand w-4 h-4 mt-0.5 shrink-0 animate-pulse" />
              ) : (
                <CheckIcon className="text-emerald-400 w-4 h-4 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <span className="text-slate">{describeEvent(ev)}</span>
                {showTechnical && (
                  <span className="block text-slate/40 font-mono text-[11px] mt-0.5">{ev.type}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

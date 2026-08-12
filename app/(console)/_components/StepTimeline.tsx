"use client";

import { useState } from "react";
import { CheckIcon, DotIcon } from "./icons";

export interface BUEvent {
  type: string;
  data: Record<string, unknown>;
  ts?: string;
}

const TOOL_FALLBACK_LABEL: Record<string, string> = {
  browser_execute: "Working in the browser",
  skill: "Loading a skill",
  bash: "Running a command",
  read: "Reading a file",
  webfetch: "Fetching a page",
  todowrite: "Updating its plan",
};

/**
 * Browser Use's real event stream is a fairly deep internal agent trace
 * (core.event -> part.type -> ...), but several part types carry a genuinely
 * human-written description (e.g. tool calls have `state.input.description`
 * like "Submit SAP credentials") that the previous version of this file
 * discarded in favor of generic placeholders like "Using tool: browser_execute".
 * This pulls the real content out; returns null for events with nothing
 * informative to show (pure plumbing: step-start/finish, session teardown,
 * empty reasoning stubs, etc.) so those are dropped from the friendly view
 * entirely rather than padded out with filler rows.
 */
function describeEvent(ev: BUEvent): string | null {
  switch (ev.type) {
    case "run.started":
    case "run.created":
      return "Started the run";
    case "browser.ready":
      return "Opened a browser session";
    case "run.completed":
      return "Finished";
    case "core.event": {
      const part = ev.data?.part as Record<string, unknown> | undefined;
      const partType = part?.type as string | undefined;

      if (partType === "tool") {
        const state = part?.state as Record<string, unknown> | undefined;
        const input = state?.input as Record<string, unknown> | undefined;
        const description = (input?.description as string | undefined)?.trim();
        if (description) return description;
        const tool = part?.tool as string | undefined;
        return tool ? (TOOL_FALLBACK_LABEL[tool] ?? `Working (${tool})`) : null;
      }

      if (partType === "text") {
        const text = (part?.text as string | undefined)?.trim();
        if (!text) return null;
        return text.length > 300 ? `${text.slice(0, 300)}…` : text;
      }

      if (partType === "reasoning") {
        const raw = (part?.text as string | undefined) ?? "";
        const boldHeader = raw.match(/^\*\*(.+?)\*\*/);
        if (boldHeader) return boldHeader[1];
        const trimmed = raw.trim();
        return trimmed ? (trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed) : null;
      }

      // step-start / step-finish and anything else here is pure structural
      // bookkeeping with no content a person would find useful.
      return null;
    }
    default:
      if (typeof ev.data?.description === "string") return ev.data.description;
      return null;
  }
}

interface Step {
  event: BUEvent;
  description: string;
}

export default function StepTimeline({
  events,
  isRunning,
}: {
  events: BUEvent[];
  isRunning: boolean;
}) {
  const [showTechnical, setShowTechnical] = useState(false);
  const steps: Step[] = events
    .map((event) => ({ event, description: describeEvent(event) }))
    .filter((s): s is Step => Boolean(s.description));

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate/70">What it&apos;s doing</h2>
        {steps.length > 0 && (
          <button
            onClick={() => setShowTechnical((v) => !v)}
            className="text-xs text-slate/50 hover:text-slate transition-colors"
          >
            {showTechnical ? "Hide" : "Show"} technical log
          </button>
        )}
      </div>
      <div className="border border-panel-border rounded-2xl divide-y divide-panel-border text-sm max-h-96 overflow-y-auto bg-panel">
        {steps.length === 0 && (
          <div className="px-4 py-3 text-slate/70">Waiting for the agent to start…</div>
        )}
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className="px-4 py-2.5 flex items-start gap-3">
              {isLast && isRunning ? (
                <DotIcon className="text-brand w-4 h-4 mt-0.5 shrink-0 animate-pulse" />
              ) : (
                <CheckIcon className="text-emerald-400 w-4 h-4 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <span className="text-slate leading-relaxed">{step.description}</span>
                {showTechnical && (
                  <span className="block text-slate/40 font-mono text-[11px] mt-0.5">{step.event.type}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

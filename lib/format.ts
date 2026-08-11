export function formatTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function formatMs(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function formatDuration(startMs: number, endMs: number): string {
  return formatMs(endMs - startMs);
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  timed_out: "Timed out",
  cancelled: "Stopped",
};

export const STATUS_COLOR: Record<string, string> = {
  queued: "bg-slate/10 text-slate border border-slate/30",
  running: "bg-brand/15 text-brand border border-brand/40",
  completed: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40",
  failed: "bg-red-500/15 text-red-400 border border-red-500/40",
  timed_out: "bg-amber-500/15 text-amber-400 border border-amber-500/40",
  cancelled: "bg-white/5 text-slate border border-white/15",
};

export const AGENT_LABEL: Record<string, string> = {
  configuration: "Configuration Agent",
  unit_test: "Unit Test Agent",
};

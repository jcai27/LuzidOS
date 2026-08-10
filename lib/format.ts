export function formatTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function formatDuration(startMs: number, endMs: number): string {
  const seconds = Math.round((endMs - startMs) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
  queued: "bg-neutral-700 text-neutral-200",
  running: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
  completed: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  failed: "bg-red-500/20 text-red-300 border border-red-500/40",
  timed_out: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  cancelled: "bg-neutral-600/40 text-neutral-300 border border-neutral-500/40",
};

export const AGENT_LABEL: Record<string, string> = {
  configuration: "Configuration Agent",
  unit_test: "Unit Test Agent",
};

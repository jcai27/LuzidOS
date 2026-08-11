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

/** Plain-language headline + detail for the big status banner on the Run page. */
export const STATUS_MESSAGE: Record<string, { headline: string; detail: string }> = {
  queued: {
    headline: "Getting ready…",
    detail: "Starting up a browser session before work begins.",
  },
  running: {
    headline: "Working in SAP right now",
    detail: "You can watch it happen live below, or check back in a bit.",
  },
  completed: {
    headline: "Finished",
    detail: "See the result below.",
  },
  failed: {
    headline: "Something went wrong",
    detail: "It ran into a problem before it could finish. Details below.",
  },
  timed_out: {
    headline: "Took too long",
    detail: "This ran longer than expected, so we stopped waiting. It may still be worth a retry.",
  },
  cancelled: {
    headline: "Stopped",
    detail: "This run was stopped before it finished.",
  },
};

/** camelCase / snake_case / PascalCase -> "Title Case With Spaces", for rendering arbitrary result/row keys without hardcoding per-agent labels. */
export function humanizeKey(key: string): string {
  const withSpaces = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return withSpaces
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Translates common technical error strings into a plain sentence a non-technical user can act on. The raw text is always still available alongside this, never hidden. */
export function friendlyError(error: string): string {
  if (/timeout|timed out/i.test(error)) {
    return "This took longer than expected and was stopped automatically.";
  }
  if (/422|Extra inputs|Unprocessable/i.test(error)) {
    return "The request to the automation service was rejected. This is a configuration issue, not something wrong with your file.";
  }
  if (/schema/i.test(error)) {
    return "The agent finished, but its answer wasn't in the format we expected.";
  }
  if (/not configured/i.test(error)) {
    return "The app isn't fully set up yet — some required settings are missing.";
  }
  return "It ran into an unexpected problem.";
}

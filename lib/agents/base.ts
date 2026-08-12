import type { z } from "zod";
import type { Row } from "@/lib/spreadsheet";
import type { AgentType } from "@/lib/db";

export interface SapCreds {
  url: string;
  username: string;
  password: string;
}

export interface Verdict {
  status: "pass" | "fail";
  summary: string;
}

/**
 * Shared contract for both agent workflows. The two scenarios in the spec
 * ("apply a config change" and "run a test case") are structurally the same
 * pipeline: parse a spreadsheet -> build a task prompt -> run it in
 * Browser Use -> validate a JSON result -> derive a pass/fail verdict.
 * lib/runner.ts implements that pipeline once; each agent below only
 * supplies the three things that actually differ.
 */
export interface AgentDefinition<TResult> {
  type: AgentType;
  label: string;
  resultSchema: z.ZodType<TResult>;
  buildTask(rows: Row[], creds: SapCreds, namespaceTag: string): string;
  toVerdict(result: TResult): Verdict;
  /**
   * Overrides Browser Use's default ("xhigh") reasoning effort for this
   * agent's runs. This is a real speed/reliability trade-off, verified
   * empirically per agent — see the comment on each agent's value for what
   * was actually observed, not just theorized.
   */
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
}

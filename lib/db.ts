import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cachedSql: NeonQueryFunction<false, false> | null = null;

// Lazy: throwing at module load would crash `next build`'s page-data
// collection step even for routes that don't touch the DB. Deferring the
// check to first use means only actual queries require DATABASE_URL.
function getSql(): NeonQueryFunction<false, false> {
  if (!cachedSql) {
    const connectionString =
      process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL_UNPOOLED;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL (or POSTGRES_URL) is not set. Provision a Postgres database (e.g. Neon via the Vercel Marketplace) and set the connection string."
      );
    }
    cachedSql = neon(connectionString);
  }
  return cachedSql;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        agent_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        input_filename TEXT,
        input_rows_json TEXT,
        namespace_tag TEXT,
        browser_use_run_id TEXT,
        browser_use_session_id TEXT,
        browser_use_workspace_id TEXT,
        live_view_url TEXT,
        task_prompt TEXT,
        result_raw TEXT,
        result_json TEXT,
        verdict TEXT,
        summary TEXT,
        error TEXT,
        cost_json TEXT,
        evidence_json TEXT,
        events_json TEXT,
        retry_of TEXT
      )
    `.then(() => undefined);
  }
  return schemaReady;
}

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export type AgentType = "configuration" | "unit_test";

export interface RunRow {
  id: string;
  agent_type: AgentType;
  status: RunStatus;
  created_at: number;
  updated_at: number;
  input_filename: string | null;
  input_rows_json: string | null;
  namespace_tag: string | null;
  browser_use_run_id: string | null;
  browser_use_session_id: string | null;
  browser_use_workspace_id: string | null;
  live_view_url: string | null;
  task_prompt: string | null;
  result_raw: string | null;
  result_json: string | null;
  verdict: "pass" | "fail" | null;
  summary: string | null;
  error: string | null;
  cost_json: string | null;
  evidence_json: string | null;
  events_json: string | null;
  retry_of: string | null;
}

export async function insertRun(row: RunRow): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO runs (
      id, agent_type, status, created_at, updated_at, input_filename, input_rows_json,
      namespace_tag, browser_use_run_id, browser_use_session_id, browser_use_workspace_id,
      live_view_url, task_prompt, result_raw, result_json, verdict, summary, error,
      cost_json, evidence_json, events_json, retry_of
    ) VALUES (
      ${row.id}, ${row.agent_type}, ${row.status}, ${row.created_at}, ${row.updated_at},
      ${row.input_filename}, ${row.input_rows_json}, ${row.namespace_tag}, ${row.browser_use_run_id},
      ${row.browser_use_session_id}, ${row.browser_use_workspace_id}, ${row.live_view_url},
      ${row.task_prompt}, ${row.result_raw}, ${row.result_json}, ${row.verdict}, ${row.summary},
      ${row.error}, ${row.cost_json}, ${row.evidence_json}, ${row.events_json}, ${row.retry_of}
    )
  `;
}

const PATCHABLE_COLUMNS = [
  "status",
  "browser_use_run_id",
  "browser_use_session_id",
  "browser_use_workspace_id",
  "live_view_url",
  "result_raw",
  "result_json",
  "verdict",
  "summary",
  "error",
  "cost_json",
  "evidence_json",
  "events_json",
] as const;

export async function updateRun(id: string, patch: Partial<RunRow>): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  const entries = PATCHABLE_COLUMNS.filter((col) => col in patch);
  if (entries.length === 0) return;

  const setSql = entries.map((col, i) => `${col} = $${i + 2}`).join(", ");
  const values = entries.map((col) => patch[col] as unknown);
  await sql.query(
    `UPDATE runs SET ${setSql}, updated_at = $1 WHERE id = $${entries.length + 2}`,
    [Date.now(), ...values, id]
  );
}

// node-postgres (and the Neon driver) return BIGINT columns as strings to
// avoid silent precision loss, so created_at/updated_at need coercing back
// to numbers for callers that do date math or arithmetic on them.
function toRunRow(row: Record<string, unknown>): RunRow {
  return {
    ...row,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  } as RunRow;
}

export async function getRun(id: string): Promise<RunRow | undefined> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM runs WHERE id = ${id}`;
  return rows[0] ? toRunRow(rows[0]) : undefined;
}

export async function listRuns(): Promise<RunRow[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM runs ORDER BY created_at DESC`;
  return rows.map(toRunRow);
}

export async function totalCostUsd(): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`SELECT cost_json FROM runs WHERE cost_json IS NOT NULL`) as {
    cost_json: string;
  }[];
  let total = 0;
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.cost_json);
      if (typeof parsed?.usd === "number") total += parsed.usd;
    } catch {
      // ignore malformed cost json
    }
  }
  return total;
}

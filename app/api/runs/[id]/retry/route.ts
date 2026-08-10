import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getRun, insertRun } from "@/lib/db";
import type { Row } from "@/lib/spreadsheet";
import { getAgentDefinition } from "@/lib/agents";
import { launchRun, buildNamespaceTag } from "@/lib/runLifecycle";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const original = await getRun(id);
  if (!original) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sapUrl = process.env.SAP_URL ?? "";
  const sapUser = process.env.SAP_USERNAME ?? "";
  const sapPass = process.env.SAP_PASSWORD ?? "";
  if (!sapUrl || !sapUser || !sapPass) {
    return NextResponse.json(
      { error: "SAP_URL / SAP_USERNAME / SAP_PASSWORD are not configured (see .env.local)" },
      { status: 500 }
    );
  }

  const rows: Row[] = original.input_rows_json ? JSON.parse(original.input_rows_json) : [];
  const runId = randomUUID();
  const namespaceTag = buildNamespaceTag(runId);
  const def = getAgentDefinition(original.agent_type);
  const taskPrompt = def.buildTask(
    rows,
    { url: sapUrl, username: sapUser, password: sapPass },
    namespaceTag
  );

  const now = Date.now();
  await insertRun({
    id: runId,
    agent_type: original.agent_type,
    status: "queued",
    created_at: now,
    updated_at: now,
    input_filename: original.input_filename,
    input_rows_json: original.input_rows_json,
    namespace_tag: namespaceTag,
    browser_use_run_id: null,
    browser_use_session_id: null,
    browser_use_workspace_id: null,
    live_view_url: null,
    task_prompt: taskPrompt,
    result_raw: null,
    result_json: null,
    verdict: null,
    summary: null,
    error: null,
    cost_json: null,
    evidence_json: null,
    events_json: null,
    retry_of: original.id,
  });

  await launchRun(runId);

  return NextResponse.json({ id: runId }, { status: 201 });
}

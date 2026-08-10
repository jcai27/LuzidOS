import { NextRequest, NextResponse } from "next/server";
import { getRun, updateRun } from "@/lib/db";

const TERMINAL = new Set(["completed", "failed", "cancelled", "timed_out"]);

/**
 * Soft stop: the Browser Use v4 API doesn't document a cancel endpoint, so
 * this marks the run cancelled in our own DB. advanceRun() checks for that
 * status before doing any further work, so the next tick (at most ~2s away)
 * stops polling Browser Use and the UI settles immediately.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (TERMINAL.has(run.status)) {
    return NextResponse.json({ error: `run already ${run.status}` }, { status: 409 });
  }
  await updateRun(id, {
    status: "cancelled",
    summary: "Stopped by user.",
  });
  return NextResponse.json({ ok: true });
}

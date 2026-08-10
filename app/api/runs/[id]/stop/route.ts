import { NextRequest, NextResponse } from "next/server";
import { getRun } from "@/lib/db";
import { cancelRun } from "@/lib/runLifecycle";

const TERMINAL = new Set(["completed", "failed", "cancelled", "timed_out"]);

/**
 * Hard-cancels the Browser Use run itself via POST /runs/{id}/cancel (stops
 * billing immediately) and marks it cancelled in our DB. advanceRun() also
 * checks our DB status before doing further work, so even if the cancel
 * call fails the next tick (at most ~2s away) stops polling regardless.
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
  await cancelRun(id);
  return NextResponse.json({ ok: true });
}

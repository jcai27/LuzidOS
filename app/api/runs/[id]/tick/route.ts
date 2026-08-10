import { NextRequest, NextResponse } from "next/server";
import { advanceRun } from "@/lib/runLifecycle";

/**
 * Advances a run by one poll tick and returns the fresh state. The Run page
 * calls this on a client-side interval while the run is non-terminal — this
 * replaces server-push (SSE) with client-driven polling so liveness doesn't
 * depend on a function staying alive for the run's whole duration, which
 * doesn't hold on serverless.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await advanceRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ run });
}

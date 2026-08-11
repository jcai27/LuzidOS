import { NextRequest, NextResponse } from "next/server";
import { getAgentStats, type AgentType } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (type !== "configuration" && type !== "unit_test") {
    return NextResponse.json({ error: "unknown agent type" }, { status: 400 });
  }
  const stats = await getAgentStats(type as AgentType);
  return NextResponse.json(stats);
}

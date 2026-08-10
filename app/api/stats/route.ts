import { NextResponse } from "next/server";
import { totalCostUsd } from "@/lib/db";

export async function GET() {
  return NextResponse.json({
    totalUsd: await totalCostUsd(),
    capUsd: Number(process.env.BROWSER_USE_SPEND_CAP_USD ?? 0) || null,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { parseSpreadsheet } from "@/lib/spreadsheet";

/**
 * Parse-only: no run is created, no Browser Use call is made. Lets the
 * Launch page show the user what it actually read from their spreadsheet
 * before they commit to spending real API credits on a typo.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows;
  try {
    rows = await parseSpreadsheet(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not parse spreadsheet: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "Spreadsheet has no data rows" }, { status: 400 });
  }

  return NextResponse.json({ rows });
}

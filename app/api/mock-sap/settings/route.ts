import { NextRequest, NextResponse } from "next/server";
import { MOCK_SAP_SESSION_COOKIE, setDateFormat } from "@/lib/mockSap";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (req.cookies.get(MOCK_SAP_SESSION_COOKIE)?.value !== "ok") {
    return NextResponse.redirect(new URL("/mock-sap", url.origin), { status: 303 });
  }
  const form = await req.formData();
  const dateFormat = String(form.get("dateFormat") ?? "MM/DD/YYYY");
  await setDateFormat(dateFormat);

  return NextResponse.redirect(new URL("/mock-sap/settings?saved=1", url.origin), { status: 303 });
}

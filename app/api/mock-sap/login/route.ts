import { NextRequest, NextResponse } from "next/server";
import { MOCK_SAP_SESSION_COOKIE } from "@/lib/mockSap";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");

  const valid = username === process.env.SAP_USERNAME && password === process.env.SAP_PASSWORD;

  const url = new URL(req.url);
  if (!valid) {
    return NextResponse.redirect(new URL("/mock-sap?error=1", url.origin), { status: 303 });
  }

  const res = NextResponse.redirect(new URL("/mock-sap/home", url.origin), { status: 303 });
  res.cookies.set(MOCK_SAP_SESSION_COOKIE, "ok", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });
  return res;
}

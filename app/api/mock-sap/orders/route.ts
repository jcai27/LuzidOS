import { NextRequest, NextResponse } from "next/server";
import { MOCK_SAP_SESSION_COOKIE, createSalesOrder } from "@/lib/mockSap";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (req.cookies.get(MOCK_SAP_SESSION_COOKIE)?.value !== "ok") {
    return NextResponse.redirect(new URL("/mock-sap", url.origin), { status: 303 });
  }

  const form = await req.formData();
  const field = (name: string) => String(form.get(name) ?? "");

  const orderNumber = await createSalesOrder({
    soldToParty: field("soldToParty"),
    material: field("material"),
    quantity: field("quantity"),
    salesOrg: field("salesOrg"),
    distributionChannel: field("distributionChannel"),
    division: field("division"),
    customerReference: field("customerReference"),
  });

  return NextResponse.redirect(
    new URL(`/mock-sap/sales-order/confirmation?order=${orderNumber}`, url.origin),
    { status: 303 }
  );
}

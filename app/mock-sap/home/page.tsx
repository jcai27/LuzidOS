import Link from "next/link";
import { requireMockSapSession } from "@/lib/mockSap";

export default async function MockSapHomePage() {
  await requireMockSapSession();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-xl font-semibold mb-1">Home</h1>
      <p className="text-sm text-slate-500 mb-8">Choose an app to open.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/mock-sap/settings"
          className="block border border-slate-300 rounded-lg p-5 bg-white hover:border-blue-600"
        >
          <p className="font-medium">Settings</p>
          <p className="text-xs text-slate-500 mt-1">Personalize your profile, including date format.</p>
        </Link>
        <Link
          href="/mock-sap/sales-order"
          className="block border border-slate-300 rounded-lg p-5 bg-white hover:border-blue-600"
        >
          <p className="font-medium">Create Sales Order</p>
          <p className="text-xs text-slate-500 mt-1">Enter a new customer sales order.</p>
        </Link>
      </div>
    </div>
  );
}

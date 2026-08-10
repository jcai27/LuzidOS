import { requireMockSapSession } from "@/lib/mockSap";

const FIELDS: { name: string; label: string }[] = [
  { name: "soldToParty", label: "Sold-To Party" },
  { name: "material", label: "Material" },
  { name: "quantity", label: "Quantity" },
  { name: "salesOrg", label: "Sales Organization" },
  { name: "distributionChannel", label: "Distribution Channel" },
  { name: "division", label: "Division" },
];

export default async function MockSapSalesOrderPage() {
  await requireMockSapSession();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-xl font-semibold mb-1">Create Sales Order</h1>
      <p className="text-sm text-slate-500 mb-8">Enter order details and submit.</p>

      <form
        method="POST"
        action="/api/mock-sap/orders"
        className="max-w-sm flex flex-col gap-4"
      >
        {FIELDS.map((f) => (
          <label key={f.name} className="text-sm">
            <span className="block text-slate-600 mb-1">{f.label}</span>
            <input
              type="text"
              name={f.name}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </label>
        ))}
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Customer Reference (optional)</span>
          <input
            type="text"
            name="customerReference"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="bg-blue-700 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-800 w-fit"
        >
          Submit
        </button>
      </form>
    </div>
  );
}

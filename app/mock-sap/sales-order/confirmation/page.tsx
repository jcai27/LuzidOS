import { requireMockSapSession } from "@/lib/mockSap";

export default async function MockSapConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  await requireMockSapSession();
  const { order } = await searchParams;

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="max-w-sm bg-emerald-50 border border-emerald-300 rounded-lg px-5 py-4">
        <p className="text-emerald-800 font-medium">Order created</p>
        <p className="text-sm text-emerald-700 mt-1">
          Your sales order has been created. Order number:{" "}
          <span className="font-mono font-semibold">{order}</span>
        </p>
      </div>
    </div>
  );
}

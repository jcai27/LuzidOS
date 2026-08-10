import { getDateFormat, requireMockSapSession } from "@/lib/mockSap";

const DATE_FORMATS = ["MM/DD/YYYY", "DD.MM.YYYY", "YYYY-MM-DD"];

export default async function MockSapSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireMockSapSession();
  const { saved } = await searchParams;
  const current = await getDateFormat();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-xl font-semibold mb-1">Personalization settings</h1>
      <p className="text-sm text-slate-500 mb-8">User profile settings for the current user.</p>

      {saved && (
        <div className="max-w-sm mb-6 bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm rounded px-4 py-3">
          Settings saved.
        </div>
      )}

      <form method="POST" action="/api/mock-sap/settings" className="max-w-sm flex flex-col gap-4">
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Date Format</span>
          <select
            name="dateFormat"
            defaultValue={current}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
          >
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-400">
          Current value: <span className="font-mono">{current}</span>
        </p>
        <button
          type="submit"
          className="bg-blue-700 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-800 w-fit"
        >
          Save
        </button>
      </form>
    </div>
  );
}

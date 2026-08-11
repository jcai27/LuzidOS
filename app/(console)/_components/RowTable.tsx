import type { Row } from "@/lib/spreadsheet";

/** Renders spreadsheet rows as an actual table (dynamic columns, union of keys across rows) instead of a flat "key: value" string — reused on the Launch review step and the Run page's "What we tested" section. */
export default function RowTable({ rows }: { rows: Row[] }) {
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

  return (
    <div className="border border-panel-border rounded-xl overflow-x-auto bg-ink/40">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="border-b border-panel-border">
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium text-slate/70 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-panel-border">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-slate whitespace-nowrap">
                  {row[col] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

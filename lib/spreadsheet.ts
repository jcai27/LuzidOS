import ExcelJS from "exceljs";

export type Row = Record<string, string>;

/**
 * Generic xlsx -> Row[] parser shared by every agent. Reads the first
 * worksheet, treats row 1 as headers, and returns one object per
 * subsequent row mapping header -> stringified cell value. Agent-specific
 * code decides what the headers mean (Setting/NewValue, Field/Value, ...).
 */
export async function parseSpreadsheet(buffer: Buffer): Promise<Row[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: Row[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    if (excelRow.cellCount === 0) continue;
    const row: Row = {};
    let hasValue = false;
    headers.forEach((header, colNumber) => {
      if (!header) return;
      const cell = excelRow.getCell(colNumber);
      const value = cellToString(cell.value);
      if (value !== "") hasValue = true;
      row[header] = value;
    });
    if (hasValue) rows.push(row);
  }
  return rows;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in (value as { text?: string })) {
    return String((value as { text?: string }).text ?? "");
  }
  if (typeof value === "object" && "result" in (value as { result?: unknown })) {
    return String((value as { result?: unknown }).result ?? "");
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

import ExcelJS from "exceljs";
import { sanitizeFormulaInjection } from "@/lib/utils/file-conversion";

export type TWorkbookCell = string | number | boolean | Date | null | undefined;

export type TWorkbookSheet = {
  name: string;
  headers: string[];
  rows: TWorkbookCell[][];
  /** Column types for numeric/date formatting hints (parallel to headers, optional) */
  columnTypes?: Array<"text" | "number" | "percent" | "date">;
};

const sanitizeCell = (value: TWorkbookCell): ExcelJS.CellValue => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return sanitizeFormulaInjection(value);
  if (value instanceof Date) return value;
  return value;
};

const fitColumnWidths = (sheet: ExcelJS.Worksheet, headers: string[], rows: TWorkbookCell[][]) => {
  headers.forEach((header, colIdx) => {
    let max = String(header).length;
    for (const row of rows.slice(0, 200)) {
      const cell = row[colIdx];
      const len = cell == null ? 0 : String(cell).length;
      if (len > max) max = len;
    }
    sheet.getColumn(colIdx + 1).width = Math.min(40, Math.max(12, max + 2));
  });
};

export const buildResearchWorkbookBuffer = async (sheets: TWorkbookSheet[]): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Formbricks Research";
  workbook.created = new Date();

  const usedNames = new Set<string>();

  for (const definition of sheets) {
    if (definition.headers.length === 0 && definition.rows.length === 0) continue;

    let name = definition.name.slice(0, 31) || "Sheet";
    let suffix = 1;
    while (usedNames.has(name)) {
      const base = definition.name.slice(0, 28) || "Sheet";
      name = `${base}_${suffix++}`.slice(0, 31);
    }
    usedNames.add(name);

    const sheet = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    const headerRow = sheet.addRow(definition.headers.map((h) => sanitizeFormulaInjection(h)));
    headerRow.font = { bold: true };
    headerRow.commit();

    for (const row of definition.rows) {
      const values = definition.headers.map((_, i) => sanitizeCell(row[i]));
      const excelRow = sheet.addRow(values);
      definition.columnTypes?.forEach((type, i) => {
        const cell = excelRow.getCell(i + 1);
        if (type === "number" && typeof values[i] === "number") {
          cell.numFmt = "0.##";
        }
        if (type === "percent" && typeof values[i] === "number") {
          cell.numFmt = "0.0%";
          cell.value = (values[i] as number) > 1 ? (values[i] as number) / 100 : (values[i] as number);
        }
        if (type === "date" && values[i] instanceof Date) {
          cell.numFmt = "yyyy-mm-dd hh:mm";
        }
      });
    }

    if (definition.headers.length > 0 && definition.rows.length > 0) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1 + definition.rows.length, column: definition.headers.length },
      };
    }

    fitColumnWidths(sheet, definition.headers, definition.rows);
  }

  if (workbook.worksheets.length === 0) {
    const empty = workbook.addWorksheet("Metadata");
    empty.addRow(["Note", "No data available for export"]);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
};

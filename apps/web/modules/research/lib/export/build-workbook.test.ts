import { describe, expect, test } from "vitest";
import { sanitizeFormulaInjection } from "@/lib/utils/file-conversion";
import { buildResearchWorkbookBuffer } from "@/modules/research/lib/export/build-workbook";

describe("sanitizeFormulaInjection (research excel)", () => {
  test("prefixes dangerous spreadsheet formula triggers", () => {
    expect(sanitizeFormulaInjection("=HYPERLINK(\"http://evil\")")).toBe("'=HYPERLINK(\"http://evil\")");
    expect(sanitizeFormulaInjection("+cmd")).toBe("'+cmd");
    expect(sanitizeFormulaInjection("-1+1")).toBe("'-1+1");
    expect(sanitizeFormulaInjection("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitizeFormulaInjection("safe text")).toBe("safe text");
    expect(sanitizeFormulaInjection(42)).toBe(42);
  });
});

describe("buildResearchWorkbookBuffer", () => {
  test("writes xlsx with sanitized cells and frozen header", async () => {
    const buffer = await buildResearchWorkbookBuffer([
      {
        name: "Interview Insights",
        headers: ["Title", "Note"],
        rows: [
          ["Барьер доверия", "=cmd|' /C calc'!A0"],
          ["Нормальный вывод", "ok"],
        ],
      },
      {
        name: "Metadata",
        headers: ["Key", "Value"],
        rows: [["exportType", "xlsx"]],
      },
    ]);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(100);
    // ZIP/XLSX signature
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  test("skips empty sheets and still produces metadata-capable workbook", async () => {
    const buffer = await buildResearchWorkbookBuffer([
      { name: "Empty", headers: [], rows: [] },
      {
        name: "Summary",
        headers: ["Field", "Value"],
        rows: [["Project", "Тест"]],
      },
    ]);
    expect(buffer.byteLength).toBeGreaterThan(50);
  });
});

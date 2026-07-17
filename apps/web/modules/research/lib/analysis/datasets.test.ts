import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {},
}));
vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("parseCsvDataset", () => {
  let parseCsvDataset: typeof import("./datasets").parseCsvDataset;

  beforeAll(async () => {
    ({ parseCsvDataset } = await import("./datasets"));
  });

  test("parses headers, infers number fields, and builds rows", () => {
    const parsed = parseCsvDataset("segment,score\nSMB,4\nEnterprise,5\n");
    expect(parsed.fields).toHaveLength(2);
    expect(parsed.fields[0].name).toBe("segment");
    expect(parsed.fields[1].type).toBe("number");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0][parsed.fields[1].id]).toBe(4);
  });

  test("rejects empty dataset", () => {
    expect(() => parseCsvDataset("")).toThrow();
  });
});

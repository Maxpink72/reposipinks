import { describe, expect, test } from "vitest";
import {
  DEFAULT_REPORT_THEME_TOKENS,
  REPORT_STATUS_TRANSITIONS,
  ZResearchReportBlockContent,
  ZResearchReportStatus,
  defaultContentForBlockType,
} from "@/modules/research/types/report";

describe("report block content", () => {
  test("parses heading / paragraph / embeds", () => {
    expect(
      ZResearchReportBlockContent.parse({ kind: "heading", text: "Findings", level: 1 })
    ).toMatchObject({ kind: "heading", level: 1 });
    expect(ZResearchReportBlockContent.parse({ kind: "paragraph", text: "Hello" }).kind).toBe(
      "paragraph"
    );
    expect(
      ZResearchReportBlockContent.parse({
        kind: "analysis",
        analysisBlockId: "clabcdefghijklmnopqrstuv",
      }).kind
    ).toBe("analysis");
  });

  test("defaultContentForBlockType aligns type and kind", () => {
    for (const type of [
      "heading",
      "paragraph",
      "bullets",
      "analysis",
      "insight",
      "quote",
      "brand_audit",
      "page_break",
      "divider",
    ] as const) {
      const content = defaultContentForBlockType(type);
      expect(content.kind).toBe(type);
    }
  });
});

describe("report status transitions", () => {
  test("draft can move to review or archive", () => {
    expect(REPORT_STATUS_TRANSITIONS.draft).toEqual(["in_review", "archived"]);
  });

  test("approved can publish", () => {
    expect(REPORT_STATUS_TRANSITIONS.approved).toContain("published");
  });

  test("status enum covers workflow", () => {
    expect(ZResearchReportStatus.options).toContain("published");
  });
});

describe("default theme tokens", () => {
  test("has readable print defaults", () => {
    expect(DEFAULT_REPORT_THEME_TOKENS.primary).toBeTruthy();
    expect(DEFAULT_REPORT_THEME_TOKENS.fontFamily.toLowerCase()).toContain("georgia");
  });
});

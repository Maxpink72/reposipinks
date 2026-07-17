import { describe, expect, test } from "vitest";
import { buildExportCacheKey, sha256Hex } from "@/modules/research/lib/export/cache-key";
import { renderResearchReportPrintHtml } from "@/modules/research/lib/export/print-html";

describe("renderResearchReportPrintHtml", () => {
  test("escapes HTML and renders Cyrillic content with page-break CSS", () => {
    const html = renderResearchReportPrintHtml({
      title: "Отчёт <script>",
      subtitle: "Восприятие бренда",
      projectName: "Проект А",
      generatedAt: "2026-07-18T00:00:00.000Z",
      includeToc: true,
      blocks: [
        {
          id: "h1",
          type: "heading",
          content: { kind: "heading", text: "Ключевые выводы", level: 1 },
        },
        {
          id: "p1",
          type: "paragraph",
          content: { kind: "paragraph", text: "Текст с <тегами> и кириллицей." },
        },
        {
          id: "q1",
          type: "quote",
          content: { kind: "quote", text: "Цитата респондента", attribution: "Иван, SMB" },
        },
        { id: "pb", type: "page_break", content: { kind: "page_break" } },
        {
          id: "a1",
          type: "analysis",
          content: { kind: "analysis", analysisBlockId: "ab1", caption: "NPS" },
        },
      ],
      analysisById: {
        ab1: {
          id: "ab1",
          title: "NPS",
          lastResult: { nps: { score: 42 }, sampleSize: 120, metric: "nps" },
        },
      },
    });

    expect(html).toContain("Отчёт &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Ключевые выводы");
    expect(html).toContain("Текст с &lt;тегами&gt;");
    expect(html).toContain("page-break-before: always");
    expect(html).toContain("Noto Serif");
    expect(html).toContain("Contents");
    expect(html).toContain("42");
    expect(html).toContain("@page");
  });

  test("renders insight embed", () => {
    const html = renderResearchReportPrintHtml({
      title: "R",
      generatedAt: "2026-07-18",
      blocks: [
        {
          id: "i1",
          type: "insight",
          content: { kind: "insight", insightId: "ins1", showEvidence: true },
        },
      ],
      insightById: {
        ins1: {
          id: "ins1",
          title: "Барьер доверия",
          description: "Клиенты сомневаются в обещаниях бренда",
          type: "barrier",
        },
      },
    });
    expect(html).toContain("Барьер доверия");
    expect(html).toContain("barrier");
  });
});

describe("export cache key", () => {
  test("is stable for same inputs", () => {
    const a = buildExportCacheKey({
      reportId: "r1",
      reportVersionId: "v1",
      snapshotHash: sha256Hex("snap"),
      optionsHash: sha256Hex("opts"),
    });
    const b = buildExportCacheKey({
      reportId: "r1",
      reportVersionId: "v1",
      snapshotHash: sha256Hex("snap"),
      optionsHash: sha256Hex("opts"),
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

import {
  DEFAULT_REPORT_THEME_TOKENS,
  type TResearchReportBlockContent,
  type TResearchReportExportOptions,
  type TResearchReportThemeTokens,
} from "@/modules/research/types/report";

export type TPrintReportBlock = {
  id: string;
  type: string;
  content: TResearchReportBlockContent;
};

export type TPrintEmbedAnalysis = {
  id: string;
  title: string;
  lastResult?: {
    sampleSize?: number;
    metric?: string;
    points?: Array<{ label: string; value: number; percentage?: number }>;
    kpi?: { value: number; label: string };
    nps?: { score: number };
  } | null;
};

export type TPrintEmbedInsight = {
  id: string;
  title: string;
  description: string | null;
  type: string;
};

export type TPrintReportDocument = {
  title: string;
  subtitle?: string | null;
  projectName?: string;
  generatedAt: string;
  tokens?: Partial<TResearchReportThemeTokens> | null;
  exportOptions?: Partial<TResearchReportExportOptions> | null;
  blocks: TPrintReportBlock[];
  analysisById?: Record<string, TPrintEmbedAnalysis>;
  insightById?: Record<string, TPrintEmbedInsight>;
  includeToc?: boolean;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderAnalysisFigure = (analysis: TPrintEmbedAnalysis | undefined, caption?: string): string => {
  const title = escapeHtml(caption || analysis?.title || "Analysis");
  if (!analysis?.lastResult) {
    return `<figure class="chart"><figcaption>${title}</figcaption><p class="muted">No computed result</p></figure>`;
  }
  const result = analysis.lastResult;
  if (result.kpi) {
    return `<figure class="chart kpi"><figcaption>${title}</figcaption><p class="kpi-value">${escapeHtml(String(result.kpi.value))}</p><p class="muted">${escapeHtml(result.kpi.label)}</p></figure>`;
  }
  if (result.nps) {
    return `<figure class="chart kpi"><figcaption>${title}</figcaption><p class="kpi-value">${escapeHtml(String(result.nps.score))}</p><p class="muted">NPS · n=${result.sampleSize ?? "—"}</p></figure>`;
  }
  const points = result.points ?? [];
  const rows = points
    .slice(0, 40)
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.label)}</td><td class="num">${escapeHtml(String(p.value))}</td><td class="num">${p.percentage != null ? `${p.percentage.toFixed(1)}%` : ""}</td></tr>`
    )
    .join("");
  return `<figure class="chart"><figcaption>${title}</figcaption><table><thead><tr><th>Category</th><th>Value</th><th>%</th></tr></thead><tbody>${rows}</tbody></table><p class="muted">n=${result.sampleSize ?? "—"} · ${escapeHtml(result.metric ?? "")}</p></figure>`;
};

const renderBlock = (
  block: TPrintReportBlock,
  analysisById: Record<string, TPrintEmbedAnalysis>,
  insightById: Record<string, TPrintEmbedInsight>
): string => {
  const c = block.content;
  switch (c.kind) {
    case "heading": {
      const level = c.level ?? 2;
      const id = `h-${block.id}`;
      return `<h${level} id="${id}" class="heading-${level}">${escapeHtml(c.text || "—")}</h${level}>`;
    }
    case "paragraph":
      return `<p class="body">${escapeHtml(c.text || "—").replaceAll("\n", "<br/>")}</p>`;
    case "bullets": {
      const items = c.items.map((item) => `<li>${escapeHtml(item || "—")}</li>`).join("");
      return `<ul class="bullets">${items}</ul>`;
    }
    case "quote":
      return `<blockquote class="quote"><p>${escapeHtml(c.text || "—")}</p>${c.attribution ? `<footer>— ${escapeHtml(c.attribution)}</footer>` : ""}</blockquote>`;
    case "analysis":
      return renderAnalysisFigure(analysisById[c.analysisBlockId], c.caption);
    case "insight": {
      const insight = insightById[c.insightId];
      return `<section class="insight"><p class="eyebrow">${escapeHtml(insight?.type ?? "insight")}</p><h3>${escapeHtml(insight?.title || "Insight")}</h3>${insight?.description ? `<p>${escapeHtml(insight.description)}</p>` : ""}</section>`;
    }
    case "brand_audit":
      return `<section class="insight"><p class="eyebrow">brand audit</p><h3>${escapeHtml(c.brandAuditId)}</h3><p class="muted">Embedded brand audit (scores / SWOT in Excel &amp; live preview)</p></section>`;
    case "divider":
      return `<hr class="divider" />`;
    case "page_break":
      return `<div class="page-break" aria-hidden="true"></div>`;
    default:
      return "";
  }
};

const buildToc = (blocks: TPrintReportBlock[]): string => {
  const items = blocks
    .filter((b) => b.content.kind === "heading")
    .map((b) => {
      const c = b.content;
      if (c.kind !== "heading") return "";
      return `<li class="toc-l${c.level}"><a href="#h-${b.id}">${escapeHtml(c.text || "—")}</a></li>`;
    })
    .join("");
  if (!items) return "";
  return `<nav class="toc"><h2>Contents</h2><ol>${items}</ol></nav>`;
};

/** Print-ready HTML for Playwright page.pdf — Cyrillic via Google Fonts (DejaVu-compatible stack). */
export const renderResearchReportPrintHtml = (doc: TPrintReportDocument): string => {
  const tokens = { ...DEFAULT_REPORT_THEME_TOKENS, ...doc.tokens };
  const options = {
    pageSize: "A4" as const,
    orientation: "portrait" as const,
    includeToc: false,
    ...doc.exportOptions,
  };
  const analysisById = doc.analysisById ?? {};
  const insightById = doc.insightById ?? {};
  const includeToc = doc.includeToc ?? options.includeToc;
  const body = doc.blocks.map((b) => renderBlock(b, analysisById, insightById)).join("\n");
  const toc = includeToc ? buildToc(doc.blocks) : "";
  const landscape = options.orientation === "landscape";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Sans:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 ${landscape ? "landscape" : "portrait"};
      margin: 18mm 16mm 22mm 16mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: ${tokens.text};
      background: ${tokens.background};
      font-family: "Noto Serif", ${tokens.fontFamily}, "DejaVu Serif", "Times New Roman", serif;
      font-size: 11pt;
      line-height: 1.55;
    }
    .meta { color: ${tokens.mutedText}; font-family: "Noto Sans", sans-serif; font-size: 9pt; margin-bottom: 12pt; }
    h1.title { color: ${tokens.primary}; font-size: 22pt; margin: 0 0 6pt; page-break-after: avoid; }
    .subtitle { color: ${tokens.mutedText}; font-size: 12pt; margin: 0 0 18pt; }
    .heading-1 { color: ${tokens.primary}; font-size: 16pt; margin: 18pt 0 8pt; page-break-after: avoid; }
    .heading-2 { color: ${tokens.primary}; font-size: 13pt; margin: 14pt 0 6pt; page-break-after: avoid; }
    .heading-3 { color: ${tokens.primary}; font-size: 11.5pt; margin: 12pt 0 4pt; page-break-after: avoid; }
    p.body { margin: 0 0 10pt; }
    ul.bullets { margin: 0 0 10pt; padding-left: 18pt; }
    blockquote.quote {
      margin: 12pt 0;
      padding: 8pt 12pt;
      border-left: 3pt solid ${tokens.accent};
      color: ${tokens.mutedText};
      font-style: italic;
      page-break-inside: avoid;
    }
    blockquote.quote footer { font-style: normal; margin-top: 6pt; font-size: 9pt; }
    .insight {
      border-left: 3pt solid ${tokens.accent};
      padding: 8pt 12pt;
      margin: 12pt 0;
      background: #f8fafc;
      page-break-inside: avoid;
    }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-size: 8pt; color: ${tokens.mutedText}; margin: 0; font-family: "Noto Sans", sans-serif; }
    .chart { margin: 12pt 0; page-break-inside: avoid; }
    .chart figcaption { font-weight: 700; color: ${tokens.accent}; margin-bottom: 6pt; }
    .kpi-value { font-size: 28pt; font-weight: 700; margin: 0; color: ${tokens.primary}; }
    table { width: 100%; border-collapse: collapse; font-family: "Noto Sans", sans-serif; font-size: 9pt; }
    thead { display: table-header-group; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 4pt 6pt; text-align: left; }
    td.num, th.num { text-align: right; }
    .muted { color: ${tokens.mutedText}; font-size: 8.5pt; }
    hr.divider { border: none; border-top: 1px solid #cbd5e1; margin: 16pt 0; }
    .page-break { break-before: page; page-break-before: always; height: 0; }
    .toc { margin: 0 0 18pt; page-break-after: always; }
    .toc ol { padding-left: 18pt; }
    .toc-l1 { font-weight: 600; }
    .toc-l2 { margin-left: 8pt; }
    .toc-l3 { margin-left: 16pt; }
    .toc a { color: ${tokens.text}; text-decoration: none; }
    footer.doc-footer {
      position: running(docFooter);
      font-family: "Noto Sans", sans-serif;
      font-size: 8pt;
      color: ${tokens.mutedText};
    }
  </style>
</head>
<body>
  <header>
    <p class="meta">${escapeHtml(doc.projectName || "")}${doc.projectName ? " · " : ""}${escapeHtml(doc.generatedAt)}</p>
    <h1 class="title">${escapeHtml(doc.title)}</h1>
    ${doc.subtitle ? `<p class="subtitle">${escapeHtml(doc.subtitle)}</p>` : ""}
  </header>
  ${toc}
  <main>
    ${body}
  </main>
  ${tokens.footerText ? `<footer class="doc-footer">${escapeHtml(tokens.footerText)}</footer>` : ""}
</body>
</html>`;
};

export { escapeHtml };

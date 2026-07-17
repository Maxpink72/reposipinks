"use client";

import {
  DEFAULT_REPORT_THEME_TOKENS,
  type TResearchReportBlockContent,
  type TResearchReportThemeTokens,
} from "@/modules/research/types/report";

type PreviewBlock = {
  id: string;
  type: string;
  content: TResearchReportBlockContent;
};

type EmbedAnalysis = { id: string; title: string; lastResult?: unknown };
type EmbedInsight = { id: string; title: string; description: string | null; type: string };

interface ResearchReportPreviewProps {
  title: string;
  subtitle?: string | null;
  blocks: PreviewBlock[];
  tokens?: Partial<TResearchReportThemeTokens> | null;
  analysisById: Record<string, EmbedAnalysis>;
  insightById: Record<string, EmbedInsight>;
  labels: {
    pageBreak: string;
    selectAnalysis: string;
    selectInsight: string;
  };
}

export const ResearchReportPreview = ({
  title,
  subtitle,
  blocks,
  tokens: tokensProp,
  analysisById,
  insightById,
  labels,
}: ResearchReportPreviewProps) => {
  const tokens = { ...DEFAULT_REPORT_THEME_TOKENS, ...tokensProp };

  return (
    <article
      className="min-h-[480px] rounded-sm border border-slate-200 p-8 shadow-sm"
      style={{
        background: tokens.background,
        color: tokens.text,
        fontFamily: tokens.fontFamily,
      }}>
      <header className="mb-8 border-b pb-4" style={{ borderColor: tokens.primary }}>
        <h1 className="text-3xl font-bold" style={{ color: tokens.primary }}>
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-base" style={{ color: tokens.mutedText }}>
            {subtitle}
          </p>
        ) : null}
      </header>

      <div className="space-y-5">
        {blocks.map((block) => {
          const c = block.content;
          switch (c.kind) {
            case "heading": {
              const Tag = c.level === 1 ? "h1" : c.level === 2 ? "h2" : "h3";
              const size = c.level === 1 ? "text-2xl" : c.level === 2 ? "text-xl" : "text-lg";
              return (
                <Tag key={block.id} className={`${size} font-semibold`} style={{ color: tokens.primary }}>
                  {c.text || "—"}
                </Tag>
              );
            }
            case "paragraph":
              return (
                <p key={block.id} className="whitespace-pre-wrap text-[15px] leading-relaxed">
                  {c.text || "—"}
                </p>
              );
            case "bullets":
              return (
                <ul key={block.id} className="list-disc space-y-1 pl-5 text-[15px]">
                  {c.items.map((item, i) => (
                    <li key={`${block.id}-${i}`}>{item || "—"}</li>
                  ))}
                </ul>
              );
            case "quote":
              return (
                <blockquote
                  key={block.id}
                  className="border-l-4 pl-4 italic"
                  style={{ borderColor: tokens.accent, color: tokens.mutedText }}>
                  <p>“{c.text || "—"}”</p>
                  {c.attribution ? <footer className="mt-2 text-sm not-italic">— {c.attribution}</footer> : null}
                </blockquote>
              );
            case "analysis": {
              const analysis = analysisById[c.analysisBlockId];
              return (
                <figure
                  key={block.id}
                  className="rounded border p-4"
                  style={{ borderColor: `${tokens.accent}55` }}>
                  <figcaption className="mb-2 text-sm font-semibold" style={{ color: tokens.accent }}>
                    {c.caption || analysis?.title || labels.selectAnalysis}
                  </figcaption>
                  {analysis?.lastResult ? (
                    <pre className="max-h-40 overflow-auto text-xs" style={{ color: tokens.mutedText }}>
                      {JSON.stringify(analysis.lastResult, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm" style={{ color: tokens.mutedText }}>
                      {labels.selectAnalysis}
                    </p>
                  )}
                </figure>
              );
            }
            case "insight": {
              const insight = insightById[c.insightId];
              return (
                <div
                  key={block.id}
                  className="rounded border-l-4 bg-slate-50/80 p-4"
                  style={{ borderColor: tokens.accent }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: tokens.mutedText }}>
                    {insight?.type ?? "insight"}
                  </p>
                  <p className="mt-1 font-semibold">{insight?.title || labels.selectInsight}</p>
                  {insight?.description ? (
                    <p className="mt-2 text-sm" style={{ color: tokens.mutedText }}>
                      {insight.description}
                    </p>
                  ) : null}
                </div>
              );
            }
            case "brand_audit":
              return (
                <div
                  key={block.id}
                  className="rounded border p-4"
                  style={{ borderColor: `${tokens.accent}55` }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: tokens.mutedText }}>
                    brand audit
                  </p>
                  <p className="mt-1 font-semibold">{c.brandAuditId === "_" ? "—" : c.brandAuditId}</p>
                </div>
              );
            case "divider":
              return <hr key={block.id} className="border-slate-200" />;
            case "page_break":
              return (
                <div
                  key={block.id}
                  className="my-6 border-t border-dashed border-slate-300 pt-2 text-center text-xs uppercase tracking-widest"
                  style={{ color: tokens.mutedText }}>
                  {labels.pageBreak}
                </div>
              );
            default:
              return null;
          }
        })}
      </div>

      {tokens.footerText ? (
        <footer className="mt-10 border-t pt-3 text-xs" style={{ color: tokens.mutedText, borderColor: tokens.primary }}>
          {tokens.footerText}
        </footer>
      ) : null}
    </article>
  );
};

import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZResearchReportStatus = z.enum([
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
]);
export type TResearchReportStatus = z.infer<typeof ZResearchReportStatus>;

export const ZResearchReportBlockType = z.enum([
  "heading",
  "paragraph",
  "bullets",
  "analysis",
  "insight",
  "quote",
  "brand_audit",
  "page_break",
  "divider",
]);
export type TResearchReportBlockType = z.infer<typeof ZResearchReportBlockType>;

export const ZResearchReportThemeTokens = z.object({
  primary: z.string().default("#0f172a"),
  accent: z.string().default("#2563eb"),
  background: z.string().default("#ffffff"),
  text: z.string().default("#0f172a"),
  mutedText: z.string().default("#64748b"),
  fontFamily: z.string().default("Georgia, 'Times New Roman', serif"),
  footerText: z.string().default(""),
});
export type TResearchReportThemeTokens = z.infer<typeof ZResearchReportThemeTokens>;

export const DEFAULT_REPORT_THEME_TOKENS: TResearchReportThemeTokens = {
  primary: "#0f172a",
  accent: "#2563eb",
  background: "#ffffff",
  text: "#0f172a",
  mutedText: "#64748b",
  fontFamily: "Georgia, 'Times New Roman', serif",
  footerText: "",
};

export const ZResearchReportExportOptions = z.object({
  pageSize: z.enum(["A4"]).default("A4"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  includeToc: z.boolean().default(false),
});
export type TResearchReportExportOptions = z.infer<typeof ZResearchReportExportOptions>;

export const ZResearchReportBlockContent = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("heading"),
    text: z.string().max(500),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  }),
  z.object({
    kind: z.literal("paragraph"),
    text: z.string().max(20000),
  }),
  z.object({
    kind: z.literal("bullets"),
    items: z.array(z.string().max(2000)).max(50),
  }),
  z.object({
    kind: z.literal("analysis"),
    analysisBlockId: z.string().min(1),
    caption: z.string().max(500).optional(),
  }),
  z.object({
    kind: z.literal("insight"),
    insightId: z.string().min(1),
    showEvidence: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal("quote"),
    text: z.string().max(5000),
    attribution: z.string().max(300).optional(),
    segmentId: z.string().optional(),
  }),
  z.object({
    kind: z.literal("brand_audit"),
    brandAuditId: z.string().min(1),
    showRadar: z.boolean().default(true),
    showSwot: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal("page_break"),
  }),
  z.object({
    kind: z.literal("divider"),
  }),
]);
export type TResearchReportBlockContent = z.infer<typeof ZResearchReportBlockContent>;

export const ZResearchReportBlockInput = z.object({
  id: z.string().optional(),
  type: ZResearchReportBlockType,
  content: ZResearchReportBlockContent,
});
export type TResearchReportBlockInput = z.infer<typeof ZResearchReportBlockInput>;

export const ZCreateResearchReportInput = z.object({
  researchProjectId: ZId,
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(500).optional(),
  themeId: ZId.optional(),
});
export type TCreateResearchReportInput = z.infer<typeof ZCreateResearchReportInput>;

export const ZUpdateResearchReportMetaInput = z.object({
  reportId: ZId,
  title: z.string().trim().min(1).max(300).optional(),
  subtitle: z.string().trim().max(500).nullable().optional(),
  themeId: ZId.nullable().optional(),
  exportOptions: ZResearchReportExportOptions.optional(),
});
export type TUpdateResearchReportMetaInput = z.infer<typeof ZUpdateResearchReportMetaInput>;

export const ZSaveResearchReportBlocksInput = z.object({
  reportId: ZId,
  blocks: z.array(ZResearchReportBlockInput).max(200),
});
export type TSaveResearchReportBlocksInput = z.infer<typeof ZSaveResearchReportBlocksInput>;

export const ZUpdateResearchReportStatusInput = z.object({
  reportId: ZId,
  status: ZResearchReportStatus,
});
export type TUpdateResearchReportStatusInput = z.infer<typeof ZUpdateResearchReportStatusInput>;

export const ZCreateResearchReportVersionInput = z.object({
  reportId: ZId,
  label: z.string().trim().max(200).optional(),
  note: z.string().trim().max(2000).optional(),
});
export type TCreateResearchReportVersionInput = z.infer<typeof ZCreateResearchReportVersionInput>;

export const ZUpsertResearchReportThemeInput = z.object({
  organizationId: ZId,
  themeId: ZId.optional(),
  name: z.string().trim().min(1).max(200),
  isDefault: z.boolean().optional(),
  tokens: ZResearchReportThemeTokens.partial().optional(),
});
export type TUpsertResearchReportThemeInput = z.infer<typeof ZUpsertResearchReportThemeInput>;

export const REPORT_STATUS_TRANSITIONS: Record<TResearchReportStatus, TResearchReportStatus[]> = {
  draft: ["in_review", "archived"],
  in_review: ["draft", "approved", "archived"],
  approved: ["published", "in_review", "archived"],
  published: ["archived", "draft"],
  archived: ["draft"],
};

/** Draft placeholders used when adding a block in the editor (before embed selection). */
export const defaultContentForBlockType = (
  type: TResearchReportBlockType
): TResearchReportBlockContent => {
  switch (type) {
    case "heading":
      return { kind: "heading", text: "Heading", level: 2 };
    case "paragraph":
      return { kind: "paragraph", text: "" };
    case "bullets":
      return { kind: "bullets", items: [""] };
    case "analysis":
      return { kind: "analysis", analysisBlockId: "_" };
    case "insight":
      return { kind: "insight", insightId: "_", showEvidence: true };
    case "quote":
      return { kind: "quote", text: "" };
    case "brand_audit":
      return { kind: "brand_audit", brandAuditId: "_", showRadar: true, showSwot: true };
    case "page_break":
      return { kind: "page_break" };
    case "divider":
      return { kind: "divider" };
  }
};

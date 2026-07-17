import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZResearchBrandAuditStatus = z.enum(["draft", "in_progress", "completed", "archived"]);
export type TResearchBrandAuditStatus = z.infer<typeof ZResearchBrandAuditStatus>;

export const ZResearchBrandAuditSwot = z.object({
  strengths: z.array(z.string().max(500)).max(30).default([]),
  weaknesses: z.array(z.string().max(500)).max(30).default([]),
  opportunities: z.array(z.string().max(500)).max(30).default([]),
  threats: z.array(z.string().max(500)).max(30).default([]),
});
export type TResearchBrandAuditSwot = z.infer<typeof ZResearchBrandAuditSwot>;

export const ZResearchBrandAuditPositioningPoint = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  isOwnBrand: z.boolean().optional(),
});

export const ZResearchBrandAuditPositioning = z.object({
  xAxisLabel: z.string().max(100).default("Price"),
  yAxisLabel: z.string().max(100).default("Quality"),
  points: z.array(ZResearchBrandAuditPositioningPoint).max(40).default([]),
});
export type TResearchBrandAuditPositioning = z.infer<typeof ZResearchBrandAuditPositioning>;

export const ZResearchBrandAuditCompetitive = z.object({
  competitors: z.array(z.string().max(200)).max(12).default([]),
  rows: z
    .array(
      z.object({
        criterion: z.string().max(200),
        scores: z.array(z.number().min(0).max(5)).max(12),
      })
    )
    .max(30)
    .default([]),
});
export type TResearchBrandAuditCompetitive = z.infer<typeof ZResearchBrandAuditCompetitive>;

export const ZCreateResearchBrandAuditInput = z.object({
  researchProjectId: ZId,
  name: z.string().trim().min(1).max(300),
  brandId: ZId.optional(),
  templateKey: z.string().max(100).optional(),
  notes: z.string().trim().max(5000).optional(),
});
export type TCreateResearchBrandAuditInput = z.infer<typeof ZCreateResearchBrandAuditInput>;

export const ZUpdateResearchBrandAuditInput = z.object({
  brandAuditId: ZId,
  name: z.string().trim().min(1).max(300).optional(),
  status: ZResearchBrandAuditStatus.optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  brandId: ZId.nullable().optional(),
  swot: ZResearchBrandAuditSwot.optional(),
  positioningMatrix: ZResearchBrandAuditPositioning.optional(),
  competitiveMatrix: ZResearchBrandAuditCompetitive.optional(),
});
export type TUpdateResearchBrandAuditInput = z.infer<typeof ZUpdateResearchBrandAuditInput>;

export const ZUpsertBrandAuditAssessmentInput = z.object({
  brandAuditId: ZId,
  criterionId: ZId,
  score: z.number().int().min(0).max(10),
  comment: z.string().trim().max(5000).optional(),
});
export type TUpsertBrandAuditAssessmentInput = z.infer<typeof ZUpsertBrandAuditAssessmentInput>;

/** Default agency criteria template (RU-friendly labels, EN keys). */
export const AGENCY_DEFAULT_BRAND_AUDIT_CRITERIA = [
  {
    key: "strategy",
    name: "Brand strategy & positioning",
    description: "Clarity of positioning, promise, and strategic focus",
    category: "strategy",
    weight: 1.2,
    maxScore: 5,
  },
  {
    key: "visual",
    name: "Visual identity",
    description: "Logo, color, typography, and visual system quality",
    category: "identity",
    weight: 1,
    maxScore: 5,
  },
  {
    key: "verbal",
    name: "Verbal identity",
    description: "Tone of voice, messaging, naming consistency",
    category: "identity",
    weight: 1,
    maxScore: 5,
  },
  {
    key: "digital",
    name: "Digital presence",
    description: "Website, social, and digital brand experience",
    category: "experience",
    weight: 1,
    maxScore: 5,
  },
  {
    key: "cx",
    name: "Customer experience",
    description: "Touchpoints and delivery vs brand promise",
    category: "experience",
    weight: 1.1,
    maxScore: 5,
  },
  {
    key: "consistency",
    name: "Consistency",
    description: "Cross-channel consistency of brand expression",
    category: "system",
    weight: 1,
    maxScore: 5,
  },
  {
    key: "differentiation",
    name: "Differentiation",
    description: "Distinctiveness vs competitors",
    category: "strategy",
    weight: 1.1,
    maxScore: 5,
  },
  {
    key: "assets",
    name: "Brand assets quality",
    description: "Guidelines, templates, and reusable assets",
    category: "system",
    weight: 0.9,
    maxScore: 5,
  },
] as const;

export const computeWeightedAuditScore = (
  items: Array<{ score: number; weight: number; maxScore: number }>
): { average: number; weightedAverage: number; maxAverage: number; coverage: number } => {
  if (items.length === 0) {
    return { average: 0, weightedAverage: 0, maxAverage: 5, coverage: 0 };
  }
  const avg = items.reduce((s, i) => s + i.score, 0) / items.length;
  const weightSum = items.reduce((s, i) => s + i.weight, 0) || 1;
  const weighted = items.reduce((s, i) => s + (i.score / i.maxScore) * i.weight, 0) / weightSum;
  const maxAvg = items.reduce((s, i) => s + i.maxScore, 0) / items.length;
  return {
    average: Math.round(avg * 100) / 100,
    weightedAverage: Math.round(weighted * 100) / 100, // 0..1
    maxAverage: Math.round(maxAvg * 100) / 100,
    coverage: items.length,
  };
};

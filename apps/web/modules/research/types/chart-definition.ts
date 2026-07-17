import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const SMALL_SAMPLE_THRESHOLD = 30;

export const ZResearchChartType = z.enum([
  "bar_vertical",
  "bar_horizontal",
  "bar_stacked",
  "line",
  "pie",
  "donut",
  "likert",
  "histogram",
  "scatter",
  "heatmap",
  "table",
  "kpi",
  "radar",
  "word_cloud",
]);
export type TResearchChartType = z.infer<typeof ZResearchChartType>;

export const ZResearchMetricType = z.enum([
  "count",
  "percentage",
  "mean",
  "median",
  "nps",
  "csat",
  "ces",
  "distribution",
]);
export type TResearchMetricType = z.infer<typeof ZResearchMetricType>;

export const ZResearchDatasetRef = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("survey_element"),
    surveyId: ZId,
    elementId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("survey_cross_tab"),
    surveyId: ZId,
    rowElementId: z.string().min(1),
    columnElementId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("interview_codes"),
    researchProjectId: ZId,
  }),
  z.object({
    kind: z.literal("dataset_field"),
    datasetId: ZId,
    fieldId: z.string().min(1),
    secondaryFieldId: z.string().min(1).optional(),
  }),
]);
export type TResearchDatasetRef = z.infer<typeof ZResearchDatasetRef>;

export const ZResearchFilterDef = z.object({
  field: z.string().min(1),
  op: z.enum(["eq", "neq", "in", "contains"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});
export type TResearchFilterDef = z.infer<typeof ZResearchFilterDef>;

export const ZResearchChartDefinition = z.object({
  id: z.string().min(1),
  type: ZResearchChartType,
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  dataset: ZResearchDatasetRef,
  metrics: z.array(ZResearchMetricType).min(1),
  filters: z.array(ZResearchFilterDef).default([]),
  options: z
    .object({
      showPercentages: z.boolean().optional(),
      showValues: z.boolean().optional(),
      legend: z.boolean().optional(),
      confidenceInterval: z.boolean().optional(),
    })
    .default({}),
  accessibilitySummary: z.string().max(2000).optional(),
});
export type TResearchChartDefinition = z.infer<typeof ZResearchChartDefinition>;

export const ZResearchChartSeriesPoint = z.object({
  label: z.string(),
  value: z.number(),
  percentage: z.number().optional(),
  series: z.string().optional(),
});

export const ZResearchChartResult = z.object({
  sampleSize: z.number().int().nonnegative(),
  smallSampleWarning: z.boolean(),
  metric: ZResearchMetricType,
  points: z.array(ZResearchChartSeriesPoint),
  kpi: z
    .object({
      value: z.number(),
      label: z.string(),
      secondary: z.number().optional(),
      secondaryLabel: z.string().optional(),
    })
    .optional(),
  crossTab: z
    .object({
      rowLabels: z.array(z.string()),
      columnLabels: z.array(z.string()),
      matrix: z.array(z.array(z.number())),
      rowTotals: z.array(z.number()),
      columnTotals: z.array(z.number()),
    })
    .optional(),
  nps: z
    .object({
      score: z.number(),
      promoters: z.number(),
      passives: z.number(),
      detractors: z.number(),
      confidenceInterval95: z.tuple([z.number(), z.number()]).optional(),
    })
    .optional(),
  computedAt: z.string(),
  sourceLabel: z.string(),
  appliedFilters: z.array(ZResearchFilterDef),
});
export type TResearchChartResult = z.infer<typeof ZResearchChartResult>;

/** Prefer readable chart types; avoid pie/donut for many categories. */
export const recommendChartType = (
  categoryCount: number,
  metric: TResearchMetricType
): TResearchChartType => {
  if (metric === "nps" || metric === "csat" || metric === "ces" || metric === "mean" || metric === "median") {
    return "kpi";
  }
  if (categoryCount <= 1) return "kpi";
  if (categoryCount <= 5) return "bar_vertical";
  if (categoryCount <= 12) return "bar_horizontal";
  return "table";
};

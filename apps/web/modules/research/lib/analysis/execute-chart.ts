import "server-only";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  buildCrossTab,
  computeCes,
  computeCsat,
  computeNps,
  frequency,
  isSmallSample,
  mean,
  median,
} from "@/modules/research/lib/analysis/stats";
import {
  type TResearchChartDefinition,
  type TResearchChartResult,
  ZResearchChartDefinition,
} from "@/modules/research/types/chart-definition";

const BATCH = 2000;

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
};

const flattenAnswer = (value: unknown): Array<string | number | boolean> => {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) {
    return value.flatMap((v) => flattenAnswer(v));
  }
  if (typeof value === "object") return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [value];
  }
  return [];
};

const loadSurveyResponses = async (surveyId: string) => {
  const rows: Array<{ data: Record<string, unknown> }> = [];
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.response.findMany({
      where: { surveyId, finished: true },
      select: { id: true, data: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;
    for (const row of batch) {
      rows.push({ data: (row.data ?? {}) as Record<string, unknown> });
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < BATCH) break;
  }

  return rows;
};

const buildResultBase = (
  definition: TResearchChartDefinition,
  sampleSize: number,
  metric: TResearchChartResult["metric"],
  sourceLabel: string
): Pick<
  TResearchChartResult,
  "sampleSize" | "smallSampleWarning" | "metric" | "computedAt" | "sourceLabel" | "appliedFilters"
> => ({
  sampleSize,
  smallSampleWarning: isSmallSample(sampleSize),
  metric,
  computedAt: new Date().toISOString(),
  sourceLabel,
  appliedFilters: definition.filters,
});

const executeSurveyElement = async (
  definition: TResearchChartDefinition & {
    dataset: Extract<TResearchChartDefinition["dataset"], { kind: "survey_element" }>;
  }
): Promise<TResearchChartResult> => {
  const responses = await loadSurveyResponses(definition.dataset.surveyId);
  const elementId = definition.dataset.elementId;
  const metric = definition.metrics[0] ?? "count";
  const rawValues = responses.flatMap((r) => flattenAnswer(r.data[elementId]));
  const numericValues = rawValues.map(toNumber).filter((v): v is number => v !== null);

  if (metric === "nps") {
    const nps = computeNps(numericValues, definition.options.confidenceInterval === true);
    if (!nps) {
      return {
        ...buildResultBase(definition, 0, "nps", `Survey ${definition.dataset.surveyId}`),
        points: [],
      };
    }
    return {
      ...buildResultBase(definition, nps.sampleSize, "nps", `Survey ${definition.dataset.surveyId}`),
      points: [
        { label: "Promoters", value: nps.promoters },
        { label: "Passives", value: nps.passives },
        { label: "Detractors", value: nps.detractors },
      ],
      kpi: { value: nps.score, label: "NPS" },
      nps: {
        score: nps.score,
        promoters: nps.promoters,
        passives: nps.passives,
        detractors: nps.detractors,
        confidenceInterval95: nps.confidenceInterval95,
      },
    };
  }

  if (metric === "csat") {
    const csat = computeCsat(numericValues);
    return {
      ...buildResultBase(definition, csat?.sampleSize ?? 0, "csat", `Survey ${definition.dataset.surveyId}`),
      points: [],
      kpi: csat ? { value: csat.score, label: "CSAT %", secondary: csat.sampleSize, secondaryLabel: "n" } : undefined,
    };
  }

  if (metric === "ces") {
    const ces = computeCes(numericValues);
    return {
      ...buildResultBase(definition, ces?.sampleSize ?? 0, "ces", `Survey ${definition.dataset.surveyId}`),
      points: [],
      kpi: ces ? { value: ces.score, label: "CES", secondary: ces.sampleSize, secondaryLabel: "n" } : undefined,
    };
  }

  if (metric === "mean" || metric === "median") {
    const value = metric === "mean" ? mean(numericValues) : median(numericValues);
    return {
      ...buildResultBase(
        definition,
        numericValues.length,
        metric,
        `Survey ${definition.dataset.surveyId}`
      ),
      points: [],
      kpi:
        value === null
          ? undefined
          : { value, label: metric === "mean" ? "Mean" : "Median", secondary: numericValues.length, secondaryLabel: "n" },
    };
  }

  const dist = frequency(rawValues);
  return {
    ...buildResultBase(definition, dist.sampleSize, metric === "percentage" ? "percentage" : "distribution", `Survey ${definition.dataset.surveyId}`),
    points: dist.points.map((p) => ({
      ...p,
      percentage: definition.options.showPercentages === false ? undefined : p.percentage,
    })),
  };
};

const executeSurveyCrossTab = async (
  definition: TResearchChartDefinition & {
    dataset: Extract<TResearchChartDefinition["dataset"], { kind: "survey_cross_tab" }>;
  }
): Promise<TResearchChartResult> => {
  const responses = await loadSurveyResponses(definition.dataset.surveyId);
  const pairs: Array<{ row: string; column: string }> = [];

  for (const response of responses) {
    const rowValues = flattenAnswer(response.data[definition.dataset.rowElementId]).map(String);
    const colValues = flattenAnswer(response.data[definition.dataset.columnElementId]).map(String);
    for (const row of rowValues) {
      for (const column of colValues) {
        pairs.push({ row, column });
      }
    }
  }

  const tab = buildCrossTab(pairs);
  return {
    ...buildResultBase(definition, tab.sampleSize, "count", `Survey ${definition.dataset.surveyId} cross-tab`),
    points: [],
    crossTab: {
      rowLabels: tab.rowLabels,
      columnLabels: tab.columnLabels,
      matrix: tab.matrix,
      rowTotals: tab.rowTotals,
      columnTotals: tab.columnTotals,
    },
  };
};

const executeInterviewCodes = async (
  definition: TResearchChartDefinition & {
    dataset: Extract<TResearchChartDefinition["dataset"], { kind: "interview_codes" }>;
  }
): Promise<TResearchChartResult> => {
  const codes = await prisma.researchCode.findMany({
    where: { researchProjectId: definition.dataset.researchProjectId, mergedIntoId: null },
    include: { _count: { select: { segmentCodes: true } } },
    orderBy: { name: "asc" },
  });

  const points = codes
    .map((code) => ({
      label: code.name,
      value: code._count.segmentCodes,
      percentage: 0,
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  const sampleSize = points.reduce((acc, p) => acc + p.value, 0);
  const withPct = points.map((p) => ({
    ...p,
    percentage: sampleSize > 0 ? (p.value / sampleSize) * 100 : 0,
  }));

  return {
    ...buildResultBase(definition, sampleSize, "count", "Interview codes"),
    points: withPct,
  };
};

const executeDatasetField = async (
  definition: TResearchChartDefinition & {
    dataset: Extract<TResearchChartDefinition["dataset"], { kind: "dataset_field" }>;
  }
): Promise<TResearchChartResult> => {
  const dataset = await prisma.researchDataset.findUnique({
    where: { id: definition.dataset.datasetId },
  });
  if (!dataset) throw new ResourceNotFoundError("ResearchDataset", definition.dataset.datasetId);

  const rows = (Array.isArray(dataset.rows) ? dataset.rows : []) as Array<Record<string, unknown>>;
  const fieldId = definition.dataset.fieldId;
  const secondaryFieldId = definition.dataset.secondaryFieldId;
  const metric = definition.metrics[0] ?? "count";

  if (secondaryFieldId) {
    const pairs = rows
      .map((row) => ({
        row: String(row[fieldId] ?? ""),
        column: String(row[secondaryFieldId] ?? ""),
      }))
      .filter((p) => p.row && p.column);
    const tab = buildCrossTab(pairs);
    return {
      ...buildResultBase(definition, tab.sampleSize, "count", dataset.name),
      points: [],
      crossTab: {
        rowLabels: tab.rowLabels,
        columnLabels: tab.columnLabels,
        matrix: tab.matrix,
        rowTotals: tab.rowTotals,
        columnTotals: tab.columnTotals,
      },
    };
  }

  const rawValues = rows.flatMap((row) => flattenAnswer(row[fieldId]));
  const numericValues = rawValues.map(toNumber).filter((v): v is number => v !== null);

  if (metric === "nps") {
    const nps = computeNps(numericValues, definition.options.confidenceInterval === true);
    return {
      ...buildResultBase(definition, nps?.sampleSize ?? 0, "nps", dataset.name),
      points: nps
        ? [
            { label: "Promoters", value: nps.promoters },
            { label: "Passives", value: nps.passives },
            { label: "Detractors", value: nps.detractors },
          ]
        : [],
      kpi: nps ? { value: nps.score, label: "NPS" } : undefined,
      nps: nps
        ? {
            score: nps.score,
            promoters: nps.promoters,
            passives: nps.passives,
            detractors: nps.detractors,
            confidenceInterval95: nps.confidenceInterval95,
          }
        : undefined,
    };
  }

  if (metric === "mean" || metric === "median") {
    const value = metric === "mean" ? mean(numericValues) : median(numericValues);
    return {
      ...buildResultBase(definition, numericValues.length, metric, dataset.name),
      points: [],
      kpi: value === null ? undefined : { value, label: metric },
    };
  }

  const dist = frequency(rawValues);
  return {
    ...buildResultBase(definition, dist.sampleSize, "distribution", dataset.name),
    points: dist.points,
  };
};

export const executeChartDefinition = async (
  input: TResearchChartDefinition
): Promise<TResearchChartResult> => {
  const definition = ZResearchChartDefinition.parse(input);

  switch (definition.dataset.kind) {
    case "survey_element":
      return executeSurveyElement(definition as typeof definition & { dataset: Extract<typeof definition.dataset, { kind: "survey_element" }> });
    case "survey_cross_tab":
      return executeSurveyCrossTab(definition as typeof definition & { dataset: Extract<typeof definition.dataset, { kind: "survey_cross_tab" }> });
    case "interview_codes":
      return executeInterviewCodes(definition as typeof definition & { dataset: Extract<typeof definition.dataset, { kind: "interview_codes" }> });
    case "dataset_field":
      return executeDatasetField(definition as typeof definition & { dataset: Extract<typeof definition.dataset, { kind: "dataset_field" }> });
    default: {
      const _exhaustive: never = definition.dataset;
      return _exhaustive;
    }
  }
};

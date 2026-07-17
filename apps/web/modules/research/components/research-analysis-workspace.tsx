"use client";

import { createId } from "@paralleldrive/cuid2";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import {
  createResearchAnalysisBlockAction,
  deleteResearchAnalysisBlockAction,
  importResearchDatasetAction,
  listLinkedSurveyElementsAction,
  listResearchAnalysisBlocksAction,
  listResearchDatasetsAction,
  previewChartDefinitionAction,
  refreshResearchAnalysisBlockAction,
} from "@/modules/research/actions";
import type { TResearchChartDefinition, TResearchChartResult } from "@/modules/research/types/chart-definition";
import { recommendChartType } from "@/modules/research/types/chart-definition";

type LinkedSurvey = {
  surveyId: string;
  surveyName: string;
  elements: Array<{ id: string; headline: string; type: string }>;
};

type DatasetListItem = {
  id: string;
  name: string;
  rowCount: number;
  fields: Array<{ id: string; name: string; type: string }>;
};

type AnalysisBlockListItem = {
  id: string;
  title: string;
  description: string | null;
  analystComment: string | null;
  chartDefinition: TResearchChartDefinition;
  lastResult: TResearchChartResult | null;
  dataset: { id: string; name: string } | null;
  createdBy: { name: string } | null;
  updatedAt: string | Date;
};

interface ResearchAnalysisWorkspaceProps {
  researchProjectId: string;
  canEdit: boolean;
}

export const ResearchAnalysisWorkspace = ({
  researchProjectId,
  canEdit,
}: ResearchAnalysisWorkspaceProps) => {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<LinkedSurvey[]>([]);
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [blocks, setBlocks] = useState<AnalysisBlockListItem[]>([]);
  const [preview, setPreview] = useState<TResearchChartResult | null>(null);

  const [sourceKind, setSourceKind] = useState<"survey_element" | "survey_cross_tab" | "interview_codes" | "dataset_field">(
    "survey_element"
  );
  const [surveyId, setSurveyId] = useState("");
  const [elementId, setElementId] = useState("");
  const [rowElementId, setRowElementId] = useState("");
  const [columnElementId, setColumnElementId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [metric, setMetric] = useState("distribution");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [csvText, setCsvText] = useState("");

  const selectedSurvey = useMemo(
    () => surveys.find((s) => s.surveyId === surveyId) ?? null,
    [surveys, surveyId]
  );
  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === datasetId) ?? null,
    [datasets, datasetId]
  );

  const refreshLists = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const [surveyResult, datasetResult, blockResult] = await Promise.all([
        listLinkedSurveyElementsAction({ researchProjectId }),
        listResearchDatasetsAction({ researchProjectId }),
        listResearchAnalysisBlocksAction({ researchProjectId }),
      ]);
      if (surveyResult?.data) {
        setSurveys(surveyResult.data as LinkedSurvey[]);
        if (!surveyId && surveyResult.data[0]) {
          setSurveyId(surveyResult.data[0].surveyId);
          setElementId(surveyResult.data[0].elements[0]?.id ?? "");
        }
      }
      if (datasetResult?.data) {
        setDatasets(
          datasetResult.data.map((d) => ({
            id: d.id,
            name: d.name,
            rowCount: d.rowCount,
            fields: (Array.isArray(d.fields) ? d.fields : []) as DatasetListItem["fields"],
          }))
        );
      }
      if (blockResult?.data) {
        setBlocks(blockResult.data as unknown as AnalysisBlockListItem[]);
      }
    });
  }, [researchProjectId, surveyId]);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  const buildDefinition = (): TResearchChartDefinition | null => {
    const chartTitle = title.trim() || t("research.analysis.untitled");
    const base = {
      id: createId(),
      title: chartTitle,
      metrics: [metric as TResearchChartDefinition["metrics"][number]],
      filters: [],
      options: { showPercentages: true, showValues: true, legend: true },
    };

    if (sourceKind === "survey_element") {
      if (!surveyId || !elementId) return null;
      return {
        ...base,
        type: recommendChartType(8, metric as never),
        dataset: { kind: "survey_element", surveyId, elementId },
      };
    }
    if (sourceKind === "survey_cross_tab") {
      if (!surveyId || !rowElementId || !columnElementId) return null;
      return {
        ...base,
        type: "heatmap",
        dataset: { kind: "survey_cross_tab", surveyId, rowElementId, columnElementId },
        metrics: ["count"],
      };
    }
    if (sourceKind === "interview_codes") {
      return {
        ...base,
        type: "bar_horizontal",
        dataset: { kind: "interview_codes", researchProjectId },
        metrics: ["count"],
      };
    }
    if (!datasetId || !fieldId) return null;
    return {
      ...base,
      type: recommendChartType(8, metric as never),
      dataset: { kind: "dataset_field", datasetId, fieldId },
    };
  };

  const runPreview = () => {
    const definition = buildDefinition();
    if (!definition) {
      setError(t("research.analysis.incomplete_config"));
      return;
    }
    startTransition(async () => {
      const result = await previewChartDefinitionAction({
        researchProjectId,
        chartDefinition: definition,
      });
      if (result?.data) {
        setPreview(result.data);
        setError(null);
      } else {
        setError(t("research.errors.preview_failed"));
      }
    });
  };

  const saveBlock = () => {
    const definition = buildDefinition();
    if (!definition) {
      setError(t("research.analysis.incomplete_config"));
      return;
    }
    startTransition(async () => {
      const result = await createResearchAnalysisBlockAction({
        researchProjectId,
        title: definition.title,
        analystComment: comment.trim() || undefined,
        chartDefinition: definition,
      });
      if (result?.data) {
        setPreview(result.data.result);
        setTitle("");
        setComment("");
        refreshLists();
      } else {
        setError(t("research.errors.save_block_failed"));
      }
    });
  };

  const importCsv = () => {
    if (!datasetName.trim() || !csvText.trim()) return;
    startTransition(async () => {
      const result = await importResearchDatasetAction({
        researchProjectId,
        name: datasetName.trim(),
        sourceType: "csv",
        fileName: "import.csv",
        content: csvText,
      });
      if (result?.data) {
        setDatasetName("");
        setCsvText("");
        setDatasetId(result.data.id);
        setSourceKind("dataset_field");
        refreshLists();
      } else {
        setError(t("research.errors.dataset_import_failed"));
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("research.analysis.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("research.analysis.subtitle")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.analysis.builder")}</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-slate-500">{t("research.analysis.source")}</p>
              <Select value={sourceKind} onValueChange={(v) => setSourceKind(v as typeof sourceKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="survey_element">{t("research.analysis.source_survey")}</SelectItem>
                  <SelectItem value="survey_cross_tab">{t("research.analysis.source_crosstab")}</SelectItem>
                  <SelectItem value="interview_codes">{t("research.analysis.source_codes")}</SelectItem>
                  <SelectItem value="dataset_field">{t("research.analysis.source_dataset")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">{t("research.analysis.metric")}</p>
              <Select value={metric} onValueChange={setMetric} disabled={sourceKind === "survey_cross_tab" || sourceKind === "interview_codes"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["distribution", "percentage", "count", "mean", "median", "nps", "csat", "ces"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`research.analysis.metrics.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(sourceKind === "survey_element" || sourceKind === "survey_cross_tab") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={surveyId} onValueChange={(v) => {
                setSurveyId(v);
                const survey = surveys.find((s) => s.surveyId === v);
                setElementId(survey?.elements[0]?.id ?? "");
                setRowElementId(survey?.elements[0]?.id ?? "");
                setColumnElementId(survey?.elements[1]?.id ?? survey?.elements[0]?.id ?? "");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={t("research.analysis.select_survey")} />
                </SelectTrigger>
                <SelectContent>
                  {surveys.map((s) => (
                    <SelectItem key={s.surveyId} value={s.surveyId}>
                      {s.surveyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {sourceKind === "survey_element" ? (
                <Select value={elementId} onValueChange={setElementId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("research.analysis.select_question")} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSurvey?.elements.map((el) => (
                      <SelectItem key={el.id} value={el.id}>
                        {el.headline}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Select value={rowElementId} onValueChange={setRowElementId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("research.analysis.row_question")} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedSurvey?.elements.map((el) => (
                        <SelectItem key={el.id} value={el.id}>
                          {el.headline}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={columnElementId} onValueChange={setColumnElementId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("research.analysis.column_question")} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedSurvey?.elements.map((el) => (
                        <SelectItem key={el.id} value={el.id}>
                          {el.headline}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}

          {sourceKind === "dataset_field" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={datasetId} onValueChange={(v) => {
                setDatasetId(v);
                const ds = datasets.find((d) => d.id === v);
                setFieldId(ds?.fields[0]?.id ?? "");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={t("research.analysis.select_dataset")} />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.rowCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fieldId} onValueChange={setFieldId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("research.analysis.select_field")} />
                </SelectTrigger>
                <SelectContent>
                  {selectedDataset?.fields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("research.analysis.block_title_placeholder")}
          />
          <textarea
            className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("research.analysis.comment_placeholder")}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={isPending} onClick={runPreview}>
              {t("research.analysis.preview")}
            </Button>
            {canEdit && (
              <Button disabled={isPending} onClick={saveBlock}>
                {t("research.analysis.save_block")}
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.analysis.preview_result")}</h3>
          {!preview && <p className="mt-4 text-sm text-slate-500">{t("research.analysis.no_preview")}</p>}
          {preview && <ChartResultView result={preview} t={t} />}
        </section>
      </div>

      {canEdit && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.analysis.import_csv")}</h3>
          <p className="mt-1 text-xs text-slate-500">{t("research.analysis.import_hint")}</p>
          <Input
            className="mt-3"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder={t("research.analysis.dataset_name")}
          />
          <textarea
            className="mt-3 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-slate-500"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"segment,score,nps\nSMB,4,9\nEnterprise,5,10"}
          />
          <Button className="mt-3" disabled={isPending || !datasetName.trim() || !csvText.trim()} onClick={importCsv}>
            {t("research.analysis.import_csv")}
          </Button>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t("research.analysis.saved_blocks")}</h3>
        <ul className="mt-4 space-y-3">
          {blocks.length === 0 && (
            <li className="text-sm text-slate-500">{t("research.analysis.no_blocks")}</li>
          )}
          {blocks.map((block) => (
            <li key={block.id} className="rounded-lg border border-slate-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{block.title}</p>
                  <p className="text-xs text-slate-500">
                    {block.chartDefinition.type} · n=
                    {(block.lastResult as TResearchChartResult | null)?.sampleSize ?? "—"}
                    {(block.lastResult as TResearchChartResult | null)?.smallSampleWarning
                      ? ` · ${t("research.analysis.small_sample")}`
                      : ""}
                  </p>
                  {block.analystComment && (
                    <p className="mt-2 text-sm text-slate-600">{block.analystComment}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await refreshResearchAnalysisBlockAction({ blockId: block.id });
                          if (result?.data) {
                            setPreview(result.data.result);
                            refreshLists();
                          }
                        })
                      }>
                      {t("research.analysis.refresh")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteResearchAnalysisBlockAction({ blockId: block.id });
                          refreshLists();
                        })
                      }>
                      {t("common.delete")}
                    </Button>
                  </div>
                )}
              </div>
              {block.lastResult && (
                <div className="mt-3">
                  <ChartResultView result={block.lastResult as TResearchChartResult} t={t} compact />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};

const ChartResultView = ({
  result,
  t,
  compact = false,
}: {
  result: TResearchChartResult;
  t: (key: string) => string;
  compact?: boolean;
}) => (
  <div className={compact ? "mt-2" : "mt-4 space-y-3"}>
    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
      <span>
        n={result.sampleSize}
        {result.smallSampleWarning ? ` · ${t("research.analysis.small_sample")}` : ""}
      </span>
      <span>· {result.sourceLabel}</span>
      <span>· {result.metric}</span>
    </div>

    {result.kpi && (
      <div className="rounded-lg bg-slate-50 px-4 py-3">
        <p className="text-xs tracking-wide text-slate-500 uppercase">{result.kpi.label}</p>
        <p className="text-2xl font-semibold text-slate-900">{formatNumber(result.kpi.value)}</p>
      </div>
    )}

    {result.nps && (
      <p className="text-xs text-slate-500">
        P {result.nps.promoters} / Pass {result.nps.passives} / D {result.nps.detractors}
        {result.nps.confidenceInterval95
          ? ` · 95% CI [${formatNumber(result.nps.confidenceInterval95[0])}, ${formatNumber(result.nps.confidenceInterval95[1])}]`
          : ""}
      </p>
    )}

    {result.points.length > 0 && (
      <div className="space-y-2">
        {result.points.slice(0, compact ? 6 : 20).map((point) => (
          <div key={`${point.label}-${point.series ?? ""}`} className="text-sm">
            <div className="mb-1 flex justify-between gap-3 text-slate-700">
              <span>{point.label}</span>
              <span>
                {formatNumber(point.value)}
                {point.percentage !== undefined ? ` (${formatNumber(point.percentage)}%)` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-100">
              <div
                className="h-full rounded bg-slate-700"
                style={{
                  width: `${Math.min(100, point.percentage ?? (result.sampleSize ? (point.value / result.sampleSize) * 100 : 0))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    )}

    {result.crossTab && (
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-slate-500" />
              {result.crossTab.columnLabels.map((col) => (
                <th key={col} className="px-2 py-1 text-left text-slate-500">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.crossTab.rowLabels.map((row, rowIdx) => (
              <tr key={row} className="border-t border-slate-100">
                <td className="px-2 py-1 font-medium text-slate-700">{row}</td>
                {result.crossTab!.matrix[rowIdx].map((cell, colIdx) => (
                  <td key={`${row}-${colIdx}`} className="px-2 py-1 text-slate-600">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

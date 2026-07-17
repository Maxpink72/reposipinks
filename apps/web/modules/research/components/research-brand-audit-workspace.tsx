"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  getResearchBrandAuditAction,
  updateResearchBrandAuditAction,
  upsertBrandAuditAssessmentAction,
} from "@/modules/research/actions";
import { BrandAuditVisualizations } from "@/modules/research/components/brand-audit-visualizations";
import { computeWeightedAuditScore } from "@/modules/research/types/brand-audit";
import type { TResearchBrandAuditSwot } from "@/modules/research/types/brand-audit";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface ResearchBrandAuditWorkspaceProps {
  workspaceId: string;
  researchProjectId: string;
  // Serialized audit detail from server page
  initialAudit: any;
  canEdit: boolean;
}

const linesToList = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const listToLines = (items: string[]) => items.join("\n");

const asSwot = (raw: unknown): TResearchBrandAuditSwot => {
  const obj = (raw ?? {}) as Partial<TResearchBrandAuditSwot>;
  return {
    strengths: Array.isArray(obj.strengths) ? obj.strengths.map(String) : [],
    weaknesses: Array.isArray(obj.weaknesses) ? obj.weaknesses.map(String) : [],
    opportunities: Array.isArray(obj.opportunities) ? obj.opportunities.map(String) : [],
    threats: Array.isArray(obj.threats) ? obj.threats.map(String) : [],
  };
};

const asPositioning = (raw: unknown) => {
  const obj = (raw ?? {}) as {
    xAxisLabel?: string;
    yAxisLabel?: string;
    points?: Array<{ id: string; label: string; x: number; y: number; isOwnBrand?: boolean }>;
  };
  return {
    xAxisLabel: obj.xAxisLabel || "Price",
    yAxisLabel: obj.yAxisLabel || "Quality",
    points: Array.isArray(obj.points) ? obj.points : [],
  };
};

const asCompetitive = (raw: unknown) => {
  const obj = (raw ?? {}) as {
    competitors?: string[];
    rows?: Array<{ criterion: string; scores: number[] }>;
  };
  return {
    competitors: Array.isArray(obj.competitors) ? obj.competitors : [],
    rows: Array.isArray(obj.rows) ? obj.rows : [],
  };
};

export const ResearchBrandAuditWorkspace = ({
  workspaceId,
  researchProjectId,
  initialAudit,
  canEdit,
}: ResearchBrandAuditWorkspaceProps) => {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [audit, setAudit] = useState(initialAudit);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const swot = useMemo(() => asSwot(audit.swot), [audit.swot]);
  const positioning = useMemo(() => asPositioning(audit.positioningMatrix), [audit.positioningMatrix]);
  const competitive = useMemo(() => asCompetitive(audit.competitiveMatrix), [audit.competitiveMatrix]);

  const [swotDraft, setSwotDraft] = useState(swot);
  const [xLabel, setXLabel] = useState(positioning.xAxisLabel);
  const [yLabel, setYLabel] = useState(positioning.yAxisLabel);
  const [pointsText, setPointsText] = useState(
    positioning.points.map((p) => `${p.label};${p.x};${p.y};${p.isOwnBrand ? "1" : "0"}`).join("\n")
  );
  const [competitorsText, setCompetitorsText] = useState(competitive.competitors.join(", "));
  const [matrixText, setMatrixText] = useState(
    competitive.rows.map((r) => `${r.criterion};${r.scores.join(",")}`).join("\n")
  );

  const assessmentByCriterion = useMemo(() => {
    const map = new Map<string, { score: number; comment: string }>();
    for (const a of audit.assessments) {
      map.set(a.criterionId, { score: a.score, comment: a.comment ?? "" });
    }
    return map;
  }, [audit.assessments]);

  const scoreSummary = computeWeightedAuditScore(
    audit.assessments.map((a) => ({
      score: a.score,
      weight: a.criterion.weight,
      maxScore: a.criterion.maxScore,
    }))
  );

  const radarData = audit.criteria.map((c) => ({
    criterion: c.name,
    score: assessmentByCriterion.get(c.id)?.score ?? 0,
    fullMark: c.maxScore,
  }));

  const listHref = `/workspaces/${workspaceId}/research/${researchProjectId}/brand-audit`;

  const reload = async () => {
    const result = await getResearchBrandAuditAction({ brandAuditId: audit.id });
    if (result?.data) setAudit(result.data);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={listHref} className="text-xs text-slate-500 hover:text-slate-700">
            ← {t("research.brand_audit.back_to_list")}
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{audit.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(`research.brand_audit.status.${audit.status}`)} · {t("research.brand_audit.score")}:{" "}
            {scoreSummary.average}/{scoreSummary.maxAverage} (
            {Math.round(scoreSummary.weightedAverage * 100)}% {t("research.brand_audit.weighted")})
          </p>
        </div>
        {canEdit && (
          <Select
            value={audit.status}
            onValueChange={(status) => {
              startTransition(async () => {
                const result = await updateResearchBrandAuditAction({
                  brandAuditId: audit.id,
                  status: status as "draft" | "in_progress" | "completed" | "archived",
                });
                if (result?.data) setAudit(result.data);
              });
            }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["draft", "in_progress", "completed", "archived"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`research.brand_audit.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <BrandAuditVisualizations
        radarData={radarData}
        swot={swot}
        positioning={positioning}
        labels={{
          strengths: t("research.brand_audit.swot.strengths"),
          weaknesses: t("research.brand_audit.swot.weaknesses"),
          opportunities: t("research.brand_audit.swot.opportunities"),
          threats: t("research.brand_audit.swot.threats"),
          radarEmpty: t("research.brand_audit.radar_empty"),
        }}
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{t("research.brand_audit.criterion")}</th>
              <th className="px-4 py-3">{t("research.brand_audit.category")}</th>
              <th className="px-4 py-3">{t("research.brand_audit.score")}</th>
              <th className="px-4 py-3">{t("research.brand_audit.comment")}</th>
            </tr>
          </thead>
          <tbody>
            {audit.criteria.map((criterion) => {
              const current = assessmentByCriterion.get(criterion.id);
              return (
                <tr key={criterion.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{criterion.name}</p>
                    {criterion.description ? (
                      <p className="text-xs text-slate-500">{criterion.description}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{criterion.category}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={current?.score ? String(current.score) : undefined}
                      disabled={!canEdit || isPending}
                      onValueChange={(v) => {
                        startTransition(async () => {
                          setError(null);
                          const result = await upsertBrandAuditAssessmentAction({
                            brandAuditId: audit.id,
                            criterionId: criterion.id,
                            score: Number(v),
                            comment: current?.comment,
                          });
                          if (result?.serverError) {
                            setError(t("research.errors.assess_brand_audit_failed"));
                            return;
                          }
                          await reload();
                          setMessage(t("research.brand_audit.saved"));
                        });
                      }}>
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: criterion.maxScore }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      defaultValue={current?.comment ?? ""}
                      disabled={!canEdit}
                      placeholder={t("research.brand_audit.comment_placeholder")}
                      onBlur={(e) => {
                        if (!canEdit || !current?.score) return;
                        const nextComment = e.target.value;
                        startTransition(async () => {
                          await upsertBrandAuditAssessmentAction({
                            brandAuditId: audit.id,
                            criterionId: criterion.id,
                            score: current.score,
                            comment: nextComment,
                          });
                        });
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">{t("research.brand_audit.edit_swot")}</h3>
            {(
              [
                ["strengths", t("research.brand_audit.swot.strengths")],
                ["weaknesses", t("research.brand_audit.swot.weaknesses")],
                ["opportunities", t("research.brand_audit.swot.opportunities")],
                ["threats", t("research.brand_audit.swot.threats")],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <p className="mb-1 text-xs text-slate-500">{label}</p>
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={listToLines(swotDraft[key])}
                  onChange={(e) =>
                    setSwotDraft((prev) => ({ ...prev, [key]: linesToList(e.target.value) }))
                  }
                />
              </div>
            ))}
            <Button
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await updateResearchBrandAuditAction({
                    brandAuditId: audit.id,
                    swot: swotDraft,
                  });
                  if (result?.data) {
                    setAudit(result.data);
                    setMessage(t("research.brand_audit.saved"));
                  }
                });
              }}>
              {t("research.brand_audit.save_swot")}
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">{t("research.brand_audit.edit_positioning")}</h3>
            <div className="flex gap-2">
              <Input value={xLabel} onChange={(e) => setXLabel(e.target.value)} placeholder="X" />
              <Input value={yLabel} onChange={(e) => setYLabel(e.target.value)} placeholder="Y" />
            </div>
            <p className="text-xs text-slate-500">{t("research.brand_audit.positioning_hint")}</p>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={pointsText}
              onChange={(e) => setPointsText(e.target.value)}
            />
            <h3 className="pt-2 text-sm font-semibold">{t("research.brand_audit.edit_competitive")}</h3>
            <Input
              value={competitorsText}
              onChange={(e) => setCompetitorsText(e.target.value)}
              placeholder={t("research.brand_audit.competitors_placeholder")}
            />
            <p className="text-xs text-slate-500">{t("research.brand_audit.competitive_hint")}</p>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={matrixText}
              onChange={(e) => setMatrixText(e.target.value)}
            />
            <Button
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  const points = linesToList(pointsText).map((line, index) => {
                    const [label, x, y, own] = line.split(";").map((s) => s.trim());
                    return {
                      id: `p${index}`,
                      label: label || `Point ${index + 1}`,
                      x: Number(x) || 50,
                      y: Number(y) || 50,
                      isOwnBrand: own === "1",
                    };
                  });
                  const competitors = competitorsText
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const rows = linesToList(matrixText).map((line) => {
                    const [criterion, scoresRaw = ""] = line.split(";");
                    const scores = scoresRaw
                      .split(",")
                      .map((s) => Number(s.trim()))
                      .filter((n) => !Number.isNaN(n));
                    return { criterion: criterion.trim(), scores };
                  });
                  const result = await updateResearchBrandAuditAction({
                    brandAuditId: audit.id,
                    positioningMatrix: { xAxisLabel: xLabel, yAxisLabel: yLabel, points },
                    competitiveMatrix: { competitors, rows },
                  });
                  if (result?.data) {
                    setAudit(result.data);
                    setMessage(t("research.brand_audit.saved"));
                  }
                });
              }}>
              {t("research.brand_audit.save_matrices")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

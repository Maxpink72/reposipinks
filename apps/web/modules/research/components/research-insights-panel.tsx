"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
import { createResearchInsightAction, listResearchInsightsAction } from "@/modules/research/actions";
import type { TResearchInsightDetail } from "@/modules/research/lib/insights";
import type { TResearchInsightImportance, TResearchInsightType } from "@/modules/research/types";

const TYPES: TResearchInsightType[] = [
  "finding",
  "pattern",
  "tension",
  "need",
  "motivation",
  "barrier",
  "opportunity",
  "hypothesis",
  "recommendation",
];

const IMPORTANCE: TResearchInsightImportance[] = ["low", "medium", "high", "critical"];

interface ResearchInsightsPanelProps {
  researchProjectId: string;
  canCreate: boolean;
}

export const ResearchInsightsPanel = ({ researchProjectId, canCreate }: ResearchInsightsPanelProps) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TResearchInsightDetail[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [importance, setImportance] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newType, setNewType] = useState<TResearchInsightType>("finding");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const result = await listResearchInsightsAction({
        researchProjectId,
        search: search.trim() || undefined,
        type: type === "all" ? undefined : (type as TResearchInsightType),
        importance: importance === "all" ? undefined : (importance as TResearchInsightImportance),
      });
      if (result?.data) {
        setItems(result.data as TResearchInsightDetail[]);
      } else {
        setError(t("research.errors.load_insights_failed"));
      }
    });
  }, [researchProjectId, search, type, importance, t]);

  useEffect(() => {
    const timeout = setTimeout(load, 200);
    return () => clearTimeout(timeout);
  }, [load]);

  const createInsight = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createResearchInsightAction({
        researchProjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        type: newType,
      });
      if (result?.data) {
        setTitle("");
        setDescription("");
        load();
      } else {
        setError(t("research.errors.create_insight_failed"));
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("research.insights.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("research.insights.subtitle")}</p>
      </div>

      {canCreate && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.insights.create")}</h3>
          <div className="mt-3 space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("research.insights.title_placeholder")}
            />
            <textarea
              className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("research.insights.description_placeholder")}
            />
            <Select value={newType} onValueChange={(v) => setNewType(v as TResearchInsightType)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`research.insight_type.${item}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={isPending || !title.trim()} onClick={createInsight}>
              {t("research.insights.create")}
            </Button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          className="min-w-[200px] flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("research.insights.search_placeholder")}
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("research.insights.all_types")}</SelectItem>
            {TYPES.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`research.insight_type.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={importance} onValueChange={setImportance}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("research.insights.all_importance")}</SelectItem>
            {IMPORTANCE.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`research.insight_importance.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="space-y-3">
        {items.length === 0 && !isPending && (
          <li className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            {t("research.insights.empty")}
          </li>
        )}
        {items.map((insight) => (
          <li key={insight.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-slate-900">{insight.title}</h3>
                {insight.description && <p className="mt-2 text-sm text-slate-600">{insight.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  {t(`research.insight_type.${insight.type}`)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  {t(`research.insight_importance.${insight.importance}`)}
                </span>
                {insight.isAiGenerated && (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                    {t("research.ai.generated_badge")}
                    {!insight.isHumanConfirmed ? ` · ${t("research.ai.needs_confirmation")}` : ""}
                  </span>
                )}
              </div>
            </div>
            {insight.evidence.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {t("research.insights.evidence")}
                </p>
                <ul className="mt-2 space-y-2">
                  {insight.evidence.map((ev) => (
                    <li key={ev.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {ev.quoteText && <p className="italic">&ldquo;{ev.quoteText}&rdquo;</p>}
                      <p className="mt-1 text-xs text-slate-500">
                        {ev.interview?.name ?? t("research.insights.no_interview")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-400">
              {insight.author?.name ?? t("research.activity.system")} ·{" "}
              {new Date(insight.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};

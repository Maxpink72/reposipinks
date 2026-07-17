"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  linkSurveyToResearchProjectAction,
  listLinkableSurveysAction,
  unlinkSurveyFromResearchProjectAction,
} from "@/modules/research/actions";
import type { TResearchProjectDetail } from "@/modules/research/lib/projects";

interface ResearchSurveysPanelProps {
  workspaceId: string;
  organizationId: string;
  project: TResearchProjectDetail;
  canLink: boolean;
}

type LinkableSurvey = {
  id: string;
  name: string;
  status: string;
  type: string;
  workspaceId: string;
};

export const ResearchSurveysPanel = ({
  workspaceId,
  organizationId,
  project,
  canLink,
}: ResearchSurveysPanelProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<LinkableSurvey[]>([]);
  const [isPending, startTransition] = useTransition();
  const [linked, setLinked] = useState(project.surveys);

  useEffect(() => {
    if (!canLink) return;
    startTransition(async () => {
      const result = await listLinkableSurveysAction({
        organizationId,
        search: search.trim() || undefined,
      });
      if (result?.data) {
        setCandidates(result.data as LinkableSurvey[]);
      }
    });
  }, [organizationId, search, canLink]);

  const linkedIds = new Set(linked.map((l) => l.surveyId));

  const linkSurvey = async (surveyId: string) => {
    const result = await linkSurveyToResearchProjectAction({
      researchProjectId: project.id,
      surveyId,
    });
    if (result?.data) {
      const survey = candidates.find((c) => c.id === surveyId);
      if (survey) {
        setLinked((prev) => [
          {
            id: `temp-${surveyId}`,
            createdAt: new Date(),
            researchProjectId: project.id,
            surveyId,
            addedById: null,
            survey: {
              id: survey.id,
              name: survey.name,
              status: survey.status as never,
              type: survey.type as never,
              updatedAt: new Date(),
            },
          },
          ...prev,
        ]);
      }
    }
  };

  const unlinkSurvey = async (surveyId: string) => {
    const result = await unlinkSurveyFromResearchProjectAction({
      researchProjectId: project.id,
      surveyId,
    });
    if (result?.data) {
      setLinked((prev) => prev.filter((l) => l.surveyId !== surveyId));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("research.surveys.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("research.surveys.subtitle")}</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t("research.surveys.linked")}</h3>
        <ul className="mt-4 divide-y divide-slate-100">
          {linked.length === 0 && <li className="py-3 text-sm text-slate-500">{t("research.surveys.empty")}</li>}
          {linked.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <Link
                  href={`/workspaces/${workspaceId}/surveys/${link.surveyId}/summary`}
                  className="font-medium text-slate-900 hover:underline">
                  {link.survey.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {link.survey.status} · {link.survey.type}
                </p>
              </div>
              {canLink && (
                <Button variant="outline" size="sm" onClick={() => void unlinkSurvey(link.surveyId)}>
                  {t("research.surveys.unlink")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canLink && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.surveys.link_existing")}</h3>
          <Input
            className="mt-3"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("research.surveys.search_placeholder")}
          />
          <ul className="mt-4 divide-y divide-slate-100">
            {isPending && <li className="py-3 text-sm text-slate-500">{t("common.loading")}</li>}
            {!isPending &&
              candidates
                .filter((c) => !linkedIds.has(c.id))
                .map((survey) => (
                  <li key={survey.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{survey.name}</p>
                      <p className="text-xs text-slate-500">
                        {survey.status} · {survey.type}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => void linkSurvey(survey.id)}>
                      {t("research.surveys.link")}
                    </Button>
                  </li>
                ))}
          </ul>
        </section>
      )}
    </div>
  );
};

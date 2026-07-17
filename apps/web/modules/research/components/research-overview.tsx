"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { TResearchProjectDetail } from "@/modules/research/lib/projects";

interface ResearchOverviewProps {
  workspaceId: string;
  project: TResearchProjectDetail;
  responseCount: number;
  interviewCount: number;
  insightCount: number;
}

export const ResearchOverview = ({
  workspaceId,
  project,
  responseCount,
  interviewCount,
  insightCount,
}: ResearchOverviewProps) => {
  const { t } = useTranslation();

  const goals = Array.isArray(project.goals) ? project.goals : [];
  const questions = Array.isArray(project.researchQuestions) ? project.researchQuestions : [];
  const hypotheses = Array.isArray(project.hypotheses) ? project.hypotheses : [];
  const methods = Array.isArray(project.methods) ? project.methods : [];

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label={t("common.status")} value={t(`research.status.${project.status}`)} />
        <StatCard label={t("research.fields.surveys")} value={String(project._count.surveys)} />
        <StatCard label={t("research.fields.responses")} value={String(responseCount)} />
        <StatCard label={t("research.fields.interviews")} value={String(interviewCount)} />
        <StatCard label={t("research.fields.insights")} value={String(insightCount)} />
        <StatCard label={t("research.fields.members")} value={String(project._count.members)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">{t("research.overview.context")}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label={t("research.fields.client")} value={project.client?.name} />
            <Row label={t("research.fields.brand")} value={project.brand?.name} />
            <Row label={t("research.fields.type")} value={project.researchType} />
            <Row label={t("research.fields.owner")} value={project.owner.name} />
            <Row
              label={t("research.fields.timeline")}
              value={
                project.startsAt || project.endsAt
                  ? `${project.startsAt ? new Date(project.startsAt).toLocaleDateString() : "—"} → ${
                      project.endsAt ? new Date(project.endsAt).toLocaleDateString() : "—"
                    }`
                  : null
              }
            />
          </dl>
          {project.description && <p className="mt-4 text-sm text-slate-600">{project.description}</p>}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">{t("research.overview.methods")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {methods.length === 0 && <p className="text-sm text-slate-500">{t("research.overview.no_methods")}</p>}
            {methods.map((method) => (
              <span key={String(method)} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {t(`research.methods.${String(method)}`, { defaultValue: String(method) })}
              </span>
            ))}
          </div>
          <div className="mt-6">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {t("research.tabs.surveys")}
            </h3>
            <ul className="mt-2 space-y-2">
              {project.surveys.length === 0 && (
                <li className="text-sm text-slate-500">{t("research.surveys.empty")}</li>
              )}
              {project.surveys.slice(0, 5).map((link) => (
                <li key={link.id}>
                  <Link
                    className="text-sm text-slate-800 underline-offset-2 hover:underline"
                    href={`/workspaces/${workspaceId}/surveys/${link.surveyId}/summary`}>
                    {link.survey.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ListBlock title={t("research.overview.goals")} items={goals.map((g) => ("text" in (g as object) ? String((g as { text: string }).text) : String(g)))} empty={t("research.overview.no_goals")} />
        <ListBlock
          title={t("research.overview.questions")}
          items={questions.map((q) => ("text" in (q as object) ? String((q as { text: string }).text) : String(q)))}
          empty={t("research.overview.no_questions")}
        />
        <ListBlock
          title={t("research.overview.hypotheses")}
          items={hypotheses.map((h) => ("text" in (h as object) ? String((h as { text: string }).text) : String(h)))}
          empty={t("research.overview.no_hypotheses")}
        />
      </div>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p>
    <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
  </div>
);

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-right text-slate-900">{value || "—"}</dd>
  </div>
);

const ListBlock = ({ title, items, empty }: { title: string; items: string[]; empty: string }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    {items.length === 0 ? (
      <p className="mt-3 text-sm text-slate-500">{empty}</p>
    ) : (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )}
  </section>
);

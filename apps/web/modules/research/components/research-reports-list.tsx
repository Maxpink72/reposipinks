"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { createResearchReportAction, deleteResearchReportAction } from "@/modules/research/actions";

type ReportListItem = {
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  updatedAt: string | Date;
  theme: { id: string; name: string } | null;
  createdBy: { name: string } | null;
  _count: { blocks: number; versions: number };
};

interface ResearchReportsListProps {
  workspaceId: string;
  researchProjectId: string;
  initialReports: ReportListItem[];
  canEdit: boolean;
}

export const ResearchReportsList = ({
  workspaceId,
  researchProjectId,
  initialReports,
  canEdit,
}: ResearchReportsListProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reports, setReports] = useState(initialReports);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const base = `/workspaces/${workspaceId}/research/${researchProjectId}/reports`;

  const onCreate = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      setError(null);
      const result = await createResearchReportAction({
        researchProjectId,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
      });
      if (result?.serverError || result?.validationErrors) {
        setError(t("research.errors.create_report_failed"));
        return;
      }
      const created = result?.data;
      if (created?.id) {
        router.push(`${base}/${created.id}`);
        return;
      }
      setError(t("research.errors.create_report_failed"));
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("research.reports.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("research.reports.subtitle")}</p>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="min-w-[200px] flex-1">
            <p className="mb-1 text-xs text-slate-500">{t("research.reports.new_title")}</p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("research.reports.new_title_placeholder")}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <p className="mb-1 text-xs text-slate-500">{t("research.reports.new_subtitle")}</p>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={t("research.reports.new_subtitle_placeholder")}
            />
          </div>
          <Button onClick={onCreate} disabled={isPending || !title.trim()}>
            {t("research.reports.create")}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {reports.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500">{t("research.reports.empty")}</li>
        )}
        {reports.map((report) => (
          <li key={report.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <Link href={`${base}/${report.id}`} className="font-medium text-slate-900 hover:underline">
                {report.title}
              </Link>
              <p className="mt-0.5 text-xs text-slate-500">
                {t(`research.reports.status.${report.status}`)} · {report._count.blocks}{" "}
                {t("research.reports.blocks_count")} · {report._count.versions}{" "}
                {t("research.reports.versions_count")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`${base}/${report.id}`}>{t("research.reports.open")}</Link>
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await deleteResearchReportAction({ reportId: report.id });
                      setReports((prev) => prev.filter((r) => r.id !== report.id));
                    });
                  }}>
                  {t("common.delete")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

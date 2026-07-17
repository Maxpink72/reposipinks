"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { InterviewCodingWorkspace } from "@/modules/research/components/interview-coding-workspace";
import {
  getCodingMatrixAction,
  getResearchInterviewAction,
  listResearchCodesAction,
} from "@/modules/research/actions";
import type { TResearchInterviewDetail } from "@/modules/research/lib/interviews";

interface InterviewDetailPageClientProps {
  workspaceId: string;
  researchProjectId: string;
  interviewId: string;
  canEdit: boolean;
  canCreateInsights: boolean;
}

export const InterviewDetailPageClient = ({
  workspaceId,
  researchProjectId,
  interviewId,
  canEdit,
  canCreateInsights,
}: InterviewDetailPageClientProps) => {
  const { t } = useTranslation();
  const [interview, setInterview] = useState<TResearchInterviewDetail | null>(null);
  const [codes, setCodes] = useState<
    Array<{ id: string; name: string; color: string; description: string | null; _count: { segmentCodes: number } }>
  >([]);
  const [matrix, setMatrix] = useState<{
    themeByInterview: Array<{
      code: { id: string; name: string; color: string };
      interviews: Array<{ interviewId: string; interviewName: string; count: number }>;
    }>;
    codeFrequencies: Array<{ codeId: string; count: number }>;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const [interviewResult, codesResult, matrixResult] = await Promise.all([
        getResearchInterviewAction({ interviewId }),
        listResearchCodesAction({ researchProjectId }),
        getCodingMatrixAction({ researchProjectId }),
      ]);
      if (interviewResult?.data) setInterview(interviewResult.data as TResearchInterviewDetail);
      if (codesResult?.data) setCodes(codesResult.data as typeof codes);
      if (matrixResult?.data) {
        setMatrix({
          themeByInterview: matrixResult.data.themeByInterview,
          codeFrequencies: matrixResult.data.codeFrequencies,
        });
      }
    });
  }, [interviewId, researchProjectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!interview && isPending) {
    return <p className="p-6 text-sm text-slate-500">{t("common.loading")}</p>;
  }

  if (!interview) {
    return <p className="p-6 text-sm text-red-600">{t("research.errors.interview_not_found")}</p>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href={`/workspaces/${workspaceId}/research/${researchProjectId}/interviews`}
          className="text-xs text-slate-500 hover:text-slate-700">
          ← {t("research.tabs.interviews")}
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">{interview.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {t(`research.interview_status.${interview.status}`)}
          {interview.respondentName ? ` · ${interview.respondentName}` : ""}
          {interview.respondentSegment ? ` · ${interview.respondentSegment}` : ""}
        </p>
      </div>

      <InterviewCodingWorkspace
        researchProjectId={researchProjectId}
        interview={interview}
        codes={codes}
        canEdit={canEdit}
        canCreateInsights={canCreateInsights}
        onRefresh={refresh}
      />

      {matrix && matrix.themeByInterview.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.coding.matrix_theme_interview")}</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-2">{t("research.coding.codes")}</th>
                  {matrix.themeByInterview[0]?.interviews.map((col) => (
                    <th key={col.interviewId} className="px-2 py-2 font-medium">
                      {col.interviewName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.themeByInterview.map((row) => (
                  <tr key={row.code.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-800">
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: row.code.color }}
                      />
                      {row.code.name}
                    </td>
                    {row.interviews.map((cell) => (
                      <td key={cell.interviewId} className="px-2 py-2 text-slate-600">
                        {cell.count || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

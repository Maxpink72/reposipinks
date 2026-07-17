"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { updateResearchProjectAction } from "@/modules/research/actions";

interface ResearchSettingsPanelProps {
  workspaceId: string;
  researchProjectId: string;
  canArchive: boolean;
  status: string;
}

export const ResearchSettingsPanel = ({
  workspaceId,
  researchProjectId,
  canArchive,
  status,
}: ResearchSettingsPanelProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const archive = () => {
    startTransition(async () => {
      const result = await updateResearchProjectAction({
        researchProjectId,
        data: { status: "archived" },
      });
      if (result?.data) {
        router.push(`/workspaces/${workspaceId}/research`);
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("research.tabs.settings")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("research.settings.subtitle")}</p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t("research.settings.archive_title")}</h3>
        <p className="mt-2 text-sm text-slate-500">{t("research.settings.archive_description")}</p>
        {canArchive && status !== "archived" && (
          <Button className="mt-4" variant="destructive" disabled={isPending} onClick={archive}>
            {t("research.settings.archive_action")}
          </Button>
        )}
        {status === "archived" && (
          <p className="mt-4 text-sm text-slate-600">{t("research.settings.already_archived")}</p>
        )}
      </section>
    </div>
  );
};

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

const TABS = [
  "overview",
  "plan",
  "surveys",
  "interviews",
  "brand-audit",
  "analysis",
  "insights",
  "reports",
  "activity",
  "settings",
] as const;

interface ResearchProjectTabsProps {
  workspaceId: string;
  researchProjectId: string;
  projectName: string;
}

export const ResearchProjectTabs = ({
  workspaceId,
  researchProjectId,
  projectName,
}: ResearchProjectTabsProps) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}/research/${researchProjectId}`;

  return (
    <div className="border-b border-slate-200 bg-white px-6 pt-6">
      <div className="mb-4">
        <Link href={`/workspaces/${workspaceId}/research`} className="text-xs text-slate-500 hover:text-slate-700">
          ← {t("research.title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{projectName}</h1>
      </div>
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const href = tab === "overview" ? base : `${base}/${tab}`;
          const isActive =
            tab === "overview"
              ? pathname === base || pathname === `${base}/`
              : pathname?.startsWith(`${base}/${tab}`);
          return (
            <Link
              key={tab}
              href={href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}>
              {t(`research.tabs.${tab}`)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  createResearchBrandAuditAction,
  deleteResearchBrandAuditAction,
} from "@/modules/research/actions";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

type AuditListItem = {
  id: string;
  name: string;
  status: string;
  templateKey: string;
  brand: { id: string; name: string } | null;
  _count: { criteria: number; assessments: number };
  updatedAt: string | Date;
};

interface ResearchBrandAuditsListProps {
  workspaceId: string;
  researchProjectId: string;
  initialAudits: AuditListItem[];
  canEdit: boolean;
}

export const ResearchBrandAuditsList = ({
  workspaceId,
  researchProjectId,
  initialAudits,
  canEdit,
}: ResearchBrandAuditsListProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [audits, setAudits] = useState(initialAudits);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const base = `/workspaces/${workspaceId}/research/${researchProjectId}/brand-audit`;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("research.brand_audit.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("research.brand_audit.subtitle")}</p>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="min-w-[220px] flex-1">
            <p className="mb-1 text-xs text-slate-500">{t("research.brand_audit.new_name")}</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("research.brand_audit.new_name_placeholder")}
            />
          </div>
          <Button
            disabled={isPending || !name.trim()}
            onClick={() => {
              startTransition(async () => {
                setError(null);
                const result = await createResearchBrandAuditAction({
                  researchProjectId,
                  name: name.trim(),
                });
                if (result?.serverError || !result?.data) {
                  setError(t("research.errors.create_brand_audit_failed"));
                  return;
                }
                router.push(`${base}/${result.data.id}`);
              });
            }}>
            {t("research.brand_audit.create")}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {audits.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500">{t("research.brand_audit.empty")}</li>
        )}
        {audits.map((audit) => (
          <li key={audit.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <Link href={`${base}/${audit.id}`} className="font-medium text-slate-900 hover:underline">
                {audit.name}
              </Link>
              <p className="mt-0.5 text-xs text-slate-500">
                {t(`research.brand_audit.status.${audit.status}`)} · {audit._count.assessments}/
                {audit._count.criteria} {t("research.brand_audit.scored")}
                {audit.brand ? ` · ${audit.brand.name}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`${base}/${audit.id}`}>{t("research.brand_audit.open")}</Link>
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await deleteResearchBrandAuditAction({ brandAuditId: audit.id });
                      setAudits((prev) => prev.filter((a) => a.id !== audit.id));
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

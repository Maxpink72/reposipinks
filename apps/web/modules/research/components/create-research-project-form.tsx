"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { createResearchProjectAction } from "@/modules/research/actions";
import type { TResearchMethodType } from "@/modules/research/types";

const METHOD_OPTIONS: TResearchMethodType[] = [
  "quantitative_survey",
  "depth_interview",
  "brand_audit",
  "brand_perception",
  "concept_test",
  "desk_research",
];

interface CreateResearchProjectFormProps {
  workspaceId: string;
  organizationId: string;
}

export const CreateResearchProjectForm = ({
  workspaceId,
  organizationId,
}: CreateResearchProjectFormProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [researchType, setResearchType] = useState("");
  const [clientName, setClientName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [method, setMethod] = useState<TResearchMethodType>("quantitative_survey");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const result = await createResearchProjectAction({
        organizationId,
        workspaceId,
        name: name.trim(),
        description: description.trim() || undefined,
        researchType: researchType.trim() || undefined,
        clientName: clientName.trim() || undefined,
        brandName: brandName.trim() || undefined,
        methods: [method],
      });

      if (result?.data?.id) {
        router.push(`/workspaces/${workspaceId}/research/${result.data.id}`);
        return;
      }
      setError(t("research.errors.create_failed"));
    });
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t("research.create.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("research.create.subtitle")}</p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t("common.name")}</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("research.create.name_placeholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">{t("common.description")}</Label>
          <textarea
            id="description"
            className="focus:border-brand-dark min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("research.create.description_placeholder")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client">{t("research.fields.client")}</Label>
            <Input
              id="client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t("research.create.client_placeholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand">{t("research.fields.brand")}</Label>
            <Input
              id="brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={t("research.create.brand_placeholder")}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="researchType">{t("research.fields.type")}</Label>
            <Input
              id="researchType"
              value={researchType}
              onChange={(e) => setResearchType(e.target.value)}
              placeholder={t("research.create.type_placeholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("research.fields.primary_method")}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as TResearchMethodType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`research.methods.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? t("common.loading") : t("research.actions.create")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
};

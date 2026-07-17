"use client";

import { FlaskConicalIcon, PlusIcon, SearchIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
import { listResearchProjectsAction, updateResearchProjectAction } from "@/modules/research/actions";
import type { TResearchProjectListItem } from "@/modules/research/lib/projects";
import type { TResearchProjectStatus } from "@/modules/research/types";

const STATUS_OPTIONS: TResearchProjectStatus[] = [
  "draft",
  "planning",
  "recruiting",
  "fieldwork",
  "analysis",
  "reporting",
  "completed",
  "archived",
];

interface ResearchProjectsListProps {
  workspaceId: string;
  organizationId: string;
  isReadOnly: boolean;
}

export const ResearchProjectsList = ({
  workspaceId,
  organizationId,
  isReadOnly,
}: ResearchProjectsListProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<TResearchProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const result = await listResearchProjectsAction({
        organizationId,
        search: search.trim() || undefined,
        status: status === "all" ? undefined : (status as TResearchProjectStatus),
        isFavorite: favoritesOnly ? true : undefined,
        includeArchived,
        sortBy: "updatedAt",
        sortOrder: "desc",
        page: 1,
        pageSize: 50,
      });

      if (result?.data) {
        setItems(result.data.items);
        setTotal(result.data.total);
      } else {
        setError(t("research.errors.load_failed"));
      }
    });
  }, [organizationId, search, status, favoritesOnly, includeArchived, t]);

  useEffect(() => {
    const timeout = setTimeout(load, 200);
    return () => clearTimeout(timeout);
  }, [load]);

  const statusLabel = useCallback(
    (value: string) => t(`research.status.${value}`, { defaultValue: value }),
    [t]
  );

  const empty = useMemo(() => !isPending && items.length === 0, [isPending, items.length]);

  const toggleFavorite = async (project: TResearchProjectListItem) => {
    const result = await updateResearchProjectAction({
      researchProjectId: project.id,
      data: { isFavorite: !project.isFavorite },
    });
    if (result?.data) {
      load();
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("research.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("research.subtitle")}</p>
        </div>
        {!isReadOnly && (
          <Button asChild>
            <Link href={`/workspaces/${workspaceId}/research/new`}>
              <PlusIcon className="mr-2 h-4 w-4" />
              {t("research.actions.create")}
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("research.filters.search_placeholder")}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("research.filters.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("research.filters.all_statuses")}</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {statusLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={favoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFavoritesOnly((v) => !v)}>
          <StarIcon className="mr-2 h-4 w-4" />
          {t("research.filters.favorites")}
        </Button>
        <Button
          variant={includeArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setIncludeArchived((v) => !v)}>
          {t("research.filters.archive")}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant={viewMode === "cards" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("cards")}>
            {t("research.view.cards")}
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}>
            {t("research.view.table")}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isPending && <p className="text-sm text-slate-500">{t("common.loading")}</p>}

      {empty && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <FlaskConicalIcon className="mb-4 h-10 w-10 text-slate-300" />
          <h2 className="text-lg font-medium text-slate-900">{t("research.empty.title")}</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">{t("research.empty.description")}</p>
          {!isReadOnly && (
            <Button className="mt-6" asChild>
              <Link href={`/workspaces/${workspaceId}/research/new`}>{t("research.actions.create")}</Link>
            </Button>
          )}
        </div>
      )}

      {!empty && viewMode === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((project) => (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
              onClick={() => router.push(`/workspaces/${workspaceId}/research/${project.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/workspaces/${workspaceId}/research/${project.id}`);
                }
              }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{project.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {project.client?.name ?? t("research.fields.no_client")}
                    {project.brand ? ` · ${project.brand.name}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-slate-400 hover:text-amber-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFavorite(project);
                  }}
                  aria-label={t("research.actions.toggle_favorite")}>
                  <StarIcon
                    className={`h-4 w-4 ${project.isFavorite ? "fill-amber-400 text-amber-400" : ""}`}
                  />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-1">{statusLabel(project.status)}</span>
                <span>
                  {t("research.fields.surveys_count", { count: project._count.surveys })} ·{" "}
                  {project.owner.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!empty && viewMode === "table" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 font-medium">{t("research.fields.client")}</th>
                <th className="px-4 py-3 font-medium">{t("research.fields.brand")}</th>
                <th className="px-4 py-3 font-medium">{t("common.status")}</th>
                <th className="px-4 py-3 font-medium">{t("research.fields.owner")}</th>
                <th className="px-4 py-3 font-medium">{t("research.fields.surveys")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((project) => (
                <tr
                  key={project.id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => router.push(`/workspaces/${workspaceId}/research/${project.id}`)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{project.name}</td>
                  <td className="px-4 py-3 text-slate-600">{project.client?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{project.brand?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{statusLabel(project.status)}</td>
                  <td className="px-4 py-3 text-slate-600">{project.owner.name}</td>
                  <td className="px-4 py-3 text-slate-600">{project._count.surveys}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">{t("research.fields.total", { count: total })}</p>
    </div>
  );
};

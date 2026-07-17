"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createId } from "@paralleldrive/cuid2";
import { GripVerticalIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  createResearchReportVersionAction,
  downloadResearchExportAction,
  getResearchExportJobAction,
  listResearchExportJobsAction,
  saveResearchReportBlocksAction,
  startResearchReportPdfExportAction,
  startResearchReportXlsxExportAction,
  updateResearchReportMetaAction,
  updateResearchReportStatusAction,
} from "@/modules/research/actions";
import { ResearchReportPreview } from "@/modules/research/components/research-report-preview";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import {
  DEFAULT_REPORT_THEME_TOKENS,
  REPORT_STATUS_TRANSITIONS,
  defaultContentForBlockType,
  type TResearchReportBlockContent,
  type TResearchReportBlockType,
  type TResearchReportStatus,
  type TResearchReportThemeTokens,
} from "@/modules/research/types/report";

type EditorBlock = {
  id: string;
  type: TResearchReportBlockType;
  content: TResearchReportBlockContent;
};

type ThemeOption = {
  id: string;
  name: string;
  tokens: unknown;
  isDefault: boolean;
};

type AnalysisOption = { id: string; title: string; lastResult: unknown };
type InsightOption = { id: string; title: string; description: string | null; type: string };
type BrandAuditOption = { id: string; name: string; status: string };

interface ResearchReportBuilderProps {
  workspaceId: string;
  researchProjectId: string;
  reportId: string;
  initialTitle: string;
  initialSubtitle: string | null;
  initialStatus: TResearchReportStatus;
  initialThemeId: string | null;
  initialBlocks: EditorBlock[];
  themes: ThemeOption[];
  analysisBlocks: AnalysisOption[];
  insights: InsightOption[];
  brandAudits: BrandAuditOption[];
  versions: Array<{ id: string; versionNumber: number; label: string | null; createdAt: string | Date }>;
  canEdit: boolean;
  canApprove: boolean;
  canExport: boolean;
}

const BLOCK_TYPES: TResearchReportBlockType[] = [
  "heading",
  "paragraph",
  "bullets",
  "analysis",
  "insight",
  "quote",
  "brand_audit",
  "divider",
  "page_break",
];

const SortableBlockRow = ({
  block,
  canEdit,
  analysisBlocks,
  insights,
  brandAudits,
  onChange,
  onRemove,
  t,
}: {
  block: EditorBlock;
  canEdit: boolean;
  analysisBlocks: AnalysisOption[];
  insights: InsightOption[];
  brandAudits: BrandAuditOption[];
  onChange: (id: string, content: TResearchReportBlockContent) => void;
  onRemove: (id: string) => void;
  t: (key: string) => string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition: transition ?? "transform 120ms ease",
  };
  const c = block.content;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {canEdit && (
            <button type="button" className="cursor-grab text-slate-400" {...attributes} {...listeners}>
              <GripVerticalIcon className="size-4" />
            </button>
          )}
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t(`research.reports.block_types.${block.type}`)}
          </span>
        </div>
        {canEdit && (
          <button type="button" onClick={() => onRemove(block.id)} className="text-slate-400 hover:text-red-600">
            <TrashIcon className="size-4" />
          </button>
        )}
      </div>

      {c.kind === "heading" && (
        <div className="flex gap-2">
          <Select
            value={String(c.level)}
            disabled={!canEdit}
            onValueChange={(v) => onChange(block.id, { ...c, level: Number(v) as 1 | 2 | 3 })}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">H1</SelectItem>
              <SelectItem value="2">H2</SelectItem>
              <SelectItem value="3">H3</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={c.text}
            disabled={!canEdit}
            onChange={(e) => onChange(block.id, { ...c, text: e.target.value })}
          />
        </div>
      )}

      {c.kind === "paragraph" && (
        <textarea
          className="min-h-[80px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={c.text}
          disabled={!canEdit}
          onChange={(e) => onChange(block.id, { ...c, text: e.target.value })}
        />
      )}

      {c.kind === "bullets" && (
        <textarea
          className="min-h-[80px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={c.items.join("\n")}
          disabled={!canEdit}
          placeholder={t("research.reports.bullets_hint")}
          onChange={(e) =>
            onChange(block.id, {
              ...c,
              items: e.target.value.split("\n"),
            })
          }
        />
      )}

      {c.kind === "quote" && (
        <div className="space-y-2">
          <textarea
            className="min-h-[60px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={c.text}
            disabled={!canEdit}
            onChange={(e) => onChange(block.id, { ...c, text: e.target.value })}
          />
          <Input
            value={c.attribution ?? ""}
            disabled={!canEdit}
            placeholder={t("research.reports.quote_attribution")}
            onChange={(e) => onChange(block.id, { ...c, attribution: e.target.value })}
          />
        </div>
      )}

      {c.kind === "analysis" && (
        <Select
          value={c.analysisBlockId === "_" ? undefined : c.analysisBlockId}
          disabled={!canEdit}
          onValueChange={(v) => onChange(block.id, { ...c, analysisBlockId: v })}>
          <SelectTrigger>
            <SelectValue placeholder={t("research.reports.select_analysis")} />
          </SelectTrigger>
          <SelectContent>
            {analysisBlocks.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {c.kind === "insight" && (
        <Select
          value={c.insightId === "_" ? undefined : c.insightId}
          disabled={!canEdit}
          onValueChange={(v) => onChange(block.id, { ...c, insightId: v })}>
          <SelectTrigger>
            <SelectValue placeholder={t("research.reports.select_insight")} />
          </SelectTrigger>
          <SelectContent>
            {insights.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {c.kind === "brand_audit" && (
        <Select
          value={c.brandAuditId === "_" ? undefined : c.brandAuditId}
          disabled={!canEdit}
          onValueChange={(v) => onChange(block.id, { ...c, brandAuditId: v })}>
          <SelectTrigger>
            <SelectValue placeholder={t("research.reports.select_brand_audit")} />
          </SelectTrigger>
          <SelectContent>
            {brandAudits.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(c.kind === "divider" || c.kind === "page_break") && (
        <p className="text-xs text-slate-400">{t(`research.reports.block_types.${c.kind}`)}</p>
      )}
    </div>
  );
};

export const ResearchReportBuilder = ({
  workspaceId,
  researchProjectId,
  reportId,
  initialTitle,
  initialSubtitle,
  initialStatus,
  initialThemeId,
  initialBlocks,
  themes,
  analysisBlocks,
  insights,
  brandAudits,
  versions: initialVersions,
  canEdit,
  canApprove,
  canExport,
}: ResearchReportBuilderProps) => {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? "");
  const [status, setStatus] = useState(initialStatus);
  const [themeId, setThemeId] = useState(initialThemeId ?? "");
  const [blocks, setBlocks] = useState<EditorBlock[]>(initialBlocks);
  const [versions, setVersions] = useState(initialVersions);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [addType, setAddType] = useState<TResearchReportBlockType>("paragraph");
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [xlsxJobId, setXlsxJobId] = useState<string | null>(null);
  const [xlsxStatus, setXlsxStatus] = useState<string | null>(null);
  const [xlsxError, setXlsxError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedTheme = themes.find((th) => th.id === themeId);
  const themeTokens = useMemo(() => {
    const raw = (selectedTheme?.tokens ?? {}) as Partial<TResearchReportThemeTokens>;
    return { ...DEFAULT_REPORT_THEME_TOKENS, ...raw };
  }, [selectedTheme]);

  const analysisById = useMemo(
    () => Object.fromEntries(analysisBlocks.map((a) => [a.id, a])),
    [analysisBlocks]
  );
  const insightById = useMemo(() => Object.fromEntries(insights.map((i) => [i.id, i])), [insights]);

  const nextStatuses = REPORT_STATUS_TRANSITIONS[status] ?? [];

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const updateBlockContent = (id: string, content: TResearchReportBlockContent) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content, type: content.kind } : b)));
  };

  const saveAll = () => {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const meta = await updateResearchReportMetaAction({
        reportId,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        themeId: themeId || null,
      });
      if (meta?.serverError || meta?.validationErrors) {
        setError(t("research.errors.save_report_failed"));
        return;
      }
      const saved = await saveResearchReportBlocksAction({
        reportId,
        blocks: blocks.map((b) => ({ id: b.id, type: b.type, content: b.content })),
      });
      if (saved?.serverError || saved?.validationErrors) {
        setError(t("research.errors.save_report_failed"));
        return;
      }
      setMessage(t("research.reports.saved"));
    });
  };

  const createVersion = () => {
    startTransition(async () => {
      setError(null);
      const result = await createResearchReportVersionAction({ reportId });
      if (result?.serverError || !result?.data) {
        setError(t("research.errors.version_failed"));
        return;
      }
      setVersions((prev) => [
        {
          id: result.data.id,
          versionNumber: result.data.versionNumber,
          label: result.data.label,
          createdAt: result.data.createdAt,
        },
        ...prev,
      ]);
      setMessage(t("research.reports.version_created"));
    });
  };

  const changeStatus = (next: TResearchReportStatus) => {
    startTransition(async () => {
      setError(null);
      const result = await updateResearchReportStatusAction({ reportId, status: next });
      if (result?.serverError || !result?.data) {
        setError(t("research.errors.status_failed"));
        return;
      }
      setStatus(result.data.status as TResearchReportStatus);
      setMessage(t("research.reports.status_updated"));
    });
  };

  const downloadExport = useCallback(
    async (jobId: string) => {
      const result = await downloadResearchExportAction({ exportJobId: jobId });
      if (result?.serverError || !result?.data) {
        setExportError(t("research.errors.export_download_failed"));
        return;
      }
      const payload = result.data;
      if (payload.kind === "url") {
        window.open(payload.url, "_blank", "noopener,noreferrer");
        return;
      }
      const binary = atob(payload.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: payload.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
    [t]
  );

  const startPdfExport = () => {
    startTransition(async () => {
      setExportError(null);
      setExportStatus("queued");
      const result = await startResearchReportPdfExportAction({
        reportId,
        includeToc: false,
        orientation: "portrait",
      });
      if (result?.serverError || !result?.data) {
        setExportStatus(null);
        setExportError(t("research.errors.export_failed"));
        return;
      }
      setExportJobId(result.data.id);
      setExportStatus(result.data.status);
      if (result.data.status === "completed") {
        setMessage(t("research.reports.export_ready"));
        await downloadExport(result.data.id);
      }
    });
  };

  const startXlsxExport = () => {
    startTransition(async () => {
      setXlsxError(null);
      setXlsxStatus("queued");
      const result = await startResearchReportXlsxExportAction({ reportId });
      if (result?.serverError || !result?.data) {
        setXlsxStatus(null);
        setXlsxError(t("research.errors.export_xlsx_failed"));
        return;
      }
      setXlsxJobId(result.data.id);
      setXlsxStatus(result.data.status);
      if (result.data.status === "completed") {
        setMessage(t("research.reports.export_xlsx_ready"));
        await downloadExport(result.data.id);
      }
    });
  };

  useEffect(() => {
    if (!exportJobId) return;
    if (exportStatus === "completed" || exportStatus === "failed" || exportStatus === "cancelled") return;

    const timer = setInterval(() => {
      void (async () => {
        const result = await getResearchExportJobAction({ exportJobId });
        if (!result?.data) return;
        setExportStatus(result.data.status);
        if (result.data.status === "completed") {
          setMessage(t("research.reports.export_ready"));
          await downloadExport(exportJobId);
        }
        if (result.data.status === "failed") {
          setExportError(
            result.data.errorCode === "chromium_unavailable"
              ? t("research.errors.export_chromium")
              : result.data.errorMessage || t("research.errors.export_failed")
          );
        }
      })();
    }, 2000);

    return () => clearInterval(timer);
  }, [exportJobId, exportStatus, downloadExport, t]);

  useEffect(() => {
    if (!xlsxJobId) return;
    if (xlsxStatus === "completed" || xlsxStatus === "failed" || xlsxStatus === "cancelled") return;

    const timer = setInterval(() => {
      void (async () => {
        const result = await getResearchExportJobAction({ exportJobId: xlsxJobId });
        if (!result?.data) return;
        setXlsxStatus(result.data.status);
        if (result.data.status === "completed") {
          setMessage(t("research.reports.export_xlsx_ready"));
          await downloadExport(xlsxJobId);
        }
        if (result.data.status === "failed") {
          setXlsxError(result.data.errorMessage || t("research.errors.export_xlsx_failed"));
        }
      })();
    }, 2000);

    return () => clearInterval(timer);
  }, [xlsxJobId, xlsxStatus, downloadExport, t]);

  useEffect(() => {
    void Promise.all([
      listResearchExportJobsAction({ reportId, type: "pdf" }),
      listResearchExportJobsAction({ reportId, type: "xlsx" }),
    ]).then(([pdfResult, xlsxResult]) => {
      const latestPdf = pdfResult?.data?.[0];
      if (latestPdf) {
        setExportJobId(latestPdf.id);
        setExportStatus(latestPdf.status);
      }
      const latestXlsx = xlsxResult?.data?.[0];
      if (latestXlsx) {
        setXlsxJobId(latestXlsx.id);
        setXlsxStatus(latestXlsx.status);
      }
    });
  }, [reportId]);

  const listHref = `/workspaces/${workspaceId}/research/${researchProjectId}/reports`;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={listHref} className="text-xs text-slate-500 hover:text-slate-700">
            ← {t("research.reports.back_to_list")}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              className="max-w-md text-lg font-semibold"
              value={title}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
            />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {t(`research.reports.status.${status}`)}
            </span>
          </div>
          <Input
            className="mt-2 max-w-md"
            value={subtitle}
            disabled={!canEdit}
            placeholder={t("research.reports.new_subtitle_placeholder")}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && status !== "published" && status !== "archived" && (
            <>
              <Button variant="secondary" disabled={isPending} onClick={saveAll}>
                {t("research.reports.save")}
              </Button>
              <Button variant="secondary" disabled={isPending} onClick={createVersion}>
                {t("research.reports.save_version")}
              </Button>
            </>
          )}
          {canEdit && (status === "published" || status === "archived") && (
            <Button variant="secondary" disabled={isPending} onClick={createVersion}>
              {t("research.reports.save_version")}
            </Button>
          )}
          {nextStatuses.map((s) => {
            const needsApprove = s === "approved" || s === "published";
            if (needsApprove && !canApprove) return null;
            if (!needsApprove && !canEdit) return null;
            return (
              <Button key={s} variant="ghost" disabled={isPending} onClick={() => changeStatus(s)}>
                {t(`research.reports.actions.to_${s}`)}
              </Button>
            );
          })}
          {canExport && (
            <Button
              disabled={isPending || exportStatus === "queued" || exportStatus === "processing"}
              onClick={startPdfExport}>
              {exportStatus === "queued" || exportStatus === "processing"
                ? t("research.reports.export_running")
                : t("research.reports.export_pdf")}
            </Button>
          )}
          {canExport && exportStatus === "completed" && exportJobId && (
            <Button variant="secondary" disabled={isPending} onClick={() => void downloadExport(exportJobId)}>
              {t("research.reports.download_pdf")}
            </Button>
          )}
          {canExport && (
            <Button
              variant="secondary"
              disabled={isPending || xlsxStatus === "queued" || xlsxStatus === "processing"}
              onClick={startXlsxExport}>
              {xlsxStatus === "queued" || xlsxStatus === "processing"
                ? t("research.reports.export_xlsx_running")
                : t("research.reports.export_xlsx")}
            </Button>
          )}
          {canExport && xlsxStatus === "completed" && xlsxJobId && (
            <Button variant="ghost" disabled={isPending} onClick={() => void downloadExport(xlsxJobId)}>
              {t("research.reports.download_xlsx")}
            </Button>
          )}
        </div>
      </div>

      {exportError && <p className="text-sm text-red-600">{exportError}</p>}
      {xlsxError && <p className="text-sm text-red-600">{xlsxError}</p>}
      {exportStatus && (
        <p className="text-xs text-slate-500">
          PDF — {t("research.reports.export_status")}: {t(`research.reports.export_statuses.${exportStatus}`)}
        </p>
      )}
      {xlsxStatus && (
        <p className="text-xs text-slate-500">
          Excel — {t("research.reports.export_status")}: {t(`research.reports.export_statuses.${xlsxStatus}`)}
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={themeId || undefined} onValueChange={setThemeId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t("research.reports.select_theme")} />
            </SelectTrigger>
            <SelectContent>
              {themes.map((th) => (
                <SelectItem key={th.id} value={th.id}>
                  {th.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={addType} onValueChange={(v) => setAddType(v as TResearchReportBlockType)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_TYPES.map((bt) => (
                <SelectItem key={bt} value={bt}>
                  {t(`research.reports.block_types.${bt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            onClick={() => {
              const content = defaultContentForBlockType(addType);
              setBlocks((prev) => [...prev, { id: createId(), type: addType, content }]);
            }}>
            {t("research.reports.add_block")}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.reports.editor")}</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {blocks.map((block) => (
                  <SortableBlockRow
                    key={block.id}
                    block={block}
                    canEdit={canEdit && status !== "published" && status !== "archived"}
                    analysisBlocks={analysisBlocks}
                    insights={insights}
                    brandAudits={brandAudits}
                    onChange={updateBlockContent}
                    onRemove={(id) => setBlocks((prev) => prev.filter((b) => b.id !== id))}
                    t={t}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {blocks.length === 0 && (
            <p className="text-sm text-slate-500">{t("research.reports.no_blocks")}</p>
          )}
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">{t("research.reports.preview")}</h3>
          <ResearchReportPreview
            title={title}
            subtitle={subtitle}
            blocks={blocks}
            tokens={themeTokens}
            analysisById={analysisById}
            insightById={insightById}
            labels={{
              pageBreak: t("research.reports.block_types.page_break"),
              selectAnalysis: t("research.reports.select_analysis"),
              selectInsight: t("research.reports.select_insight"),
            }}
          />
          {versions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("research.reports.versions")}
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {versions.map((v) => (
                  <li key={v.id}>
                    {v.label || `v${v.versionNumber}`} ·{" "}
                    {new Date(v.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  applyCodeToSegmentAction,
  createInsightFromSegmentAction,
  createResearchCodeAction,
  importInterviewTranscriptAction,
  removeCodeFromSegmentAction,
  updateTranscriptSegmentAction,
} from "@/modules/research/actions";
import type { TResearchInterviewDetail } from "@/modules/research/lib/interviews";

interface InterviewCodingWorkspaceProps {
  researchProjectId: string;
  interview: TResearchInterviewDetail;
  codes: Array<{ id: string; name: string; color: string; description: string | null; _count?: { segmentCodes: number } }>;
  canEdit: boolean;
  canCreateInsights: boolean;
  onRefresh: () => void;
}

export const InterviewCodingWorkspace = ({
  researchProjectId,
  interview,
  codes,
  canEdit,
  canCreateInsights,
  onRefresh,
}: InterviewCodingWorkspaceProps) => {
  const { t } = useTranslation();
  const [rawText, setRawText] = useState(interview.transcript?.rawText ?? "");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<string>("");
  const [newCodeName, setNewCodeName] = useState("");
  const [insightTitle, setInsightTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const segments = interview.transcript?.segments ?? [];
  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === selectedSegmentId) ?? null,
    [segments, selectedSegmentId]
  );

  const importTranscript = () => {
    if (!rawText.trim()) return;
    startTransition(async () => {
      const result = await importInterviewTranscriptAction({
        interviewId: interview.id,
        rawText,
        source: "paste",
      });
      if (result?.data) {
        setMessage(t("research.interviews.transcript_imported"));
        onRefresh();
      } else {
        setMessage(t("research.errors.transcript_import_failed"));
      }
    });
  };

  const createCode = () => {
    if (!newCodeName.trim()) return;
    startTransition(async () => {
      const result = await createResearchCodeAction({
        researchProjectId,
        name: newCodeName.trim(),
      });
      if (result?.data) {
        setNewCodeName("");
        setSelectedCodeId(result.data.id);
        onRefresh();
      }
    });
  };

  const applyCode = () => {
    if (!selectedSegmentId || !selectedCodeId) return;
    startTransition(async () => {
      await applyCodeToSegmentAction({ segmentId: selectedSegmentId, codeId: selectedCodeId });
      onRefresh();
    });
  };

  const removeCode = (codeId: string) => {
    if (!selectedSegmentId) return;
    startTransition(async () => {
      await removeCodeFromSegmentAction({ segmentId: selectedSegmentId, codeId });
      onRefresh();
    });
  };

  const markQuote = () => {
    if (!selectedSegmentId) return;
    startTransition(async () => {
      await updateTranscriptSegmentAction({ segmentId: selectedSegmentId, isQuote: true });
      onRefresh();
    });
  };

  const createInsight = () => {
    if (!selectedSegmentId || !insightTitle.trim()) return;
    startTransition(async () => {
      const result = await createInsightFromSegmentAction({
        researchProjectId,
        segmentId: selectedSegmentId,
        title: insightTitle.trim(),
      });
      if (result?.data) {
        setInsightTitle("");
        setMessage(t("research.insights.created_from_quote"));
        onRefresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.interviews.import_transcript")}</h3>
          <p className="mt-1 text-xs text-slate-500">{t("research.interviews.import_hint")}</p>
          <textarea
            className="mt-3 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`Interviewer: ...\nRespondent: ...`}
          />
          <Button className="mt-3" disabled={isPending || !rawText.trim()} onClick={importTranscript}>
            {t("research.interviews.import_transcript")}
          </Button>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.interviews.segments")}</h3>
          <ul className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">
            {segments.length === 0 && (
              <li className="text-sm text-slate-500">{t("research.interviews.no_segments")}</li>
            )}
            {segments.map((segment) => {
              const active = segment.id === selectedSegmentId;
              return (
                <li key={segment.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                      active
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setSelectedSegmentId(segment.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        {segment.speaker ?? t("research.interviews.unknown_speaker")}
                        {segment.isQuote ? ` · ${t("research.interviews.quote")}` : ""}
                      </span>
                      <span className="text-[10px] text-slate-400">#{segment.position + 1}</span>
                    </div>
                    <p className="mt-1 text-slate-800">{segment.text}</p>
                    {segment.codes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {segment.codes.map((link) => (
                          <span
                            key={link.id}
                            className="rounded-full px-2 py-0.5 text-[10px] text-white"
                            style={{ backgroundColor: link.code.color }}>
                            {link.code.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">{t("research.coding.codes")}</h3>
            {canEdit && (
              <div className="mt-3 flex gap-2">
                <Input
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value)}
                  placeholder={t("research.coding.new_code")}
                />
                <Button size="sm" onClick={createCode} disabled={isPending || !newCodeName.trim()}>
                  +
                </Button>
              </div>
            )}
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
              {codes.map((code) => (
                <li key={code.id} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: code.color }} />
                  <span className="flex-1">{code.name}</span>
                  <span className="text-xs text-slate-400">{code._count?.segmentCodes ?? 0}</span>
                </li>
              ))}
            </ul>
          </section>

          {selectedSegment && canEdit && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">{t("research.coding.apply")}</h3>
              <Select value={selectedCodeId} onValueChange={setSelectedCodeId}>
                <SelectTrigger className="mt-3">
                  <SelectValue placeholder={t("research.coding.select_code")} />
                </SelectTrigger>
                <SelectContent>
                  {codes.map((code) => (
                    <SelectItem key={code.id} value={code.id}>
                      {code.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={applyCode} disabled={!selectedCodeId || isPending}>
                  {t("research.coding.apply")}
                </Button>
                <Button size="sm" variant="outline" onClick={markQuote} disabled={isPending}>
                  {t("research.interviews.mark_quote")}
                </Button>
              </div>
              {selectedSegment.codes.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {selectedSegment.codes.map((link) => (
                    <li key={link.id} className="flex items-center justify-between">
                      <span>{link.code.name}</span>
                      <button
                        type="button"
                        className="text-red-500 hover:underline"
                        onClick={() => removeCode(link.codeId)}>
                        {t("common.remove")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {selectedSegment && canCreateInsights && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">{t("research.insights.from_quote")}</h3>
              <Input
                className="mt-3"
                value={insightTitle}
                onChange={(e) => setInsightTitle(e.target.value)}
                placeholder={t("research.insights.title_placeholder")}
              />
              <Button
                className="mt-3"
                size="sm"
                disabled={isPending || !insightTitle.trim()}
                onClick={createInsight}>
                {t("research.insights.create")}
              </Button>
            </section>
          )}

          <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            {t("research.ai.stub_notice")}
          </section>
        </aside>
      </div>

      {message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  );
};

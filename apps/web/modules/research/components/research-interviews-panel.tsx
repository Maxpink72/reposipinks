"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
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
  createResearchInterviewAction,
  listResearchInterviewsAction,
  searchTranscriptSegmentsAction,
} from "@/modules/research/actions";
import type { TResearchInterviewListItem } from "@/modules/research/lib/interviews";
import type { TResearchInterviewStatus } from "@/modules/research/types";

const STATUSES: TResearchInterviewStatus[] = [
  "planned",
  "scheduled",
  "completed",
  "transcribed",
  "coded",
  "analyzed",
];

interface ResearchInterviewsPanelProps {
  workspaceId: string;
  researchProjectId: string;
  canEdit: boolean;
}

export const ResearchInterviewsPanel = ({
  workspaceId,
  researchProjectId,
  canEdit,
}: ResearchInterviewsPanelProps) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TResearchInterviewListItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [segment, setSegment] = useState("");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [transcriptHits, setTranscriptHits] = useState<
    Array<{ id: string; text: string; interviewName: string; interviewId: string }>
  >([]);
  const [name, setName] = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [respondentSegment, setRespondentSegment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const result = await listResearchInterviewsAction({
        researchProjectId,
        search: search.trim() || undefined,
        status: status === "all" ? undefined : (status as TResearchInterviewStatus),
        segment: segment.trim() || undefined,
      });
      if (result?.data) {
        setItems(result.data as TResearchInterviewListItem[]);
      } else {
        setError(t("research.errors.load_interviews_failed"));
      }
    });
  }, [researchProjectId, search, status, segment, t]);

  useEffect(() => {
    const timeout = setTimeout(load, 200);
    return () => clearTimeout(timeout);
  }, [load]);

  const createInterview = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createResearchInterviewAction({
        researchProjectId,
        name: name.trim(),
        respondentName: respondentName.trim() || undefined,
        respondentSegment: respondentSegment.trim() || undefined,
      });
      if (result?.data) {
        setName("");
        setRespondentName("");
        setRespondentSegment("");
        load();
      } else {
        setError(t("research.errors.create_interview_failed"));
      }
    });
  };

  const searchTranscripts = () => {
    if (!transcriptQuery.trim()) {
      setTranscriptHits([]);
      return;
    }
    startTransition(async () => {
      const result = await searchTranscriptSegmentsAction({
        researchProjectId,
        query: transcriptQuery.trim(),
        segment: segment.trim() || undefined,
      });
      if (result?.data) {
        setTranscriptHits(
          result.data.map((hit) => ({
            id: hit.id,
            text: hit.text,
            interviewId: hit.transcript.interview.id,
            interviewName: hit.transcript.interview.name,
          }))
        );
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("research.interviews.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("research.interviews.subtitle")}</p>
      </div>

      {canEdit && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("research.interviews.create")}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("research.interviews.name_placeholder")}
            />
            <Input
              value={respondentName}
              onChange={(e) => setRespondentName(e.target.value)}
              placeholder={t("research.interviews.respondent_placeholder")}
            />
            <Input
              value={respondentSegment}
              onChange={(e) => setRespondentSegment(e.target.value)}
              placeholder={t("research.interviews.segment_placeholder")}
            />
          </div>
          <Button className="mt-3" disabled={isPending || !name.trim()} onClick={createInterview}>
            {t("research.interviews.create")}
          </Button>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          className="min-w-[200px] flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("research.interviews.search_placeholder")}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("research.filters.all_statuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`research.interview_status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-[180px]"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          placeholder={t("research.interviews.filter_segment")}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t("research.interviews.transcript_search")}</h3>
        <div className="mt-3 flex gap-2">
          <Input
            value={transcriptQuery}
            onChange={(e) => setTranscriptQuery(e.target.value)}
            placeholder={t("research.interviews.transcript_search_placeholder")}
          />
          <Button variant="outline" onClick={searchTranscripts} disabled={isPending}>
            {t("common.search")}
          </Button>
        </div>
        {transcriptHits.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100">
            {transcriptHits.map((hit) => (
              <li key={hit.id} className="py-3 text-sm">
                <Link
                  className="font-medium text-slate-900 hover:underline"
                  href={`/workspaces/${workspaceId}/research/${researchProjectId}/interviews/${hit.interviewId}`}>
                  {hit.interviewName}
                </Link>
                <p className="mt-1 text-slate-600">{hit.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {items.length === 0 && !isPending && (
          <li className="px-4 py-10 text-center text-sm text-slate-500">{t("research.interviews.empty")}</li>
        )}
        {items.map((interview) => (
          <li key={interview.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link
                href={`/workspaces/${workspaceId}/research/${researchProjectId}/interviews/${interview.id}`}
                className="font-medium text-slate-900 hover:underline">
                {interview.name}
              </Link>
              <p className="text-xs text-slate-500">
                {t(`research.interview_status.${interview.status}`)}
                {interview.respondentName ? ` · ${interview.respondentName}` : ""}
                {interview.respondentSegment ? ` · ${interview.respondentSegment}` : ""}
                {interview.transcript
                  ? ` · ${t("research.interviews.segments_count", { count: interview.transcript._count.segments })}`
                  : ""}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/workspaces/${workspaceId}/research/${researchProjectId}/interviews/${interview.id}`}>
                {t("research.interviews.open")}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

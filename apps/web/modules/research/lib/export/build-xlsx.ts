import "server-only";
import { prisma } from "@formbricks/database";
import {
  buildResearchWorkbookBuffer,
  type TWorkbookCell,
  type TWorkbookSheet,
} from "@/modules/research/lib/export/build-workbook";
import type { TResearchReportBlockContent } from "@/modules/research/types/report";

const DATASET_ROW_CAP = 500;
const RESPONSE_SAMPLE_CAP = 0; // full response dump stays in survey export; sheet is inventory

type SnapshotBlock = {
  id: string;
  type: string;
  position: number;
  content: TResearchReportBlockContent;
};

const asList = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
};

const textOf = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
};

/**
 * Assemble multi-sheet research report workbook.
 * Sheets are omitted when empty (except Metadata, always present).
 */
export const buildResearchReportXlsxBuffer = async (params: {
  researchProjectId: string;
  reportId: string;
  title: string;
  subtitle?: string | null;
  blocks: SnapshotBlock[];
  reportVersionId?: string | null;
  actorEmail?: string | null;
}): Promise<Buffer> => {
  const project = await prisma.researchProject.findUniqueOrThrow({
    where: { id: params.researchProjectId },
    include: {
      client: { select: { name: true } },
      brand: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
  });

  const [interviews, insights, analysisBlocks, datasets, surveyLinks] = await Promise.all([
    prisma.researchInterview.findMany({
      where: { researchProjectId: params.researchProjectId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        respondentName: true,
        respondentSegment: true,
        status: true,
        scheduledAt: true,
        completedAt: true,
        durationMinutes: true,
        tags: true,
      },
    }),
    prisma.researchInsight.findMany({
      where: { researchProjectId: params.researchProjectId },
      orderBy: { createdAt: "asc" },
      include: {
        evidence: {
          select: { quoteText: true, note: true, interviewId: true },
          take: 5,
        },
      },
    }),
    prisma.researchAnalysisBlock.findMany({
      where: { researchProjectId: params.researchProjectId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        analystComment: true,
        chartDefinition: true,
        lastResult: true,
      },
    }),
    prisma.researchDataset.findMany({
      where: { researchProjectId: params.researchProjectId },
      orderBy: { name: "asc" },
    }),
    prisma.researchProjectSurvey.findMany({
      where: { researchProjectId: params.researchProjectId },
      include: {
        survey: {
          select: {
            id: true,
            name: true,
            status: true,
            questions: true,
            _count: { select: { responses: true } },
          },
        },
      },
    }),
  ]);

  const sheets: TWorkbookSheet[] = [];

  // 1. Summary
  sheets.push({
    name: "Summary",
    headers: ["Field", "Value"],
    rows: [
      ["Report title", params.title],
      ["Subtitle", params.subtitle ?? ""],
      ["Project", project.name],
      ["Client", project.client?.name ?? ""],
      ["Brand", project.brand?.name ?? ""],
      ["Project status", project.status],
      ["Owner", project.owner?.name ?? project.owner?.email ?? ""],
      ["Blocks in report", params.blocks.length],
      ["Interviews", interviews.length],
      ["Insights", insights.length],
      ["Analysis blocks", analysisBlocks.length],
      ["Linked surveys", surveyLinks.length],
      ["Datasets", datasets.length],
    ],
  });

  // 2. Methodology
  const goals = asList(project.goals);
  const questions = asList(project.researchQuestions);
  const hypotheses = asList(project.hypotheses);
  const methods = Array.isArray(project.methods) ? project.methods : [];
  const methodologyRows: Array<[string, string]> = [];
  for (const g of goals) methodologyRows.push(["Goal", textOf(g.text ?? g)]);
  for (const q of questions) methodologyRows.push(["Research question", textOf(q.text ?? q)]);
  for (const h of hypotheses) methodologyRows.push(["Hypothesis", textOf(h.text ?? h)]);
  for (const m of methods) methodologyRows.push(["Method", textOf(m)]);
  const audience = project.audience as Record<string, unknown> | null;
  if (audience && typeof audience === "object") {
    for (const [k, v] of Object.entries(audience)) {
      methodologyRows.push([`Audience.${k}`, textOf(v)]);
    }
  }
  if (methodologyRows.length > 0) {
    sheets.push({
      name: "Methodology",
      headers: ["Type", "Text"],
      rows: methodologyRows,
    });
  }

  // 3. Respondents (interviews)
  if (interviews.length > 0) {
    sheets.push({
      name: "Respondents",
      headers: [
        "Interview ID",
        "Name",
        "Respondent",
        "Segment",
        "Status",
        "Scheduled",
        "Completed",
        "Duration (min)",
        "Tags",
      ],
      columnTypes: ["text", "text", "text", "text", "text", "date", "date", "number", "text"],
      rows: interviews.map((i) => [
        i.id,
        i.name,
        i.respondentName ?? "",
        i.respondentSegment ?? "",
        i.status,
        i.scheduledAt,
        i.completedAt,
        i.durationMinutes,
        Array.isArray(i.tags) ? i.tags.map(String).join(", ") : "",
      ]),
    });
  }

  // 4. Survey Data (inventory — not full response dump)
  if (surveyLinks.length > 0) {
    sheets.push({
      name: "Survey Data",
      headers: ["Survey ID", "Survey name", "Status", "Questions", "Responses"],
      columnTypes: ["text", "text", "text", "number", "number"],
      rows: surveyLinks.map((link) => {
        const questionsJson = Array.isArray(link.survey.questions) ? link.survey.questions : [];
        return [
          link.survey.id,
          link.survey.name,
          link.survey.status,
          questionsJson.length,
          link.survey._count.responses,
        ];
      }),
    });
    void RESPONSE_SAMPLE_CAP;
  }

  // 5. Interview Insights
  if (insights.length > 0) {
    sheets.push({
      name: "Interview Insights",
      headers: [
        "Insight ID",
        "Title",
        "Type",
        "Importance",
        "Confidence",
        "Description",
        "Evidence quotes",
        "AI generated",
        "Human confirmed",
      ],
      rows: insights.map((insight) => [
        insight.id,
        insight.title,
        insight.type,
        insight.importance,
        insight.confidence,
        insight.description ?? "",
        insight.evidence
          .map((e) => e.quoteText || e.note || "")
          .filter(Boolean)
          .join(" | "),
        insight.isAiGenerated ? "yes" : "no",
        insight.isHumanConfirmed ? "yes" : "no",
      ]),
    });
  }

  // 6. Charts — data tables from analysis lastResult
  const chartRows: TWorkbookCell[][] = [];
  for (const block of analysisBlocks) {
    const result = block.lastResult as {
      sampleSize?: number;
      metric?: string;
      points?: Array<{ label: string; value: number; percentage?: number }>;
      kpi?: { value: number; label: string };
      nps?: { score: number; promoters?: number; passives?: number; detractors?: number };
    } | null;

    if (!result) {
      chartRows.push([block.title, block.id, "", "", "", block.analystComment ?? ""]);
      continue;
    }
    if (result.kpi) {
      chartRows.push([
        block.title,
        block.id,
        result.kpi.label,
        result.kpi.value,
        result.sampleSize ?? "",
        block.analystComment ?? "",
      ]);
    }
    if (result.nps) {
      chartRows.push([
        block.title,
        block.id,
        "NPS",
        result.nps.score,
        result.sampleSize ?? "",
        `promoters=${result.nps.promoters ?? ""} passives=${result.nps.passives ?? ""} detractors=${result.nps.detractors ?? ""}`,
      ]);
    }
    for (const point of result.points ?? []) {
      chartRows.push([
        block.title,
        block.id,
        point.label,
        point.value,
        point.percentage ?? "",
        result.metric ?? "",
      ]);
    }
  }
  if (chartRows.length > 0) {
    sheets.push({
      name: "Charts",
      headers: ["Analysis title", "Analysis ID", "Label", "Value", "n / %", "Notes"],
      columnTypes: ["text", "text", "text", "number", "number", "text"],
      rows: chartRows,
    });
  }

  // 7. Tables — imported datasets (capped rows)
  for (const dataset of datasets) {
    const fields = asList(dataset.fields) as Array<{ id?: string; name?: string; type?: string }>;
    const rows = asList(dataset.rows);
    if (fields.length === 0) continue;
    const headers = fields.map((f) => textOf(f.name || f.id));
    const fieldIds = fields.map((f) => textOf(f.id));
    const dataRows = rows.slice(0, DATASET_ROW_CAP).map((row) => fieldIds.map((id) => {
      const v = row[id];
      if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v;
      if (v == null) return "";
      return String(v);
    }));
    sheets.push({
      name: `Data ${dataset.name}`.slice(0, 31),
      headers,
      rows: dataRows,
      columnTypes: fields.map((f) => (f.type === "number" ? "number" : "text")),
    });
  }

  // 8. Brand Audit
  const brandAudits = await prisma.researchBrandAudit.findMany({
    where: { researchProjectId: params.researchProjectId, status: { not: "archived" } },
    include: {
      criteria: { orderBy: { position: "asc" } },
      assessments: true,
      brand: { select: { name: true } },
    },
  });
  if (brandAudits.length > 0) {
    const auditRows: TWorkbookCell[][] = [];
    for (const audit of brandAudits) {
      const byCriterion = new Map(audit.assessments.map((a) => [a.criterionId, a]));
      for (const criterion of audit.criteria) {
        const assessment = byCriterion.get(criterion.id);
        auditRows.push([
          audit.name,
          audit.brand?.name ?? "",
          audit.status,
          criterion.name,
          criterion.category,
          assessment?.score ?? "",
          assessment?.comment ?? "",
        ]);
      }
      const swot = audit.swot as {
        strengths?: string[];
        weaknesses?: string[];
        opportunities?: string[];
        threats?: string[];
      };
      for (const s of swot.strengths ?? []) auditRows.push([audit.name, "", "SWOT", "Strength", s, "", ""]);
      for (const s of swot.weaknesses ?? []) auditRows.push([audit.name, "", "SWOT", "Weakness", s, "", ""]);
      for (const s of swot.opportunities ?? [])
        auditRows.push([audit.name, "", "SWOT", "Opportunity", s, "", ""]);
      for (const s of swot.threats ?? []) auditRows.push([audit.name, "", "SWOT", "Threat", s, "", ""]);
    }
    sheets.push({
      name: "Brand Audit",
      headers: ["Audit", "Brand", "Status / SWOT", "Criterion", "Category / Text", "Score", "Comment"],
      rows: auditRows,
    });
  }

  // 9. Sources
  const sourceRows: Array<[string, string, string]> = [];
  for (const link of surveyLinks) {
    sourceRows.push(["survey", link.survey.id, link.survey.name]);
  }
  for (const interview of interviews) {
    sourceRows.push(["interview", interview.id, interview.name]);
  }
  for (const dataset of datasets) {
    sourceRows.push(["dataset", dataset.id, dataset.name]);
  }
  for (const block of params.blocks) {
    if (block.content.kind === "analysis") {
      sourceRows.push(["report_embed_analysis", block.content.analysisBlockId, block.id]);
    }
    if (block.content.kind === "insight") {
      sourceRows.push(["report_embed_insight", block.content.insightId, block.id]);
    }
  }
  if (sourceRows.length > 0) {
    sheets.push({
      name: "Sources",
      headers: ["Type", "ID", "Label"],
      rows: sourceRows,
    });
  }

  // 10. Metadata (always)
  sheets.push({
    name: "Metadata",
    headers: ["Key", "Value"],
    rows: [
      ["exportType", "xlsx"],
      ["reportId", params.reportId],
      ["reportVersionId", params.reportVersionId ?? ""],
      ["researchProjectId", params.researchProjectId],
      ["exportedAt", new Date().toISOString()],
      ["exportedBy", params.actorEmail ?? ""],
      ["datasetRowCap", DATASET_ROW_CAP],
      ["note", "Full survey response dumps remain available from the survey Responses export."],
    ],
  });

  return buildResearchWorkbookBuffer(sheets);
};

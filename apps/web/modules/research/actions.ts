"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/modules/survey/lib/organization";
import { getResearchActivity } from "@/modules/research/lib/activity";
import {
  assertCanAccessOrganizationResearch,
  assertResearchCapability,
} from "@/modules/research/lib/authorization";
import {
  applyCodeToSegment,
  createResearchCode,
  getCodingMatrix,
  listResearchCodes,
  mergeResearchCodes,
  removeCodeFromSegment,
  updateResearchCode,
} from "@/modules/research/lib/codes";
import {
  createInsightFromSegment,
  createResearchInsight,
  listResearchInsights,
} from "@/modules/research/lib/insights";
import {
  createResearchBrandAudit,
  deleteResearchBrandAudit,
  getResearchBrandAudit,
  listResearchBrandAudits,
  updateResearchBrandAudit,
  upsertBrandAuditAssessment,
} from "@/modules/research/lib/brand-audit/brand-audits";
import {
  createResearchDatasetFromParsed,
  deleteResearchDataset,
  listResearchDatasets,
  parseCsvDataset,
  parseXlsxDataset,
} from "@/modules/research/lib/analysis/datasets";
import {
  createResearchReport,
  createResearchReportVersion,
  deleteResearchReport,
  getResearchReport,
  listResearchReportThemes,
  listResearchReports,
  saveResearchReportBlocks,
  updateResearchReportMeta,
  updateResearchReportStatus,
  upsertResearchReportTheme,
} from "@/modules/research/lib/reports/reports";
import {
  getResearchExportDownload,
  getResearchExportJob,
  listResearchExportJobsForReport,
} from "@/modules/research/lib/export/exports";
import { createResearchPdfExportJob, createResearchXlsxExportJob } from "@/modules/research/lib/export/process-export-job";
import { getJobsQueueingConfig } from "@/lib/jobs/config";
import { getBackgroundJobProducer } from "@formbricks/jobs";
import {
  createResearchInterview,
  getResearchInterview,
  importInterviewTranscript,
  listResearchInterviews,
  searchTranscriptSegments,
  updateResearchInterview,
  updateTranscriptSegment,
} from "@/modules/research/lib/interviews";
import {
  createResearchProject,
  getResearchProject,
  getResearchProjectCounts,
  linkSurveyToResearchProject,
  listOrganizationSurveysForLinking,
  listResearchBrands,
  listResearchClients,
  listResearchProjects,
  unlinkSurveyFromResearchProject,
  updateResearchProject,
} from "@/modules/research/lib/projects";
import {
  ZApplyCodeToSegmentInput,
  ZCreateAnalysisBlockInput,
  ZCreateInsightFromSegmentInput,
  ZCreateResearchBrandAuditInput,
  ZCreateResearchCodeInput,
  ZCreateResearchInsightInput,
  ZCreateResearchInterviewInput,
  ZCreateResearchProjectInput,
  ZCreateResearchReportInput,
  ZCreateResearchReportVersionInput,
  ZImportResearchDatasetInput,
  ZImportTranscriptInput,
  ZInsightListFilters,
  ZInterviewListFilters,
  ZPreviewChartDefinitionInput,
  ZResearchProjectListFilters,
  ZSaveResearchReportBlocksInput,
  ZTranscriptSearchInput,
  ZUpdateResearchBrandAuditInput,
  ZUpdateResearchCodeInput,
  ZUpdateResearchInterviewInput,
  ZUpdateResearchProjectInput,
  ZUpdateResearchReportMetaInput,
  ZUpdateResearchReportStatusInput,
  ZUpsertBrandAuditAssessmentInput,
  ZUpsertResearchReportThemeInput,
} from "@/modules/research/types";
import { prisma } from "@formbricks/database";
import { createId } from "@paralleldrive/cuid2";

const assertResearchEnabled = () => {
  if (!RESEARCH_PLATFORM_ENABLED) {
    throw new ResourceNotFoundError("ResearchPlatform", null);
  }
};

const ZWorkspaceScoped = z.object({
  workspaceId: ZId,
});

export const listResearchProjectsAction = authenticatedActionClient
  .inputSchema(ZResearchProjectListFilters)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertCanAccessOrganizationResearch(ctx.user.id, parsedInput.organizationId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [{ type: "organization", roles: ["owner", "manager", "member"] }],
    });
    return listResearchProjects(parsedInput);
  });

export const createResearchProjectAction = authenticatedActionClient
  .inputSchema(ZCreateResearchProjectInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertCanAccessOrganizationResearch(ctx.user.id, parsedInput.organizationId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [{ type: "organization", roles: ["owner", "manager", "member"] }],
    });
    return createResearchProject(parsedInput, ctx.user.id);
  });

export const getResearchProjectAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    const project = await getResearchProject(parsedInput.researchProjectId);
    if (!project) {
      throw new ResourceNotFoundError("ResearchProject", parsedInput.researchProjectId);
    }
    return project;
  });

export const updateResearchProjectAction = authenticatedActionClient
  .inputSchema(
    z.object({
      researchProjectId: ZId,
      data: ZUpdateResearchProjectInput,
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const capability = parsedInput.data.status === "archived" ? "archive" : "edit";
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, capability);
    return updateResearchProject(parsedInput.researchProjectId, parsedInput.data, ctx.user.id);
  });

export const linkSurveyToResearchProjectAction = authenticatedActionClient
  .inputSchema(
    z.object({
      researchProjectId: ZId,
      surveyId: ZId,
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const access = await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "link_surveys");
    await linkSurveyToResearchProject({
      researchProjectId: parsedInput.researchProjectId,
      surveyId: parsedInput.surveyId,
      organizationId: access.organizationId,
      actorId: ctx.user.id,
    });
    return { success: true };
  });

export const unlinkSurveyFromResearchProjectAction = authenticatedActionClient
  .inputSchema(
    z.object({
      researchProjectId: ZId,
      surveyId: ZId,
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "link_surveys");
    await unlinkSurveyFromResearchProject({
      researchProjectId: parsedInput.researchProjectId,
      surveyId: parsedInput.surveyId,
      actorId: ctx.user.id,
    });
    return { success: true };
  });

export const listLinkableSurveysAction = authenticatedActionClient
  .inputSchema(
    z.object({
      organizationId: ZId,
      search: z.string().trim().max(200).optional(),
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertCanAccessOrganizationResearch(ctx.user.id, parsedInput.organizationId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [{ type: "organization", roles: ["owner", "manager", "member"] }],
    });
    return listOrganizationSurveysForLinking(parsedInput.organizationId, parsedInput.search);
  });

export const listResearchClientsAction = authenticatedActionClient
  .inputSchema(z.object({ organizationId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertCanAccessOrganizationResearch(ctx.user.id, parsedInput.organizationId);
    return listResearchClients(parsedInput.organizationId);
  });

export const listResearchBrandsAction = authenticatedActionClient
  .inputSchema(
    z.object({
      organizationId: ZId,
      clientId: ZId.optional(),
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertCanAccessOrganizationResearch(ctx.user.id, parsedInput.organizationId);
    return listResearchBrands(parsedInput.organizationId, parsedInput.clientId);
  });

export const getResearchActivityAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return getResearchActivity(parsedInput.researchProjectId);
  });

export const getResearchProjectCountsAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return getResearchProjectCounts(parsedInput.researchProjectId);
  });

export const getOrganizationIdForResearchAction = authenticatedActionClient
  .inputSchema(ZWorkspaceScoped)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
    await assertCanAccessOrganizationResearch(ctx.user.id, organizationId);
    return { organizationId };
  });

// --- Qualitative research (interviews / coding / insights) ---

export const listResearchInterviewsAction = authenticatedActionClient
  .inputSchema(ZInterviewListFilters)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return listResearchInterviews(parsedInput);
  });

export const createResearchInterviewAction = authenticatedActionClient
  .inputSchema(ZCreateResearchInterviewInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "edit_interviews");
    return createResearchInterview(parsedInput, ctx.user.id);
  });

export const getResearchInterviewAction = authenticatedActionClient
  .inputSchema(z.object({ interviewId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const interview = await getResearchInterview(parsedInput.interviewId);
    if (!interview) throw new ResourceNotFoundError("ResearchInterview", parsedInput.interviewId);
    await assertResearchCapability(ctx.user.id, interview.researchProjectId, "view");
    return interview;
  });

export const updateResearchInterviewAction = authenticatedActionClient
  .inputSchema(
    z.object({
      interviewId: ZId,
      data: ZUpdateResearchInterviewInput,
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const interview = await getResearchInterview(parsedInput.interviewId);
    if (!interview) throw new ResourceNotFoundError("ResearchInterview", parsedInput.interviewId);
    await assertResearchCapability(ctx.user.id, interview.researchProjectId, "edit_interviews");
    return updateResearchInterview(parsedInput.interviewId, parsedInput.data, ctx.user.id);
  });

export const importInterviewTranscriptAction = authenticatedActionClient
  .inputSchema(ZImportTranscriptInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const interview = await getResearchInterview(parsedInput.interviewId);
    if (!interview) throw new ResourceNotFoundError("ResearchInterview", parsedInput.interviewId);
    await assertResearchCapability(ctx.user.id, interview.researchProjectId, "edit_interviews");
    return importInterviewTranscript(parsedInput, ctx.user.id);
  });

export const updateTranscriptSegmentAction = authenticatedActionClient
  .inputSchema(
    z.object({
      segmentId: ZId,
      notes: z.string().trim().max(5000).nullable().optional(),
      isQuote: z.boolean().optional(),
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    // Capability checked inside after loading segment's project — load via update helper path
    const segment = await prisma.researchTranscriptSegment.findUnique({
      where: { id: parsedInput.segmentId },
      include: {
        transcript: { select: { interview: { select: { researchProjectId: true } } } },
      },
    });
    if (!segment) throw new ResourceNotFoundError("ResearchTranscriptSegment", parsedInput.segmentId);
    await assertResearchCapability(
      ctx.user.id,
      segment.transcript.interview.researchProjectId,
      "edit_interviews"
    );
    return updateTranscriptSegment({
      segmentId: parsedInput.segmentId,
      notes: parsedInput.notes,
      isQuote: parsedInput.isQuote,
      actorId: ctx.user.id,
    });
  });

export const searchTranscriptSegmentsAction = authenticatedActionClient
  .inputSchema(ZTranscriptSearchInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return searchTranscriptSegments(parsedInput);
  });

export const listResearchCodesAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return listResearchCodes(parsedInput.researchProjectId);
  });

export const createResearchCodeAction = authenticatedActionClient
  .inputSchema(ZCreateResearchCodeInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "edit_interviews");
    return createResearchCode(parsedInput, ctx.user.id);
  });

export const updateResearchCodeAction = authenticatedActionClient
  .inputSchema(
    z.object({
      codeId: ZId,
      data: ZUpdateResearchCodeInput,
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const code = await prisma.researchCode.findUnique({
      where: { id: parsedInput.codeId },
      select: { researchProjectId: true },
    });
    if (!code) throw new ResourceNotFoundError("ResearchCode", parsedInput.codeId);
    await assertResearchCapability(ctx.user.id, code.researchProjectId, "edit_interviews");
    return updateResearchCode(parsedInput.codeId, parsedInput.data, ctx.user.id);
  });

export const mergeResearchCodesAction = authenticatedActionClient
  .inputSchema(
    z.object({
      sourceCodeId: ZId,
      targetCodeId: ZId,
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const source = await prisma.researchCode.findUnique({
      where: { id: parsedInput.sourceCodeId },
      select: { researchProjectId: true },
    });
    if (!source) throw new ResourceNotFoundError("ResearchCode", parsedInput.sourceCodeId);
    await assertResearchCapability(ctx.user.id, source.researchProjectId, "edit_interviews");
    return mergeResearchCodes({ ...parsedInput, actorId: ctx.user.id });
  });

export const applyCodeToSegmentAction = authenticatedActionClient
  .inputSchema(ZApplyCodeToSegmentInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const code = await prisma.researchCode.findUnique({
      where: { id: parsedInput.codeId },
      select: { researchProjectId: true },
    });
    if (!code) throw new ResourceNotFoundError("ResearchCode", parsedInput.codeId);
    await assertResearchCapability(ctx.user.id, code.researchProjectId, "edit_interviews");
    return applyCodeToSegment({ ...parsedInput, actorId: ctx.user.id });
  });

export const removeCodeFromSegmentAction = authenticatedActionClient
  .inputSchema(ZApplyCodeToSegmentInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const code = await prisma.researchCode.findUnique({
      where: { id: parsedInput.codeId },
      select: { researchProjectId: true },
    });
    if (!code) throw new ResourceNotFoundError("ResearchCode", parsedInput.codeId);
    await assertResearchCapability(ctx.user.id, code.researchProjectId, "edit_interviews");
    return removeCodeFromSegment({ ...parsedInput, actorId: ctx.user.id });
  });

export const getCodingMatrixAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return getCodingMatrix(parsedInput.researchProjectId);
  });

export const listResearchInsightsAction = authenticatedActionClient
  .inputSchema(ZInsightListFilters)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return listResearchInsights(parsedInput);
  });

export const createResearchInsightAction = authenticatedActionClient
  .inputSchema(ZCreateResearchInsightInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "create_insights");
    return createResearchInsight(parsedInput, ctx.user.id);
  });

export const createInsightFromSegmentAction = authenticatedActionClient
  .inputSchema(ZCreateInsightFromSegmentInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "create_insights");
    return createInsightFromSegment(parsedInput, ctx.user.id);
  });

// --- Analysis workspace ---

export const listResearchDatasetsAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return listResearchDatasets(parsedInput.researchProjectId);
  });

export const importResearchDatasetAction = authenticatedActionClient
  .inputSchema(ZImportResearchDatasetInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "edit_analysis");

    const parsed =
      parsedInput.sourceType === "csv"
        ? parseCsvDataset(parsedInput.content)
        : parseXlsxDataset(Buffer.from(parsedInput.content, "base64"));

    return createResearchDatasetFromParsed({
      researchProjectId: parsedInput.researchProjectId,
      name: parsedInput.name,
      description: parsedInput.description,
      sourceType: parsedInput.sourceType,
      fileName: parsedInput.fileName,
      fields: parsed.fields,
      rows: parsed.rows,
      actorId: ctx.user.id,
    });
  });

export const deleteResearchDatasetAction = authenticatedActionClient
  .inputSchema(z.object({ datasetId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const dataset = await prisma.researchDataset.findUnique({
      where: { id: parsedInput.datasetId },
      select: { researchProjectId: true },
    });
    if (!dataset) throw new ResourceNotFoundError("ResearchDataset", parsedInput.datasetId);
    await assertResearchCapability(ctx.user.id, dataset.researchProjectId, "edit_analysis");
    return deleteResearchDataset(parsedInput.datasetId, ctx.user.id);
  });

export const listResearchAnalysisBlocksAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return listResearchAnalysisBlocks(parsedInput.researchProjectId);
  });

export const previewChartDefinitionAction = authenticatedActionClient
  .inputSchema(ZPreviewChartDefinitionInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return previewChartDefinition(parsedInput.chartDefinition);
  });

export const createResearchAnalysisBlockAction = authenticatedActionClient
  .inputSchema(ZCreateAnalysisBlockInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "edit_analysis");
    return createResearchAnalysisBlock({
      researchProjectId: parsedInput.researchProjectId,
      title: parsedInput.title,
      description: parsedInput.description,
      analystComment: parsedInput.analystComment,
      chartDefinition: {
        ...parsedInput.chartDefinition,
        id: parsedInput.chartDefinition.id || createId(),
      },
      actorId: ctx.user.id,
    });
  });

export const refreshResearchAnalysisBlockAction = authenticatedActionClient
  .inputSchema(z.object({ blockId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const block = await prisma.researchAnalysisBlock.findUnique({
      where: { id: parsedInput.blockId },
      select: { researchProjectId: true },
    });
    if (!block) throw new ResourceNotFoundError("ResearchAnalysisBlock", parsedInput.blockId);
    await assertResearchCapability(ctx.user.id, block.researchProjectId, "edit_analysis");
    return refreshResearchAnalysisBlock(parsedInput.blockId, ctx.user.id);
  });

export const deleteResearchAnalysisBlockAction = authenticatedActionClient
  .inputSchema(z.object({ blockId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const block = await prisma.researchAnalysisBlock.findUnique({
      where: { id: parsedInput.blockId },
      select: { researchProjectId: true },
    });
    if (!block) throw new ResourceNotFoundError("ResearchAnalysisBlock", parsedInput.blockId);
    await assertResearchCapability(ctx.user.id, block.researchProjectId, "edit_analysis");
    return deleteResearchAnalysisBlock(parsedInput.blockId, ctx.user.id);
  });

export const listLinkedSurveyElementsAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");

    const links = await prisma.researchProjectSurvey.findMany({
      where: { researchProjectId: parsedInput.researchProjectId },
      include: {
        survey: {
          select: { id: true, name: true, questions: true },
        },
      },
    });

    return links.map((link) => {
      const questions = Array.isArray(link.survey.questions) ? link.survey.questions : [];
      const elements = questions
        .map((q) => {
          const question = q as { id?: string; headline?: Record<string, string> | string; type?: string };
          if (!question.id) return null;
          const headline =
            typeof question.headline === "string"
              ? question.headline
              : question.headline?.default || question.headline?.en || question.id;
          return { id: question.id, headline, type: question.type ?? "unknown" };
        })
        .filter((e): e is { id: string; headline: string; type: string } => Boolean(e));

      return {
        surveyId: link.survey.id,
        surveyName: link.survey.name,
        elements,
      };
    });
  });

// --- Report builder ---

export const listResearchReportsAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return listResearchReports(parsedInput.researchProjectId);
  });

export const getResearchReportAction = authenticatedActionClient
  .inputSchema(z.object({ reportId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const report = await getResearchReport(parsedInput.reportId);
    if (!report) throw new ResourceNotFoundError("ResearchReport", parsedInput.reportId);
    await assertResearchCapability(ctx.user.id, report.researchProjectId, "view");
    return report;
  });

export const createResearchReportAction = authenticatedActionClient
  .inputSchema(ZCreateResearchReportInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "edit_reports");
    return createResearchReport({
      researchProjectId: parsedInput.researchProjectId,
      title: parsedInput.title,
      subtitle: parsedInput.subtitle,
      themeId: parsedInput.themeId,
      actorId: ctx.user.id,
    });
  });

export const updateResearchReportMetaAction = authenticatedActionClient
  .inputSchema(ZUpdateResearchReportMetaInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const report = await getResearchReport(parsedInput.reportId);
    if (!report) throw new ResourceNotFoundError("ResearchReport", parsedInput.reportId);
    await assertResearchCapability(ctx.user.id, report.researchProjectId, "edit_reports");
    return updateResearchReportMeta({
      reportId: parsedInput.reportId,
      title: parsedInput.title,
      subtitle: parsedInput.subtitle,
      themeId: parsedInput.themeId,
      exportOptions: parsedInput.exportOptions,
      actorId: ctx.user.id,
    });
  });

export const saveResearchReportBlocksAction = authenticatedActionClient
  .inputSchema(ZSaveResearchReportBlocksInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const report = await getResearchReport(parsedInput.reportId);
    if (!report) throw new ResourceNotFoundError("ResearchReport", parsedInput.reportId);
    await assertResearchCapability(ctx.user.id, report.researchProjectId, "edit_reports");
    return saveResearchReportBlocks({
      reportId: parsedInput.reportId,
      blocks: parsedInput.blocks,
      actorId: ctx.user.id,
    });
  });

export const updateResearchReportStatusAction = authenticatedActionClient
  .inputSchema(ZUpdateResearchReportStatusInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const report = await getResearchReport(parsedInput.reportId);
    if (!report) throw new ResourceNotFoundError("ResearchReport", parsedInput.reportId);

    const needsApprove =
      parsedInput.status === "approved" || parsedInput.status === "published";
    await assertResearchCapability(
      ctx.user.id,
      report.researchProjectId,
      needsApprove ? "approve_reports" : "edit_reports"
    );

    return updateResearchReportStatus({
      reportId: parsedInput.reportId,
      status: parsedInput.status,
      actorId: ctx.user.id,
    });
  });

export const createResearchReportVersionAction = authenticatedActionClient
  .inputSchema(ZCreateResearchReportVersionInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const report = await getResearchReport(parsedInput.reportId);
    if (!report) throw new ResourceNotFoundError("ResearchReport", parsedInput.reportId);
    await assertResearchCapability(ctx.user.id, report.researchProjectId, "edit_reports");
    return createResearchReportVersion({
      reportId: parsedInput.reportId,
      label: parsedInput.label,
      note: parsedInput.note,
      actorId: ctx.user.id,
    });
  });

export const deleteResearchReportAction = authenticatedActionClient
  .inputSchema(z.object({ reportId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const report = await getResearchReport(parsedInput.reportId);
    if (!report) throw new ResourceNotFoundError("ResearchReport", parsedInput.reportId);
    await assertResearchCapability(ctx.user.id, report.researchProjectId, "edit_reports");
    await deleteResearchReport(parsedInput.reportId, ctx.user.id);
    return { ok: true as const };
  });

export const listResearchReportThemesAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const access = await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return listResearchReportThemes(access.organizationId);
  });

export const upsertResearchReportThemeAction = authenticatedActionClient
  .inputSchema(ZUpsertResearchReportThemeInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertCanAccessOrganizationResearch(ctx.user.id, parsedInput.organizationId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [{ type: "organization", roles: ["owner", "manager"] }],
    });
    return upsertResearchReportTheme(parsedInput);
  });

// --- PDF export ---

export const startResearchReportPdfExportAction = authenticatedActionClient
  .inputSchema(
    z.object({
      reportId: ZId,
      reportVersionId: ZId.optional(),
      includeToc: z.boolean().optional(),
      orientation: z.enum(["portrait", "landscape"]).optional(),
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const report = await getResearchReport(parsedInput.reportId);
    if (!report) throw new ResourceNotFoundError("ResearchReport", parsedInput.reportId);
    await assertResearchCapability(ctx.user.id, report.researchProjectId, "export");

    const queueing = getJobsQueueingConfig();
    const processInline = !queueing.enabled;

    const job = await createResearchPdfExportJob({
      reportId: parsedInput.reportId,
      reportVersionId: parsedInput.reportVersionId,
      actorId: ctx.user.id,
      options: {
        includeToc: parsedInput.includeToc,
        orientation: parsedInput.orientation,
      },
      processInline,
    });

    if (!processInline && job.status === "queued") {
      const producer = getBackgroundJobProducer();
      await producer.enqueueResearchExportPdf({ exportJobId: job.id });
    }

    return getResearchExportJob(job.id);
  });

export const getResearchExportJobAction = authenticatedActionClient
  .inputSchema(z.object({ exportJobId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const job = await getResearchExportJob(parsedInput.exportJobId);
    if (!job) throw new ResourceNotFoundError("ResearchExportJob", parsedInput.exportJobId);
    await assertResearchCapability(ctx.user.id, job.researchProjectId, "view");
    return job;
  });

export const listResearchExportJobsAction = authenticatedActionClient
  .inputSchema(
    z.object({
      reportId: ZId,
      type: z.enum(["pdf", "xlsx"]).optional(),
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const report = await getResearchReport(parsedInput.reportId);
    if (!report) throw new ResourceNotFoundError("ResearchReport", parsedInput.reportId);
    await assertResearchCapability(ctx.user.id, report.researchProjectId, "view");
    return listResearchExportJobsForReport(parsedInput.reportId, parsedInput.type);
  });

export const downloadResearchExportAction = authenticatedActionClient
  .inputSchema(z.object({ exportJobId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const job = await getResearchExportJob(parsedInput.exportJobId);
    if (!job) throw new ResourceNotFoundError("ResearchExportJob", parsedInput.exportJobId);
    await assertResearchCapability(ctx.user.id, job.researchProjectId, "export");
    return getResearchExportDownload(parsedInput.exportJobId);
  });

export const startResearchReportXlsxExportAction = authenticatedActionClient
  .inputSchema(
    z.object({
      reportId: ZId,
      reportVersionId: ZId.optional(),
    })
  )
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const report = await getResearchReport(parsedInput.reportId);
    if (!report) throw new ResourceNotFoundError("ResearchReport", parsedInput.reportId);
    await assertResearchCapability(ctx.user.id, report.researchProjectId, "export");

    const queueing = getJobsQueueingConfig();
    const processInline = !queueing.enabled;

    const job = await createResearchXlsxExportJob({
      reportId: parsedInput.reportId,
      reportVersionId: parsedInput.reportVersionId,
      actorId: ctx.user.id,
      processInline,
    });

    if (!processInline && job.status === "queued") {
      const producer = getBackgroundJobProducer();
      await producer.enqueueResearchExportXlsx({ exportJobId: job.id });
    }

    return getResearchExportJob(job.id);
  });

// --- Brand audit ---

export const listResearchBrandAuditsAction = authenticatedActionClient
  .inputSchema(z.object({ researchProjectId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "view");
    return listResearchBrandAudits(parsedInput.researchProjectId);
  });

export const getResearchBrandAuditAction = authenticatedActionClient
  .inputSchema(z.object({ brandAuditId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const audit = await getResearchBrandAudit(parsedInput.brandAuditId);
    if (!audit) throw new ResourceNotFoundError("ResearchBrandAudit", parsedInput.brandAuditId);
    await assertResearchCapability(ctx.user.id, audit.researchProjectId, "view");
    return audit;
  });

export const createResearchBrandAuditAction = authenticatedActionClient
  .inputSchema(ZCreateResearchBrandAuditInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    await assertResearchCapability(ctx.user.id, parsedInput.researchProjectId, "edit_brand_audit");
    return createResearchBrandAudit(parsedInput, ctx.user.id);
  });

export const updateResearchBrandAuditAction = authenticatedActionClient
  .inputSchema(ZUpdateResearchBrandAuditInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const audit = await getResearchBrandAudit(parsedInput.brandAuditId);
    if (!audit) throw new ResourceNotFoundError("ResearchBrandAudit", parsedInput.brandAuditId);
    await assertResearchCapability(ctx.user.id, audit.researchProjectId, "edit_brand_audit");
    return updateResearchBrandAudit(parsedInput, ctx.user.id);
  });

export const upsertBrandAuditAssessmentAction = authenticatedActionClient
  .inputSchema(ZUpsertBrandAuditAssessmentInput)
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const audit = await getResearchBrandAudit(parsedInput.brandAuditId);
    if (!audit) throw new ResourceNotFoundError("ResearchBrandAudit", parsedInput.brandAuditId);
    await assertResearchCapability(ctx.user.id, audit.researchProjectId, "edit_brand_audit");
    return upsertBrandAuditAssessment(parsedInput, ctx.user.id);
  });

export const deleteResearchBrandAuditAction = authenticatedActionClient
  .inputSchema(z.object({ brandAuditId: ZId }))
  .action(async ({ ctx, parsedInput }) => {
    assertResearchEnabled();
    const audit = await getResearchBrandAudit(parsedInput.brandAuditId);
    if (!audit) throw new ResourceNotFoundError("ResearchBrandAudit", parsedInput.brandAuditId);
    await assertResearchCapability(ctx.user.id, audit.researchProjectId, "edit_brand_audit");
    await deleteResearchBrandAudit(parsedInput.brandAuditId, ctx.user.id);
    return { ok: true as const };
  });

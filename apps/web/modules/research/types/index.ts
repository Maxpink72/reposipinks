import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZResearchChartDefinition as ZResearchChartDefinitionSchema } from "@/modules/research/types/chart-definition";

export const ZResearchProjectStatus = z.enum([
  "draft",
  "planning",
  "recruiting",
  "fieldwork",
  "analysis",
  "reporting",
  "completed",
  "archived",
]);
export type TResearchProjectStatus = z.infer<typeof ZResearchProjectStatus>;

export const ZResearchMemberRole = z.enum([
  "owner",
  "admin",
  "research_lead",
  "researcher",
  "analyst",
  "viewer",
]);
export type TResearchMemberRole = z.infer<typeof ZResearchMemberRole>;

export const ZResearchMethodType = z.enum([
  "quantitative_survey",
  "depth_interview",
  "expert_interview",
  "focus_group",
  "brand_audit",
  "desk_research",
  "competitive_analysis",
  "review_analysis",
  "concept_test",
  "name_test",
  "identity_test",
  "brand_perception",
]);
export type TResearchMethodType = z.infer<typeof ZResearchMethodType>;

export const ZResearchGoal = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export const ZResearchQuestionItem = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export const ZResearchHypothesis = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export const ZResearchClient = z.object({
  id: ZId,
  organizationId: ZId,
  name: z.string().min(1).max(200),
  logoUrl: z.string().nullable(),
  industry: z.string().nullable(),
  website: z.string().nullable(),
  description: z.string().nullable(),
  contacts: z.array(z.record(z.string(), z.unknown())),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TResearchClient = z.infer<typeof ZResearchClient>;

export const ZResearchBrand = z.object({
  id: ZId,
  organizationId: ZId,
  clientId: ZId.nullable(),
  name: z.string().min(1).max(200),
  logoUrl: z.string().nullable(),
  website: z.string().nullable(),
  description: z.string().nullable(),
  market: z.string().nullable(),
  competitors: z.array(z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TResearchBrand = z.infer<typeof ZResearchBrand>;

export const ZResearchProject = z.object({
  id: ZId,
  organizationId: ZId,
  workspaceId: ZId.nullable(),
  clientId: ZId.nullable(),
  brandId: ZId.nullable(),
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
  researchType: z.string().nullable(),
  status: ZResearchProjectStatus,
  ownerId: ZId,
  startsAt: z.date().nullable(),
  endsAt: z.date().nullable(),
  isFavorite: z.boolean(),
  plan: z.record(z.string(), z.unknown()),
  goals: z.array(ZResearchGoal),
  researchQuestions: z.array(ZResearchQuestionItem),
  hypotheses: z.array(ZResearchHypothesis),
  methods: z.array(ZResearchMethodType),
  audience: z.record(z.string(), z.unknown()),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TResearchProject = z.infer<typeof ZResearchProject>;

export const ZCreateResearchProjectInput = z.object({
  organizationId: ZId,
  workspaceId: ZId.optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  researchType: z.string().trim().max(200).optional(),
  status: ZResearchProjectStatus.optional(),
  clientId: ZId.optional(),
  brandId: ZId.optional(),
  clientName: z.string().trim().min(1).max(200).optional(),
  brandName: z.string().trim().min(1).max(200).optional(),
  methods: z.array(ZResearchMethodType).optional(),
  goals: z.array(ZResearchGoal).optional(),
  researchQuestions: z.array(ZResearchQuestionItem).optional(),
  hypotheses: z.array(ZResearchHypothesis).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});
export type TCreateResearchProjectInput = z.infer<typeof ZCreateResearchProjectInput>;

export const ZUpdateResearchProjectInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  researchType: z.string().trim().max(200).nullable().optional(),
  status: ZResearchProjectStatus.optional(),
  clientId: ZId.nullable().optional(),
  brandId: ZId.nullable().optional(),
  methods: z.array(ZResearchMethodType).optional(),
  goals: z.array(ZResearchGoal).optional(),
  researchQuestions: z.array(ZResearchQuestionItem).optional(),
  hypotheses: z.array(ZResearchHypothesis).optional(),
  plan: z.record(z.string(), z.unknown()).optional(),
  audience: z.record(z.string(), z.unknown()).optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  isFavorite: z.boolean().optional(),
});
export type TUpdateResearchProjectInput = z.infer<typeof ZUpdateResearchProjectInput>;

export const ZResearchProjectListFilters = z.object({
  organizationId: ZId,
  search: z.string().trim().max(200).optional(),
  status: ZResearchProjectStatus.optional(),
  clientId: ZId.optional(),
  brandId: ZId.optional(),
  ownerId: ZId.optional(),
  researchType: z.string().trim().max(200).optional(),
  isFavorite: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
  sortBy: z.enum(["updatedAt", "createdAt", "name", "status"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});
export type TResearchProjectListFilters = z.infer<typeof ZResearchProjectListFilters>;

export type TResearchCapability =
  | "view"
  | "edit"
  | "manage_members"
  | "link_surveys"
  | "view_raw_responses"
  | "edit_interviews"
  | "create_insights"
  | "edit_analysis"
  | "edit_reports"
  | "approve_reports"
  | "edit_brand_audit"
  | "export"
  | "archive"
  | "delete";

export const RESEARCH_ROLE_CAPABILITIES: Record<TResearchMemberRole, readonly TResearchCapability[]> = {
  owner: [
    "view",
    "edit",
    "manage_members",
    "link_surveys",
    "view_raw_responses",
    "edit_interviews",
    "create_insights",
    "edit_analysis",
    "edit_reports",
    "approve_reports",
    "edit_brand_audit",
    "export",
    "archive",
    "delete",
  ],
  admin: [
    "view",
    "edit",
    "manage_members",
    "link_surveys",
    "view_raw_responses",
    "edit_interviews",
    "create_insights",
    "edit_analysis",
    "edit_reports",
    "approve_reports",
    "edit_brand_audit",
    "export",
    "archive",
    "delete",
  ],
  research_lead: [
    "view",
    "edit",
    "manage_members",
    "link_surveys",
    "view_raw_responses",
    "edit_interviews",
    "create_insights",
    "edit_analysis",
    "edit_reports",
    "approve_reports",
    "edit_brand_audit",
    "export",
  ],
  researcher: [
    "view",
    "edit",
    "link_surveys",
    "view_raw_responses",
    "edit_interviews",
    "create_insights",
    "edit_analysis",
    "edit_brand_audit",
    "export",
  ],
  analyst: [
    "view",
    "view_raw_responses",
    "create_insights",
    "edit_analysis",
    "edit_reports",
    "edit_brand_audit",
    "export",
  ],
  viewer: ["view", "export"],
} as const;

export const ZResearchInterviewStatus = z.enum([
  "planned",
  "scheduled",
  "completed",
  "transcribed",
  "coded",
  "analyzed",
]);
export type TResearchInterviewStatus = z.infer<typeof ZResearchInterviewStatus>;

export const ZResearchInsightType = z.enum([
  "finding",
  "pattern",
  "tension",
  "need",
  "motivation",
  "barrier",
  "opportunity",
  "hypothesis",
  "recommendation",
]);
export type TResearchInsightType = z.infer<typeof ZResearchInsightType>;

export const ZResearchInsightConfidence = z.enum(["low", "medium", "high"]);
export type TResearchInsightConfidence = z.infer<typeof ZResearchInsightConfidence>;

export const ZResearchInsightImportance = z.enum(["low", "medium", "high", "critical"]);
export type TResearchInsightImportance = z.infer<typeof ZResearchInsightImportance>;

export const ZCreateResearchInterviewInput = z.object({
  researchProjectId: ZId,
  name: z.string().trim().min(1).max(200),
  respondentName: z.string().trim().max(200).optional(),
  respondentSegment: z.string().trim().max(200).optional(),
  interviewerId: ZId.optional(),
  scheduledAt: z.coerce.date().optional(),
  status: ZResearchInterviewStatus.optional(),
  durationMinutes: z.number().int().min(0).max(24 * 60).optional(),
  notes: z.string().trim().max(10000).optional(),
  mediaUrl: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).optional(),
});
export type TCreateResearchInterviewInput = z.infer<typeof ZCreateResearchInterviewInput>;

export const ZUpdateResearchInterviewInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  respondentName: z.string().trim().max(200).nullable().optional(),
  respondentSegment: z.string().trim().max(200).nullable().optional(),
  interviewerId: ZId.nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  status: ZResearchInterviewStatus.optional(),
  durationMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  notes: z.string().trim().max(10000).nullable().optional(),
  mediaUrl: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(100)).optional(),
});
export type TUpdateResearchInterviewInput = z.infer<typeof ZUpdateResearchInterviewInput>;

export const ZImportTranscriptInput = z.object({
  interviewId: ZId,
  rawText: z.string().min(1).max(500_000),
  language: z.string().trim().max(20).optional(),
  source: z.enum(["paste", "import", "upload_link"]).optional(),
});
export type TImportTranscriptInput = z.infer<typeof ZImportTranscriptInput>;

export const ZCreateResearchCodeInput = z.object({
  researchProjectId: ZId,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  color: z
    .string()
    .regex(/^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/)
    .optional(),
});
export type TCreateResearchCodeInput = z.infer<typeof ZCreateResearchCodeInput>;

export const ZUpdateResearchCodeInput = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  color: z
    .string()
    .regex(/^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/)
    .optional(),
});
export type TUpdateResearchCodeInput = z.infer<typeof ZUpdateResearchCodeInput>;

export const ZApplyCodeToSegmentInput = z.object({
  segmentId: ZId,
  codeId: ZId,
});

export const ZCreateInsightFromSegmentInput = z.object({
  researchProjectId: ZId,
  segmentId: ZId,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional(),
  type: ZResearchInsightType.optional(),
  confidence: ZResearchInsightConfidence.optional(),
  importance: ZResearchInsightImportance.optional(),
  tags: z.array(z.string().trim().min(1).max(100)).optional(),
});
export type TCreateInsightFromSegmentInput = z.infer<typeof ZCreateInsightFromSegmentInput>;

export const ZCreateResearchInsightInput = z.object({
  researchProjectId: ZId,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional(),
  type: ZResearchInsightType.optional(),
  confidence: ZResearchInsightConfidence.optional(),
  importance: ZResearchInsightImportance.optional(),
  tags: z.array(z.string().trim().min(1).max(100)).optional(),
});
export type TCreateResearchInsightInput = z.infer<typeof ZCreateResearchInsightInput>;

export const ZInterviewListFilters = z.object({
  researchProjectId: ZId,
  search: z.string().trim().max(200).optional(),
  status: ZResearchInterviewStatus.optional(),
  segment: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(100).optional(),
});
export type TInterviewListFilters = z.infer<typeof ZInterviewListFilters>;

export const ZInsightListFilters = z.object({
  researchProjectId: ZId,
  search: z.string().trim().max(200).optional(),
  type: ZResearchInsightType.optional(),
  importance: ZResearchInsightImportance.optional(),
});
export type TInsightListFilters = z.infer<typeof ZInsightListFilters>;

export const ZTranscriptSearchInput = z.object({
  researchProjectId: ZId,
  query: z.string().trim().min(1).max(200),
  interviewId: ZId.optional(),
  tag: z.string().trim().max(100).optional(),
  segment: z.string().trim().max(200).optional(),
});
export type TTranscriptSearchInput = z.infer<typeof ZTranscriptSearchInput>;

export const ZImportResearchDatasetInput = z.object({
  researchProjectId: ZId,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  sourceType: z.enum(["csv", "xlsx"]),
  fileName: z.string().trim().max(300).optional(),
  /** Base64-encoded file contents for xlsx, or UTF-8 text for csv */
  content: z.string().min(1).max(8_000_000),
});
export type TImportResearchDatasetInput = z.infer<typeof ZImportResearchDatasetInput>;

export {
  SMALL_SAMPLE_THRESHOLD,
  ZResearchChartDefinition,
  ZResearchChartResult,
  ZResearchChartType,
  ZResearchMetricType,
  recommendChartType,
  type TResearchChartDefinition,
  type TResearchChartResult,
  type TResearchChartType,
  type TResearchMetricType,
} from "@/modules/research/types/chart-definition";


export const ZCreateAnalysisBlockInput = z.object({
  researchProjectId: ZId,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  analystComment: z.string().trim().max(5000).optional(),
  chartDefinition: ZResearchChartDefinitionSchema,
});
export type TCreateAnalysisBlockInput = z.infer<typeof ZCreateAnalysisBlockInput>;

export const ZPreviewChartDefinitionInput = z.object({
  researchProjectId: ZId,
  chartDefinition: ZResearchChartDefinitionSchema,
});

export {
  DEFAULT_REPORT_THEME_TOKENS,
  ZCreateResearchReportInput,
  ZCreateResearchReportVersionInput,
  ZResearchReportBlockType,
  ZResearchReportStatus,
  ZSaveResearchReportBlocksInput,
  ZUpdateResearchReportMetaInput,
  ZUpdateResearchReportStatusInput,
  ZUpsertResearchReportThemeInput,
  defaultContentForBlockType,
  type TCreateResearchReportInput,
  type TResearchReportBlockContent,
  type TResearchReportBlockType,
  type TResearchReportStatus,
  type TResearchReportThemeTokens,
} from "@/modules/research/types/report";

export {
  AGENCY_DEFAULT_BRAND_AUDIT_CRITERIA,
  ZCreateResearchBrandAuditInput,
  ZUpdateResearchBrandAuditInput,
  ZUpsertBrandAuditAssessmentInput,
  ZResearchBrandAuditStatus,
  computeWeightedAuditScore,
  type TCreateResearchBrandAuditInput,
  type TResearchBrandAuditStatus,
  type TUpdateResearchBrandAuditInput,
  type TUpsertBrandAuditAssessmentInput,
} from "@/modules/research/types/brand-audit";


import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { ResearchReportBuilder } from "@/modules/research/components/research-report-builder";
import { listResearchAnalysisBlocks } from "@/modules/research/lib/analysis/blocks";
import {
  assertResearchCapability,
  roleHasCapability,
} from "@/modules/research/lib/authorization";
import { listResearchBrandAudits } from "@/modules/research/lib/brand-audit/brand-audits";
import { listResearchInsights } from "@/modules/research/lib/insights";
import { getResearchProject } from "@/modules/research/lib/projects";
import {
  ensureDefaultReportTheme,
  getResearchReport,
  listResearchReportThemes,
} from "@/modules/research/lib/reports/reports";
import type {
  TResearchReportBlockContent,
  TResearchReportBlockType,
  TResearchReportStatus,
} from "@/modules/research/types/report";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface ReportDetailPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string; reportId: string }>;
}

const ReportDetailPage = async ({ params }: ReportDetailPageProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) notFound();

  const { workspaceId, researchProjectId, reportId } = await params;
  const { session, isBilling, organization } = await getWorkspaceAuth(workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  const access = await assertResearchCapability(session.user.id, researchProjectId, "view");
  const project = await getResearchProject(researchProjectId);
  if (!project || project.organizationId !== organization.id) {
    throw new ResourceNotFoundError("ResearchProject", researchProjectId);
  }

  const report = await getResearchReport(reportId);
  if (!report || report.researchProjectId !== researchProjectId) {
    throw new ResourceNotFoundError("ResearchReport", reportId);
  }

  await ensureDefaultReportTheme(organization.id);

  const [themes, analysisBlocks, insights, brandAudits] = await Promise.all([
    listResearchReportThemes(organization.id),
    listResearchAnalysisBlocks(researchProjectId),
    listResearchInsights({ researchProjectId }),
    listResearchBrandAudits(researchProjectId),
  ]);

  const initialBlocks = report.blocks.map(
    (b: { id: string; type: string; content: unknown }) => ({
      id: b.id,
      type: b.type as TResearchReportBlockType,
      content: b.content as TResearchReportBlockContent,
    })
  );

  return (
    <ResearchReportBuilder
      workspaceId={workspaceId}
      researchProjectId={researchProjectId}
      reportId={report.id}
      initialTitle={report.title}
      initialSubtitle={report.subtitle}
      initialStatus={report.status as TResearchReportStatus}
      initialThemeId={report.themeId}
      initialBlocks={initialBlocks}
      themes={themes.map((th: { id: string; name: string; tokens: unknown; isDefault: boolean }) => ({
        id: th.id,
        name: th.name,
        tokens: th.tokens,
        isDefault: th.isDefault,
      }))}
      analysisBlocks={analysisBlocks.map((a: { id: string; title: string; lastResult: unknown }) => ({
        id: a.id,
        title: a.title,
        lastResult: a.lastResult,
      }))}
      insights={insights.map((i: { id: string; title: string; description: string | null; type: string }) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        type: i.type,
      }))}
      brandAudits={brandAudits.map((b: { id: string; name: string; status: string }) => ({
        id: b.id,
        name: b.name,
        status: b.status,
      }))}
      versions={report.versions.map(
        (v: { id: string; versionNumber: number; label: string | null; createdAt: Date }) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          label: v.label,
          createdAt: v.createdAt,
        })
      )}
      canEdit={roleHasCapability(access.role, "edit_reports")}
      canApprove={roleHasCapability(access.role, "approve_reports")}
      canExport={roleHasCapability(access.role, "export")}
    />
  );
};

export default ReportDetailPage;

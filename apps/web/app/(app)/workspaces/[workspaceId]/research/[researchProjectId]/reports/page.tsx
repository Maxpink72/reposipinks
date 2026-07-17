import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { ResearchReportsList } from "@/modules/research/components/research-reports-list";
import {
  assertResearchCapability,
  roleHasCapability,
} from "@/modules/research/lib/authorization";
import { getResearchProject } from "@/modules/research/lib/projects";
import { listResearchReports } from "@/modules/research/lib/reports/reports";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface ReportsPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string }>;
}

const ReportsPage = async ({ params }: ReportsPageProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) notFound();

  const { workspaceId, researchProjectId } = await params;
  const { session, isBilling, organization } = await getWorkspaceAuth(workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  const access = await assertResearchCapability(session.user.id, researchProjectId, "view");
  const project = await getResearchProject(researchProjectId);
  if (!project || project.organizationId !== organization.id) {
    throw new ResourceNotFoundError("ResearchProject", researchProjectId);
  }

  const reports = await listResearchReports(researchProjectId);

  return (
    <ResearchReportsList
      workspaceId={workspaceId}
      researchProjectId={researchProjectId}
      initialReports={reports as Parameters<typeof ResearchReportsList>[0]["initialReports"]}
      canEdit={roleHasCapability(access.role, "edit_reports")}
    />
  );
};

export default ReportsPage;

import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { ResearchOverview } from "@/modules/research/components/research-overview";
import { assertResearchCapability } from "@/modules/research/lib/authorization";
import { getResearchProject, getResearchProjectCounts } from "@/modules/research/lib/projects";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface ResearchOverviewPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string }>;
}

const ResearchOverviewPage = async ({ params }: ResearchOverviewPageProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) {
    notFound();
  }

  const { workspaceId, researchProjectId } = await params;
  const { session, isBilling, organization } = await getWorkspaceAuth(workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  await assertResearchCapability(session.user.id, researchProjectId, "view");
  const [project, counts] = await Promise.all([
    getResearchProject(researchProjectId),
    getResearchProjectCounts(researchProjectId),
  ]);

  if (!project || project.organizationId !== organization.id) {
    throw new ResourceNotFoundError("ResearchProject", researchProjectId);
  }

  return (
    <ResearchOverview
      workspaceId={workspaceId}
      project={project}
      responseCount={counts.responseCount}
      interviewCount={counts.interviewCount}
      insightCount={counts.insightCount}
    />
  );
};

export default ResearchOverviewPage;

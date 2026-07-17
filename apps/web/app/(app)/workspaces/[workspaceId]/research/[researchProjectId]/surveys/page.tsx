import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { ResearchSurveysPanel } from "@/modules/research/components/research-surveys-panel";
import {
  assertResearchCapability,
  roleHasCapability,
} from "@/modules/research/lib/authorization";
import { getResearchProject } from "@/modules/research/lib/projects";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface ResearchSurveysPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string }>;
}

const ResearchSurveysPage = async ({ params }: ResearchSurveysPageProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) {
    notFound();
  }

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

  return (
    <ResearchSurveysPanel
      workspaceId={workspaceId}
      organizationId={organization.id}
      project={project}
      canLink={roleHasCapability(access.role, "link_surveys")}
    />
  );
};

export default ResearchSurveysPage;

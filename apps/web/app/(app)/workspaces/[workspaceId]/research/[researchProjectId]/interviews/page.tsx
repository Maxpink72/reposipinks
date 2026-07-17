import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { ResearchInterviewsPanel } from "@/modules/research/components/research-interviews-panel";
import {
  assertResearchCapability,
  roleHasCapability,
} from "@/modules/research/lib/authorization";
import { getResearchProject } from "@/modules/research/lib/projects";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface InterviewsPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string }>;
}

const InterviewsPage = async ({ params }: InterviewsPageProps) => {
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

  return (
    <ResearchInterviewsPanel
      workspaceId={workspaceId}
      researchProjectId={researchProjectId}
      canEdit={roleHasCapability(access.role, "edit_interviews")}
    />
  );
};

export default InterviewsPage;

import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { InterviewDetailPageClient } from "@/modules/research/components/interview-detail-page-client";
import {
  assertResearchCapability,
  roleHasCapability,
} from "@/modules/research/lib/authorization";
import { getResearchInterview } from "@/modules/research/lib/interviews";
import { getResearchProject } from "@/modules/research/lib/projects";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface InterviewDetailPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string; interviewId: string }>;
}

const InterviewDetailPage = async ({ params }: InterviewDetailPageProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) notFound();

  const { workspaceId, researchProjectId, interviewId } = await params;
  const { session, isBilling, organization } = await getWorkspaceAuth(workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  const access = await assertResearchCapability(session.user.id, researchProjectId, "view");
  const [project, interview] = await Promise.all([
    getResearchProject(researchProjectId),
    getResearchInterview(interviewId),
  ]);

  if (!project || project.organizationId !== organization.id) {
    throw new ResourceNotFoundError("ResearchProject", researchProjectId);
  }
  if (!interview || interview.researchProjectId !== researchProjectId) {
    throw new ResourceNotFoundError("ResearchInterview", interviewId);
  }

  return (
    <InterviewDetailPageClient
      workspaceId={workspaceId}
      researchProjectId={researchProjectId}
      interviewId={interviewId}
      canEdit={roleHasCapability(access.role, "edit_interviews")}
      canCreateInsights={roleHasCapability(access.role, "create_insights")}
    />
  );
};

export default InterviewDetailPage;

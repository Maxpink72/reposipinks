import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { ResearchAnalysisWorkspace } from "@/modules/research/components/research-analysis-workspace";
import {
  assertResearchCapability,
  roleHasCapability,
} from "@/modules/research/lib/authorization";
import { getResearchProject } from "@/modules/research/lib/projects";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface AnalysisPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string }>;
}

const AnalysisPage = async ({ params }: AnalysisPageProps) => {
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
    <ResearchAnalysisWorkspace
      researchProjectId={researchProjectId}
      canEdit={roleHasCapability(access.role, "edit_analysis")}
    />
  );
};

export default AnalysisPage;

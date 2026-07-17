import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { ResearchProjectTabs } from "@/modules/research/components/research-project-tabs";
import { assertResearchCapability } from "@/modules/research/lib/authorization";
import { getResearchProject } from "@/modules/research/lib/projects";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface ResearchProjectLayoutProps {
  params: Promise<{ workspaceId: string; researchProjectId: string }>;
  children: React.ReactNode;
}

const ResearchProjectLayout = async ({ params, children }: ResearchProjectLayoutProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) {
    notFound();
  }

  const { workspaceId, researchProjectId } = await params;
  const { session, isBilling, organization } = await getWorkspaceAuth(workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  await assertResearchCapability(session.user.id, researchProjectId, "view");
  const project = await getResearchProject(researchProjectId);

  if (!project || project.organizationId !== organization.id) {
    throw new ResourceNotFoundError("ResearchProject", researchProjectId);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ResearchProjectTabs
        workspaceId={workspaceId}
        researchProjectId={researchProjectId}
        projectName={project.name}
      />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
};

export default ResearchProjectLayout;

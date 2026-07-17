import { notFound, redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { CreateResearchProjectForm } from "@/modules/research/components/create-research-project-form";
import { getOrganizationIdFromWorkspaceId } from "@/modules/survey/lib/organization";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface NewResearchPageProps {
  params: Promise<{ workspaceId: string }>;
}

const NewResearchPage = async ({ params }: NewResearchPageProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) {
    notFound();
  }

  const { workspaceId } = await params;
  const { isBilling, isReadOnly, organization } = await getWorkspaceAuth(workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  if (isReadOnly) {
    return redirect(`/workspaces/${workspaceId}/research`);
  }

  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  return <CreateResearchProjectForm workspaceId={workspaceId} organizationId={organizationId} />;
};

export default NewResearchPage;

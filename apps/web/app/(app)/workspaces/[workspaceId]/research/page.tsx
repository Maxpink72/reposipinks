import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { ResearchProjectsList } from "@/modules/research/components/research-projects-list";
import { getOrganizationIdFromWorkspaceId } from "@/modules/survey/lib/organization";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const metadata: Metadata = {
  title: "Research",
};

interface ResearchListPageProps {
  params: Promise<{ workspaceId: string }>;
}

const ResearchListPage = async ({ params }: ResearchListPageProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) {
    notFound();
  }

  const { workspaceId } = await params;
  const t = await getTranslate();
  const { isBilling, isReadOnly, organization } = await getWorkspaceAuth(workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  if (!organizationId) {
    throw new ResourceNotFoundError(t("common.organization"), null);
  }

  return (
    <ResearchProjectsList workspaceId={workspaceId} organizationId={organizationId} isReadOnly={isReadOnly} />
  );
};

export default ResearchListPage;

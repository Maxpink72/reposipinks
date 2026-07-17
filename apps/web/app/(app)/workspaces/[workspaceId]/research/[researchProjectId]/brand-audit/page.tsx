import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { ResearchBrandAuditsList } from "@/modules/research/components/research-brand-audits-list";
import {
  assertResearchCapability,
  roleHasCapability,
} from "@/modules/research/lib/authorization";
import { listResearchBrandAudits } from "@/modules/research/lib/brand-audit/brand-audits";
import { getResearchProject } from "@/modules/research/lib/projects";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface BrandAuditListPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string }>;
}

const BrandAuditListPage = async ({ params }: BrandAuditListPageProps) => {
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

  const audits = await listResearchBrandAudits(researchProjectId);

  return (
    <ResearchBrandAuditsList
      workspaceId={workspaceId}
      researchProjectId={researchProjectId}
      initialAudits={audits}
      canEdit={roleHasCapability(access.role, "edit_brand_audit")}
    />
  );
};

export default BrandAuditListPage;

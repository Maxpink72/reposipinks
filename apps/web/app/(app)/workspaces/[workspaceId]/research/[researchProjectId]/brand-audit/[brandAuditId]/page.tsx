import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { ResearchBrandAuditWorkspace } from "@/modules/research/components/research-brand-audit-workspace";
import {
  assertResearchCapability,
  roleHasCapability,
} from "@/modules/research/lib/authorization";
import { getResearchBrandAudit } from "@/modules/research/lib/brand-audit/brand-audits";
import { getResearchProject } from "@/modules/research/lib/projects";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface BrandAuditDetailPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string; brandAuditId: string }>;
}

const BrandAuditDetailPage = async ({ params }: BrandAuditDetailPageProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) notFound();

  const { workspaceId, researchProjectId, brandAuditId } = await params;
  const { session, isBilling, organization } = await getWorkspaceAuth(workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  const access = await assertResearchCapability(session.user.id, researchProjectId, "view");
  const project = await getResearchProject(researchProjectId);
  if (!project || project.organizationId !== organization.id) {
    throw new ResourceNotFoundError("ResearchProject", researchProjectId);
  }

  const audit = await getResearchBrandAudit(brandAuditId);
  if (!audit || audit.researchProjectId !== researchProjectId) {
    throw new ResourceNotFoundError("ResearchBrandAudit", brandAuditId);
  }

  return (
    <ResearchBrandAuditWorkspace
      workspaceId={workspaceId}
      researchProjectId={researchProjectId}
      initialAudit={audit}
      canEdit={roleHasCapability(access.role, "edit_brand_audit")}
    />
  );
};

export default BrandAuditDetailPage;

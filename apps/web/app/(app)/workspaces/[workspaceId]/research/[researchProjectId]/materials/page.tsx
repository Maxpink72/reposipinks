import { redirect } from "next/navigation";

interface MaterialsRedirectProps {
  params: Promise<{ workspaceId: string; researchProjectId: string }>;
}

/** Materials tab redirects to Brand Audit (Stage 7). */
const MaterialsRedirectPage = async ({ params }: MaterialsRedirectProps) => {
  const { workspaceId, researchProjectId } = await params;
  redirect(`/workspaces/${workspaceId}/research/${researchProjectId}/brand-audit`);
};

export default MaterialsRedirectPage;

import { notFound, redirect } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, RESEARCH_PLATFORM_ENABLED } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { getResearchActivity } from "@/modules/research/lib/activity";
import { assertResearchCapability } from "@/modules/research/lib/authorization";
import { getResearchProject } from "@/modules/research/lib/projects";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface ActivityPageProps {
  params: Promise<{ workspaceId: string; researchProjectId: string }>;
}

const ActivityPage = async ({ params }: ActivityPageProps) => {
  if (!RESEARCH_PLATFORM_ENABLED) {
    notFound();
  }

  const { workspaceId, researchProjectId } = await params;
  const { session, isBilling, organization } = await getWorkspaceAuth(workspaceId);
  const t = await getTranslate();

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  await assertResearchCapability(session.user.id, researchProjectId, "view");
  const project = await getResearchProject(researchProjectId);
  if (!project || project.organizationId !== organization.id) {
    throw new ResourceNotFoundError("ResearchProject", researchProjectId);
  }

  const activity = await getResearchActivity(researchProjectId);

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-semibold text-slate-900">{t("research.tabs.activity")}</h2>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {activity.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500">{t("research.activity.empty")}</li>
        )}
        {activity.map((item) => (
          <li key={item.id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">
                  {t(`research.activity.actions.${item.action}`, { defaultValue: item.action })}
                </p>
                <p className="text-xs text-slate-500">
                  {item.actor?.name ?? t("research.activity.system")} ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              {item.targetType && (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {item.targetType}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ActivityPage;

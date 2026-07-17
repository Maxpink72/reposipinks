import { getTranslate } from "@/lingodotdev/server";

interface ResearchPlaceholderPageProps {
  titleKey: string;
  descriptionKey: string;
}

export const ResearchPlaceholderPage = async ({
  titleKey,
  descriptionKey,
}: ResearchPlaceholderPageProps) => {
  const t = await getTranslate();
  return (
    <div className="p-6">
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <h2 className="text-lg font-medium text-slate-900">{t(titleKey)}</h2>
        <p className="mt-2 text-sm text-slate-500">{t(descriptionKey)}</p>
        <p className="mt-4 text-xs text-slate-400">{t("research.placeholders.coming_later")}</p>
      </div>
    </div>
  );
};

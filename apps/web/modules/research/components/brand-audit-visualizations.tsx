"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { TResearchBrandAuditSwot } from "@/modules/research/types/brand-audit";

type RadarPoint = { criterion: string; score: number; fullMark: number };

interface BrandAuditVisualizationsProps {
  radarData: RadarPoint[];
  swot: TResearchBrandAuditSwot;
  positioning?: {
    xAxisLabel: string;
    yAxisLabel: string;
    points: Array<{ id: string; label: string; x: number; y: number; isOwnBrand?: boolean }>;
  };
  labels: {
    strengths: string;
    weaknesses: string;
    opportunities: string;
    threats: string;
    radarEmpty: string;
  };
}

export const BrandAuditVisualizations = ({
  radarData,
  swot,
  positioning,
  labels,
}: BrandAuditVisualizationsProps) => {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Radar</h3>
        {radarData.length === 0 ? (
          <p className="text-sm text-slate-500">{labels.radarEmpty}</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10 }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#0f172a"
                  fill="#2563eb"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">SWOT</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {(
            [
              ["strengths", labels.strengths, swot.strengths, "bg-emerald-50 border-emerald-200"],
              ["weaknesses", labels.weaknesses, swot.weaknesses, "bg-rose-50 border-rose-200"],
              ["opportunities", labels.opportunities, swot.opportunities, "bg-sky-50 border-sky-200"],
              ["threats", labels.threats, swot.threats, "bg-amber-50 border-amber-200"],
            ] as const
          ).map(([key, title, items, cls]) => (
            <div key={key} className={`rounded border p-3 ${cls}`}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
              <ul className="list-disc space-y-1 pl-4 text-slate-700">
                {items.length === 0 && <li className="list-none text-slate-400">—</li>}
                {items.map((item, i) => (
                  <li key={`${key}-${i}`}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {positioning && positioning.points.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Positioning · {positioning.xAxisLabel} × {positioning.yAxisLabel}
          </h3>
          <div className="relative mx-auto aspect-square max-w-md rounded border border-slate-200 bg-slate-50">
            <div className="absolute inset-x-0 top-1/2 border-t border-slate-300" />
            <div className="absolute inset-y-0 left-1/2 border-l border-slate-300" />
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-slate-500">
              {positioning.xAxisLabel} →
            </span>
            <span className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-slate-500">
              {positioning.yAxisLabel} →
            </span>
            {positioning.points.map((p) => (
              <div
                key={p.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm ${
                  p.isOwnBrand ? "bg-slate-900 text-white" : "bg-white text-slate-800 ring-1 ring-slate-300"
                }`}
                style={{ left: `${p.x}%`, bottom: `${p.y}%` }}
                title={`${p.label} (${p.x}, ${p.y})`}>
                {p.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

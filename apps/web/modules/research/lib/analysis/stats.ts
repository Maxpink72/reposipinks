import { SMALL_SAMPLE_THRESHOLD } from "@/modules/research/types/chart-definition";

export const mean = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

export const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

export const frequency = (values: Array<string | number | boolean | null | undefined>) => {
  const map = new Map<string, number>();
  let sampleSize = 0;
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    sampleSize += 1;
    const label = String(value);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  const points = [...map.entries()]
    .map(([label, count]) => ({
      label,
      value: count,
      percentage: sampleSize > 0 ? (count / sampleSize) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
  return { sampleSize, points };
};

export type TNpsBreakdown = {
  score: number;
  promoters: number;
  passives: number;
  detractors: number;
  sampleSize: number;
  confidenceInterval95?: [number, number];
};

/** NPS: 0-6 detractors, 7-8 passives, 9-10 promoters. Score = %promoters - %detractors. */
export const computeNps = (scores: number[], withCi = false): TNpsBreakdown | null => {
  const valid = scores.filter((s) => Number.isFinite(s) && s >= 0 && s <= 10);
  if (valid.length === 0) return null;

  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const score of valid) {
    if (score >= 9) promoters += 1;
    else if (score >= 7) passives += 1;
    else detractors += 1;
  }

  const n = valid.length;
  const pPromoters = promoters / n;
  const pDetractors = detractors / n;
  const score = (pPromoters - pDetractors) * 100;

  let confidenceInterval95: [number, number] | undefined;
  if (withCi && n >= SMALL_SAMPLE_THRESHOLD) {
    // Approximate SE for NPS proportion difference
    const se = Math.sqrt((pPromoters * (1 - pPromoters) + pDetractors * (1 - pDetractors)) / n) * 100;
    const margin = 1.96 * se;
    confidenceInterval95 = [score - margin, score + margin];
  }

  return {
    score,
    promoters,
    passives,
    detractors,
    sampleSize: n,
    confidenceInterval95,
  };
};

/** CSAT top-2-box percentage for 1-5 (or custom max) scale. */
export const computeCsat = (ratings: number[], maxScale = 5): { score: number; sampleSize: number } | null => {
  const valid = ratings.filter((r) => Number.isFinite(r) && r >= 1 && r <= maxScale);
  if (valid.length === 0) return null;
  const threshold = maxScale - 1;
  const satisfied = valid.filter((r) => r >= threshold).length;
  return { score: (satisfied / valid.length) * 100, sampleSize: valid.length };
};

/** CES: average effort score (lower is better typically). */
export const computeCes = (scores: number[]): { score: number; sampleSize: number } | null => {
  const valid = scores.filter((s) => Number.isFinite(s));
  if (valid.length === 0) return null;
  const avg = mean(valid);
  if (avg === null) return null;
  return { score: avg, sampleSize: valid.length };
};

export const buildCrossTab = (
  pairs: Array<{ row: string; column: string }>
): {
  rowLabels: string[];
  columnLabels: string[];
  matrix: number[][];
  rowTotals: number[];
  columnTotals: number[];
  sampleSize: number;
} => {
  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  const counts = new Map<string, number>();

  for (const pair of pairs) {
    if (!pair.row || !pair.column) continue;
    rowSet.add(pair.row);
    colSet.add(pair.column);
    const key = `${pair.row}|||${pair.column}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rowLabels = [...rowSet].sort();
  const columnLabels = [...colSet].sort();
  const matrix = rowLabels.map((row) =>
    columnLabels.map((col) => counts.get(`${row}|||${col}`) ?? 0)
  );
  const rowTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const columnTotals = columnLabels.map((_, colIdx) =>
    matrix.reduce((acc, row) => acc + row[colIdx], 0)
  );
  const sampleSize = rowTotals.reduce((a, b) => a + b, 0);

  return { rowLabels, columnLabels, matrix, rowTotals, columnTotals, sampleSize };
};

export const isSmallSample = (n: number): boolean => n > 0 && n < SMALL_SAMPLE_THRESHOLD;

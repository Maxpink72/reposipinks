import { describe, expect, test } from "vitest";
import {
  buildCrossTab,
  computeCes,
  computeCsat,
  computeNps,
  frequency,
  isSmallSample,
  mean,
  median,
} from "./stats";
import { recommendChartType } from "@/modules/research/types/chart-definition";

describe("research analysis stats", () => {
  test("computes mean and median", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3])).toBe(2);
  });

  test("computes frequency distribution", () => {
    const result = frequency(["a", "b", "a", "a", null, ""]);
    expect(result.sampleSize).toBe(4);
    expect(result.points[0]).toMatchObject({ label: "a", value: 3 });
  });

  test("computes NPS score", () => {
    // 2 promoters (10,9), 1 passive (7), 1 detractor (3) => (50-25)=25
    const nps = computeNps([10, 9, 7, 3], true);
    expect(nps?.score).toBe(25);
    expect(nps?.promoters).toBe(2);
    expect(nps?.passives).toBe(1);
    expect(nps?.detractors).toBe(1);
    // CI only when n >= 30
    expect(nps?.confidenceInterval95).toBeUndefined();
  });

  test("includes NPS CI for large samples", () => {
    const scores = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 10 : 3));
    const nps = computeNps(scores, true);
    expect(nps?.confidenceInterval95).toBeDefined();
    expect(nps?.confidenceInterval95?.[0]).toBeLessThan(nps!.score);
  });

  test("computes CSAT top-2-box", () => {
    const csat = computeCsat([5, 4, 3, 2]);
    expect(csat?.score).toBe(50);
  });

  test("computes CES average", () => {
    const ces = computeCes([1, 2, 3]);
    expect(ces?.score).toBe(2);
  });

  test("builds cross-tab matrix", () => {
    const tab = buildCrossTab([
      { row: "A", column: "X" },
      { row: "A", column: "X" },
      { row: "A", column: "Y" },
      { row: "B", column: "Y" },
    ]);
    expect(tab.rowLabels).toEqual(["A", "B"]);
    expect(tab.columnLabels).toEqual(["X", "Y"]);
    expect(tab.matrix[0]).toEqual([2, 1]);
    expect(tab.sampleSize).toBe(4);
  });

  test("flags small samples", () => {
    expect(isSmallSample(10)).toBe(true);
    expect(isSmallSample(30)).toBe(false);
    expect(isSmallSample(0)).toBe(false);
  });

  test("recommends non-pie charts for many categories", () => {
    expect(recommendChartType(3, "distribution")).toBe("bar_vertical");
    expect(recommendChartType(20, "distribution")).toBe("table");
    expect(recommendChartType(5, "nps")).toBe("kpi");
  });
});

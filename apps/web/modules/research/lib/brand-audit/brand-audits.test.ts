import { describe, expect, test } from "vitest";
import {
  AGENCY_DEFAULT_BRAND_AUDIT_CRITERIA,
  computeWeightedAuditScore,
} from "@/modules/research/types/brand-audit";

describe("brand audit scoring", () => {
  test("agency default template has 8 criteria", () => {
    expect(AGENCY_DEFAULT_BRAND_AUDIT_CRITERIA).toHaveLength(8);
    expect(AGENCY_DEFAULT_BRAND_AUDIT_CRITERIA[0].key).toBe("strategy");
  });

  test("computes weighted score", () => {
    const summary = computeWeightedAuditScore([
      { score: 5, weight: 1, maxScore: 5 },
      { score: 3, weight: 1, maxScore: 5 },
    ]);
    expect(summary.average).toBe(4);
    expect(summary.weightedAverage).toBe(0.8);
    expect(summary.coverage).toBe(2);
  });

  test("empty assessments yield zeros", () => {
    expect(computeWeightedAuditScore([])).toEqual({
      average: 0,
      weightedAverage: 0,
      maxAverage: 5,
      coverage: 0,
    });
  });
});

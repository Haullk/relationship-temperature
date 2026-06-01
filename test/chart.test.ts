import { describe, expect, it } from "vitest";

import { chartPath, chartPoints } from "../lib/chart";
import type { DailyTrendPoint } from "../lib/types";

const trend: DailyTrendPoint[] = [
  {
    date: "2026-01-01",
    daily_weighted_goldstein: 0,
    rolling_14d_goldstein: 0,
    relationship_temperature: 50,
    event_count: 1,
    event_weight: 1,
    temperature_band: "接近中性"
  },
  {
    date: "2026-01-02",
    daily_weighted_goldstein: 2,
    rolling_14d_goldstein: 2,
    relationship_temperature: 60,
    event_count: 1,
    event_weight: 1,
    temperature_band: "偏合作"
  }
];

describe("chart helpers", () => {
  it("maps trend points into an svg path", () => {
    const points = chartPoints(trend, 100, 100, 10);
    expect(points).toHaveLength(2);
    expect(chartPath(points)).toContain("M");
    expect(chartPath(points)).toContain("L");
  });
});


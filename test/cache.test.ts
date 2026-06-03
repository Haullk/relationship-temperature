import { describe, expect, it } from "vitest";

import { toFeaturedCardPayload } from "../lib/cache";
import type { RelationshipPayload } from "../lib/types";

const payload: RelationshipPayload = {
  pair_id: "chn_usa",
  display_name: "中美",
  object_a: "chn",
  object_b: "usa",
  data_start: "2026-03-05",
  data_end: "2026-06-02",
  generated_at: "2026-06-03T00:00:00.000Z",
  current_temperature: 62.3,
  current_band: "偏合作",
  card_status: "偏合作",
  change_7d: "改善",
  change_14d: "平稳",
  turning_point_status: "normal",
  trend: [
    {
      date: "2026-06-01",
      daily_weighted_goldstein: 1.1,
      rolling_14d_goldstein: 0.8,
      relationship_temperature: 60,
      event_count: 12,
      event_weight: 18,
      temperature_band: "偏合作"
    }
  ],
  turning_points: [
    {
      date: "2026-06-01",
      previous_date: "2026-05-25",
      temperature: 60,
      previous_temperature: 52,
      delta: 8,
      direction: "改善",
      summary: "关系改善。",
      baseline_start: "2026-05-18",
      baseline_end: "2026-05-25",
      change_start: "2026-05-26",
      change_end: "2026-06-01",
      drivers: [],
      reports: []
    }
  ]
};

describe("cache payload helpers", () => {
  it("keeps featured cards lightweight", () => {
    const featured = toFeaturedCardPayload(payload);
    const serialized = JSON.stringify(featured);

    expect(featured.trend).toEqual([{ date: "2026-06-01", relationship_temperature: 60 }]);
    expect(serialized).not.toContain("turning_points");
    expect(serialized).not.toContain("daily_weighted_goldstein");
    expect(serialized).not.toContain("reports");
  });
});

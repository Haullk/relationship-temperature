import { describe, expect, it } from "vitest";

import {
  buildPairSeoSummary,
  normalizeKnownPairId,
  pairCanonicalPath,
  pairIdFromAnySlug,
  pairIdFromSlug,
  pairLanguageAlternates,
  pairSlug
} from "../lib/pairSeo";
import type { RelationshipPayload } from "../lib/types";

const relationshipPayload: RelationshipPayload = {
  pair_id: "chn_usa",
  display_name: "中国-美国",
  object_a: "chn",
  object_b: "usa",
  data_start: "2026-03-10",
  data_end: "2026-06-07",
  generated_at: "2026-06-08T00:00:00.000Z",
  current_temperature: 60.8,
  current_band: "偏合作",
  card_status: "偏合作",
  change_7d: "改善",
  change_14d: "平稳",
  turning_point_status: "normal",
  trend: [],
  turning_points: []
};

describe("pair SEO helpers", () => {
  it("builds semantic slugs for known relationship pairs", () => {
    expect(pairSlug("chn_usa")).toBe("china-united-states");
    expect(pairCanonicalPath("rus_ukr")).toBe("/bilateral/russia-ukraine");
    expect(pairCanonicalPath("usa_irn")).toBe("/bilateral/iran-united-states");
    expect(pairCanonicalPath("usa_rus")).toBe("/bilateral/russia-united-states");
  });

  it("parses semantic slugs back to canonical pair ids", () => {
    expect(pairIdFromSlug("china-united-states")).toBe("chn_usa");
    expect(pairIdFromSlug("iran-united-states")).toBe("irn_usa");
    expect(pairIdFromSlug("united-states-iran")).toBeNull();
  });

  it("parses reversed semantic slugs for redirects", () => {
    expect(pairIdFromAnySlug("united-states-iran")).toBe("irn_usa");
    expect(pairIdFromAnySlug("united-states-russia")).toBe("rus_usa");
  });

  it("normalizes legacy query pair ids", () => {
    expect(normalizeKnownPairId("usa_chn")).toBe("chn_usa");
    expect(normalizeKnownPairId("usa-chn")).toBe("chn_usa");
    expect(normalizeKnownPairId("usa_usa")).toBeNull();
  });

  it("builds localized canonical paths and SEO copy", () => {
    const summary = buildPairSeoSummary("usa_chn", relationshipPayload, "en");

    expect(summary.pairId).toBe("chn_usa");
    expect(summary.locale).toBe("en");
    expect(summary.canonicalPath).toBe("/en/bilateral/china-united-states");
    expect(summary.canonicalUrl).toBe("https://www.geoprizm.com/en/bilateral/china-united-states");
    expect(summary.localizedName).toBe("China-United States");
    expect(summary.statusLabel).toBe("Leaning friendly");
    expect(summary.description).toContain("Current index: 60.8");
  });

  it("builds language alternates from the unprefixed canonical pair route", () => {
    const alternates = pairLanguageAlternates("chn_usa");

    expect(alternates["zh-CN"]).toBe("https://www.geoprizm.com/bilateral/china-united-states");
    expect(alternates.en).toBe("https://www.geoprizm.com/en/bilateral/china-united-states");
    expect(alternates.ja).toBe("https://www.geoprizm.com/ja/bilateral/china-united-states");
    expect(alternates["x-default"]).toBe(alternates["zh-CN"]);
  });
});

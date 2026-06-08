import { describe, expect, it } from "vitest";

import { buildPairJsonLd } from "../lib/pairJsonLd";
import { buildPairSeoSummary } from "../lib/pairSeo";
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
  turning_points: [
    {
      date: "2026-06-01",
      previous_date: "2026-05-25",
      temperature: 60.8,
      previous_temperature: 54.8,
      delta: 6,
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

describe("pair JSON-LD", () => {
  it("uses localized canonical URLs and language metadata", () => {
    const summary = buildPairSeoSummary("chn_usa", relationshipPayload, "ja");
    const jsonLd = buildPairJsonLd(summary, relationshipPayload);
    const graph = jsonLd["@graph"];
    const webPage = graph.find((node) => node["@type"] === "WebPage");
    const dataset = graph.find((node) => node["@type"] === "Dataset");

    expect(webPage).toMatchObject({
      "@id": "https://www.geoprizm.com/ja/bilateral/china-united-states#webpage",
      url: "https://www.geoprizm.com/ja/bilateral/china-united-states",
      inLanguage: "ja"
    });
    expect(dataset).toMatchObject({
      "@id": "https://www.geoprizm.com/ja/bilateral/china-united-states#dataset",
      url: "https://www.geoprizm.com/ja/bilateral/china-united-states",
      inLanguage: "ja",
      temporalCoverage: "2026-03-10/2026-06-07"
    });
    expect(dataset?.variableMeasured).toContainEqual(
      expect.objectContaining({
        name: "relationship_index",
        value: 60.8
      })
    );
    expect(dataset?.variableMeasured).toContainEqual(
      expect.objectContaining({
        name: "turning_points",
        value: 1
      })
    );
  });
});

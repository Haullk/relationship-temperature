import { describe, expect, it } from "vitest";

import { candidatePoolFromRaw, canonicalPairId, resolvePair } from "../lib/candidatePool";

const rawPool = {
  default_pair: "chn_usa",
  objects: [
    { id: "chn", label: "中国", gdelt_codes: ["CHN"], keywords: [] },
    { id: "usa", label: "美国", gdelt_codes: ["USA"], keywords: [] },
    { id: "europe", label: "欧盟/欧洲", gdelt_codes: ["EUR", "GBR"], keywords: [] },
    { id: "gbr", label: "英国", gdelt_codes: ["GBR"], keywords: [] }
  ],
  excluded_pairs: [["europe", "gbr"]] as [string, string][],
  featured_pairs: [{ objects: ["chn", "usa"] as [string, string], label: "中美" }]
};

describe("candidate pool", () => {
  it("canonicalizes pair order", () => {
    expect(canonicalPairId("usa", "chn")).toBe("chn_usa");
  });

  it("normalizes reversed pair without fallback", () => {
    const pool = candidatePoolFromRaw(rawPool);
    const resolution = resolvePair(pool, "usa_chn");
    expect(resolution.pairId).toBe("chn_usa");
    expect(resolution.isValid).toBe(true);
    expect(resolution.usedDefault).toBe(false);
  });

  it("rejects europe member overlap", () => {
    const pool = candidatePoolFromRaw(rawPool);
    const resolution = resolvePair(pool, "europe_gbr");
    expect(resolution.pairId).toBe("chn_usa");
    expect(resolution.isValid).toBe(false);
  });
});


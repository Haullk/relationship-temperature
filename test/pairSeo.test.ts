import { describe, expect, it } from "vitest";

import { normalizeKnownPairId, pairCanonicalPath, pairIdFromSlug, pairSlug } from "../lib/pairSeo";

describe("pair SEO helpers", () => {
  it("builds semantic slugs for known relationship pairs", () => {
    expect(pairSlug("chn_usa")).toBe("china-united-states");
    expect(pairCanonicalPath("rus_ukr")).toBe("/bilateral/russia-ukraine");
  });

  it("parses semantic slugs back to canonical pair ids", () => {
    expect(pairIdFromSlug("china-united-states")).toBe("chn_usa");
    expect(pairIdFromSlug("iran-united-states")).toBe("irn_usa");
  });

  it("normalizes legacy query pair ids", () => {
    expect(normalizeKnownPairId("usa_chn")).toBe("chn_usa");
    expect(normalizeKnownPairId("usa-chn")).toBe("chn_usa");
    expect(normalizeKnownPairId("usa_usa")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import sitemap from "../app/sitemap";
import { loadCandidatePool } from "../lib/candidatePool";

describe("sitemap", () => {
  it("includes default and localized entries for home and featured pair pages", async () => {
    const originalGdeltDatabaseUrl = process.env.GDELT_DATABASE_URL;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.GDELT_DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const entries = await sitemap();
      const urls = new Set(entries.map((entry) => entry.url));
      const pool = loadCandidatePool();

      expect(entries).toHaveLength(10 + pool.featuredPairs.length * 5);
      expect(urls).toContain("https://www.geoprizm.com");
      expect(urls).toContain("https://www.geoprizm.com/en");
      expect(urls).toContain("https://www.geoprizm.com/about");
      expect(urls).toContain("https://www.geoprizm.com/bilateral/china-united-states");
      expect(urls).toContain("https://www.geoprizm.com/en/bilateral/china-united-states");
      expect(urls).toContain("https://www.geoprizm.com/zh-TW/bilateral/china-united-states");
      expect(urls).toContain("https://www.geoprizm.com/bilateral/iran-united-states");
      expect(urls).toContain("https://www.geoprizm.com/bilateral/russia-united-states");
      expect(urls).not.toContain("https://www.geoprizm.com/bilateral/united-states-iran");
      expect(urls).not.toContain("https://www.geoprizm.com/bilateral/united-states-russia");
    } finally {
      if (originalGdeltDatabaseUrl === undefined) {
        delete process.env.GDELT_DATABASE_URL;
      } else {
        process.env.GDELT_DATABASE_URL = originalGdeltDatabaseUrl;
      }
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    }
  });
});

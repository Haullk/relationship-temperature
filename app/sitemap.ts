import type { MetadataRoute } from "next";

import { loadCandidatePool } from "@/lib/candidatePool";

const siteUrl = "https://www.geoprizm.com";

function absoluteUrl(pathname: string, pairId?: string): string {
  const url = new URL(pathname, siteUrl);
  if (pairId) {
    url.searchParams.set("pair", pairId);
  }
  return url.toString();
}

function sitemapEntry(url: string, priority: number): MetadataRoute.Sitemap[number] {
  return {
    url,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const pool = loadCandidatePool();
  const featuredPairIds = pool.featuredPairs.map((pair) => pair.pairId);

  return [
    sitemapEntry(absoluteUrl("/"), 1),
    sitemapEntry(absoluteUrl("/trend"), 0.9),
    ...featuredPairIds.map((pairId) => sitemapEntry(absoluteUrl("/", pairId), 0.8)),
    ...featuredPairIds.map((pairId) => sitemapEntry(absoluteUrl("/trend", pairId), 0.7))
  ];
}

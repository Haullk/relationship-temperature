import type { MetadataRoute } from "next";

import { readManyRelationshipCaches } from "@/lib/cache";
import { loadCandidatePool } from "@/lib/candidatePool";
import { pairCanonicalUrl, siteUrl } from "@/lib/pairSeo";
import type { RelationshipPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pool = loadCandidatePool();
  const featuredPairIds = pool.featuredPairs.map((pair) => pair.pairId);
  const cache = await readManyRelationshipCaches(featuredPairIds).catch(() => new Map<string, RelationshipPayload>());
  const fallbackDate = new Date();
  const relationshipDates = featuredPairIds.map((pairId) => relationshipLastModified(cache.get(pairId), fallbackDate));
  const homeLastModified = latestDate(relationshipDates) ?? fallbackDate;

  return [
    {
      url: siteUrl,
      lastModified: homeLastModified
    },
    ...featuredPairIds.map((pairId) => ({
      url: pairCanonicalUrl(pairId),
      lastModified: relationshipLastModified(cache.get(pairId), fallbackDate)
    }))
  ];
}

function relationshipLastModified(payload: RelationshipPayload | undefined, fallbackDate: Date): Date {
  return validDate(payload?.generated_at) ?? validDate(payload?.data_end) ?? fallbackDate;
}

function latestDate(dates: Date[]): Date | null {
  if (dates.length === 0) {
    return null;
  }
  return dates.reduce((latest, date) => (date.getTime() > latest.getTime() ? date : latest), dates[0]);
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

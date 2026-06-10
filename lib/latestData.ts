import { readManyRelationshipCaches } from "@/lib/cache";
import { loadCandidatePool } from "@/lib/candidatePool";

export async function latestFeaturedDataEnd(): Promise<string | null> {
  const pool = loadCandidatePool();
  const pairIds = pool.featuredPairs.map((pair) => pair.pairId);
  const cache = await readManyRelationshipCaches(pairIds).catch(() => null);
  if (cache === null) {
    return null;
  }
  const dataEnds = Array.from(cache.values())
    .map((payload) => payload.data_end)
    .filter((value): value is string => Boolean(value));
  if (dataEnds.length === 0) {
    return null;
  }
  return dataEnds.sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
}

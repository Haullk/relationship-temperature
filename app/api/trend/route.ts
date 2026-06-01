import { NextRequest, NextResponse } from "next/server";

import { loadCandidatePool, resolvePair, toCandidatePoolResponse } from "@/lib/candidatePool";
import { readManyRelationshipCaches, readRelationshipCache } from "@/lib/cache";
import type { PairStatus, RelationshipPayload, TrendApiResponse } from "@/lib/types";

export async function GET(request: NextRequest): Promise<NextResponse<TrendApiResponse>> {
  const pool = loadCandidatePool();
  const requestedPair = request.nextUrl.searchParams.get("pair");
  const resolution = resolvePair(pool, requestedPair);
  const featuredIds = pool.featuredPairs.map((pair) => pair.pairId);
  const readResult = await readRelationshipCache(resolution.pairId).catch(() => ({ status: "missing" as const, payload: null }));
  const featuredCache = await readManyRelationshipCaches(featuredIds).catch(() => new Map<string, RelationshipPayload>());
  const featuredCards = featuredIds
    .map((pairId) => featuredCache.get(pairId))
    .filter((payload): payload is RelationshipPayload => payload !== undefined);

  const pairStatus: PairStatus = resolution.isValid
    ? requestedPair === null || requestedPair.trim() === ""
      ? "default"
      : requestedPair === resolution.pairId
        ? "valid"
        : "normalized"
    : "invalid_fallback";

  return NextResponse.json({
    requestedPair,
    pairId: resolution.pairId,
    pairStatus,
    message: resolution.message,
    cacheStatus: readResult.status,
    candidatePool: toCandidatePoolResponse(pool),
    featuredCards,
    relationship: readResult.payload
  });
}

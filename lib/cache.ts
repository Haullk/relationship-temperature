import { Pool } from "pg";

import type { CacheStatus, FeaturedCardPayload, RelationshipPayload } from "./types";

let pool: Pool | null = null;

export interface CacheReadResult {
  status: CacheStatus;
  payload: RelationshipPayload | null;
}

export async function readRelationshipCache(pairId: string): Promise<CacheReadResult> {
  const databaseUrl = process.env.GDELT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { status: "missing", payload: null };
  }
  const db = getPool(databaseUrl);
  const result = await db.query(
    `
    select payload, generated_at
    from relationship_trend_cache
    where pair_id = $1
    `,
    [pairId]
  );
  if (result.rowCount === 0) {
    return { status: "missing", payload: null };
  }
  const payload = result.rows[0]?.payload as RelationshipPayload;
  const generatedAt = new Date(String(result.rows[0]?.generated_at ?? payload.generated_at));
  const ageMs = Date.now() - generatedAt.getTime();
  const staleAfterMs = 36 * 60 * 60 * 1000;
  return { status: ageMs > staleAfterMs ? "stale" : "fresh", payload };
}

export async function readManyRelationshipCaches(pairIds: string[]): Promise<Map<string, RelationshipPayload>> {
  const databaseUrl = process.env.GDELT_DATABASE_URL ?? process.env.DATABASE_URL;
  const rows = new Map<string, RelationshipPayload>();
  if (!databaseUrl || pairIds.length === 0) {
    return rows;
  }
  const db = getPool(databaseUrl);
  const result = await db.query(
    `
    select pair_id, payload
    from relationship_trend_cache
    where pair_id = any($1::text[])
    `,
    [pairIds]
  );
  for (const row of result.rows) {
    rows.set(String(row.pair_id), row.payload as RelationshipPayload);
  }
  return rows;
}

export function toFeaturedCardPayload(payload: RelationshipPayload): FeaturedCardPayload {
  return {
    pair_id: payload.pair_id,
    display_name: payload.display_name,
    object_a: payload.object_a,
    object_b: payload.object_b,
    data_start: payload.data_start,
    data_end: payload.data_end,
    generated_at: payload.generated_at,
    current_temperature: payload.current_temperature,
    current_band: payload.current_band,
    card_status: payload.card_status,
    change_7d: payload.change_7d,
    change_14d: payload.change_14d,
    turning_point_status: payload.turning_point_status,
    trend: payload.trend.map((point) => ({
      date: point.date,
      relationship_temperature: point.relationship_temperature
    }))
  };
}

function getPool(databaseUrl: string): Pool {
  if (pool === null) {
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}

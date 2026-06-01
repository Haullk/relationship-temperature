export type CacheStatus = "fresh" | "stale" | "missing";
export type PairStatus = "default" | "valid" | "normalized" | "invalid_fallback";
export type TemperatureBand = "明显偏冲突" | "偏冲突" | "接近中性" | "偏合作" | "明显偏合作";
export type CardStatus = "偏冲突" | "接近中性" | "偏合作";
export type ChangeStatus = "改善" | "恶化" | "平稳";
export type TurningPointStatus = "normal" | "data_insufficient" | "no_significant_turning_points" | "no_data";

export interface CandidateObject {
  id: string;
  label: string;
  gdelt_codes: string[];
  keywords: string[];
}

export interface FeaturedPair {
  pairId: string;
  objects: [string, string];
  label: string;
}

export interface CandidatePoolResponse {
  objects: CandidateObject[];
  featuredPairs: FeaturedPair[];
  defaultPair: string;
  legalPairIds: string[];
}

export interface DailyTrendPoint {
  date: string;
  daily_weighted_goldstein: number | null;
  rolling_14d_goldstein: number;
  relationship_temperature: number;
  event_count: number;
  event_weight: number;
  temperature_band: TemperatureBand;
}

export interface DriverEvent {
  event_root_code: string;
  label: string;
  direction: string;
  post_count: number;
  pre_count: number;
  count_delta: number;
  post_mentions: number;
  pre_mentions: number;
  avg_goldstein: number;
}

export interface KeyReport {
  date: string;
  source_domain: string;
  source_url: string;
  url_title: string;
  event_type: string;
  impact_direction: string;
  goldstein_scale: number;
  num_mentions: number;
  num_articles: number;
}

export interface TurningPoint {
  date: string;
  previous_date: string;
  temperature: number;
  previous_temperature: number;
  delta: number;
  direction: ChangeStatus;
  summary: string;
  baseline_start: string;
  baseline_end: string;
  change_start: string;
  change_end: string;
  drivers: DriverEvent[];
  reports: KeyReport[];
}

export interface RelationshipPayload {
  pair_id: string;
  display_name: string;
  object_a: string;
  object_b: string;
  data_start: string | null;
  data_end: string | null;
  generated_at: string;
  current_temperature: number | null;
  current_band: TemperatureBand | null;
  card_status: CardStatus | null;
  change_7d?: ChangeStatus;
  change_14d: ChangeStatus;
  turning_point_status: TurningPointStatus;
  trend: DailyTrendPoint[];
  turning_points: TurningPoint[];
}

export interface TrendApiResponse {
  requestedPair: string | null;
  pairId: string;
  pairStatus: PairStatus;
  message: string | null;
  cacheStatus: CacheStatus;
  candidatePool: CandidatePoolResponse;
  featuredCards: RelationshipPayload[];
  relationship: RelationshipPayload | null;
}

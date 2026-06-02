from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date as Date
from datetime import datetime as DateTime
from typing import Any, Literal, cast

TemperatureBand = Literal["明显偏冲突", "偏冲突", "接近中性", "偏合作", "明显偏合作"]
CardStatus = Literal["偏冲突", "接近中性", "偏合作"]
ChangeStatus = Literal["改善", "恶化", "平稳"]
TurningPointStatus = Literal["normal", "data_insufficient", "no_significant_turning_points", "no_data"]
CacheStatus = Literal["fresh", "stale", "missing"]
AiStatus = Literal["not_requested", "pending", "ready", "error", "missing_key"]
MetadataStatus = Literal["missing", "ready", "unsupported_url", "fetch_error", "parse_error"]


@dataclass(frozen=True)
class CandidateObject:
    id: str
    label: str
    gdelt_codes: tuple[str, ...]
    keywords: tuple[str, ...]


@dataclass(frozen=True)
class FeaturedPair:
    pair_id: str
    objects: tuple[str, str]
    label: str


@dataclass(frozen=True)
class PairResolution:
    requested_pair: str | None
    pair_id: str
    object_a: str
    object_b: str
    is_valid: bool
    used_default: bool
    message: str | None = None


@dataclass(frozen=True)
class StandardizedEvent:
    event_date: Date
    pair_id: str
    object_a: str
    object_b: str
    actor1_country_code: str
    actor2_country_code: str
    goldstein_scale: float
    num_mentions: int
    num_articles: int
    event_code: str | None = None
    event_root_code: str | None = None
    quad_class: int | None = None
    actor1_name: str | None = None
    actor2_name: str | None = None
    source_domain: str | None = None
    source_url: str | None = None


@dataclass(frozen=True)
class DailyTrendPoint:
    date: Date
    daily_weighted_goldstein: float | None
    rolling_14d_goldstein: float
    relationship_temperature: float
    event_count: int
    event_weight: float
    temperature_band: TemperatureBand


@dataclass(frozen=True)
class DriverEvent:
    event_root_code: str
    label: str
    direction: str
    post_count: int
    pre_count: int
    count_delta: int
    post_mentions: int
    pre_mentions: int
    avg_goldstein: float


@dataclass(frozen=True)
class KeyReport:
    date: Date
    source_domain: str
    source_url: str
    url_title: str
    event_type: str
    impact_direction: str
    goldstein_scale: float
    num_mentions: int
    num_articles: int
    resolved_title: str | None = None
    meta_description: str | None = None
    short_summary: str | None = None
    chinese_title: str | None = None
    chinese_summary: str | None = None
    metadata_status: MetadataStatus = "missing"


@dataclass(frozen=True)
class TurningPoint:
    date: Date
    previous_date: Date
    temperature: float
    previous_temperature: float
    delta: float
    direction: ChangeStatus
    summary: str
    baseline_start: Date
    baseline_end: Date
    change_start: Date
    change_end: Date
    drivers: tuple[DriverEvent, ...]
    reports: tuple[KeyReport, ...]
    ai_status: AiStatus = "not_requested"
    ai_summary: str | None = None
    ai_main_event: str | None = None
    ai_evidence: tuple[str, ...] = ()
    ai_generated_at: DateTime | None = None
    ai_prompt_version: str | None = None


@dataclass(frozen=True)
class RelationshipResult:
    pair_id: str
    display_name: str
    object_a: str
    object_b: str
    data_start: Date | None
    data_end: Date | None
    generated_at: DateTime
    current_temperature: float | None
    current_band: TemperatureBand | None
    card_status: CardStatus | None
    change_7d: ChangeStatus
    change_14d: ChangeStatus
    turning_point_status: TurningPointStatus
    trend: tuple[DailyTrendPoint, ...]
    turning_points: tuple[TurningPoint, ...]

    def to_payload(self) -> dict[str, Any]:
        return cast(dict[str, Any], _json_ready(asdict(self)))


def _json_ready(value: Any) -> Any:
    if isinstance(value, (Date, DateTime)):
        return value.isoformat()
    if isinstance(value, tuple):
        return [_json_ready(item) for item in value]
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_ready(item) for key, item in value.items()}
    return value

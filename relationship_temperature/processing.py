from __future__ import annotations

import math
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from urllib.parse import unquote, urlparse

from relationship_temperature.config import CandidatePool
from relationship_temperature.models import (
    CardStatus,
    ChangeStatus,
    DailyTrendPoint,
    DriverEvent,
    KeyReport,
    RelationshipResult,
    StandardizedEvent,
    TemperatureBand,
    TurningPoint,
    TurningPointStatus,
)

ROOT_LABELS = {
    "01": "公开声明",
    "02": "呼吁/倡议",
    "03": "表达合作意向",
    "04": "磋商/外交接触",
    "05": "外交合作",
    "06": "物质合作",
    "07": "援助",
    "08": "让步/妥协",
    "09": "调查",
    "10": "要求",
    "11": "反对/批评",
    "12": "拒绝",
    "13": "威胁",
    "14": "抗议",
    "15": "军事姿态",
    "16": "关系降级",
    "17": "胁迫",
    "18": "攻击",
    "19": "战斗",
    "20": "非常规暴力",
}

CHANGE_THRESHOLD = 5.0
ROLLING_DAYS = 14
TREND_SEGMENT_DAYS = 7
TEMPERATURE_SCALE_FACTOR = 12.0
MAX_TREND_SEGMENTS = 6
EXPLANATION_WINDOW_DAYS = 7
MINIMUM_DATA_DAYS = 30
MAX_REPORTS = 6
MIN_REPORTS_WITH_DOMAIN_BACKFILL = 3
MAX_REPORTS_PER_DOMAIN = 2
DRIVER_REPORT_MULTIPLIER = 1.35

TrendCandidate = tuple[int, int, ChangeStatus, float]
TrendSegment = tuple[int, int, float]


@dataclass
class ReportAggregate:
    total_score: float
    best_score: float
    report: KeyReport
    domain: str


def event_weight(event: StandardizedEvent) -> float:
    return math.log1p(max(event.num_mentions, event.num_articles, 1))


def process_relationship(
    pair_id: str,
    events: list[StandardizedEvent],
    pool: CandidatePool,
    *,
    generated_at: datetime | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> RelationshipResult:
    actual_generated_at = generated_at or datetime.now(UTC)
    object_a, object_b = pair_id.split("_", 1)
    if not events and (start_date is None or end_date is None):
        return RelationshipResult(
            pair_id=pair_id,
            display_name=pool.display_name(pair_id),
            object_a=object_a,
            object_b=object_b,
            data_start=start_date,
            data_end=end_date,
            generated_at=actual_generated_at,
            current_temperature=None,
            current_band=None,
            card_status=None,
            change_7d="平稳",
            change_14d="平稳",
            turning_point_status="no_data",
            trend=(),
            turning_points=(),
        )

    data_start = start_date or min(event.event_date for event in events)
    data_end = end_date or max(event.event_date for event in events)
    trend = build_trend(events, data_start, data_end)
    current = trend[-1] if trend else None
    change_7d = change_status(trend)
    turning_status, turning_points = build_turning_points(pair_id, events, pool, trend)

    return RelationshipResult(
        pair_id=pair_id,
        display_name=pool.display_name(pair_id),
        object_a=object_a,
        object_b=object_b,
        data_start=data_start,
        data_end=data_end,
        generated_at=actual_generated_at,
        current_temperature=current.relationship_temperature if current else None,
        current_band=current.temperature_band if current else None,
        card_status=card_status(current.temperature_band) if current else None,
        change_7d=change_7d,
        change_14d=change_7d,
        turning_point_status=turning_status,
        trend=tuple(trend),
        turning_points=tuple(turning_points),
    )


def build_trend(events: list[StandardizedEvent], start_date: date, end_date: date) -> list[DailyTrendPoint]:
    by_day: dict[date, list[StandardizedEvent]] = defaultdict(list)
    for event in events:
        by_day[event.event_date].append(event)

    daily_scores: dict[date, float | None] = {}
    daily_weights: dict[date, float] = {}
    event_counts: dict[date, int] = {}
    for current_day in date_range(start_date, end_date):
        day_events = by_day.get(current_day, [])
        event_counts[current_day] = len(day_events)
        if not day_events:
            daily_scores[current_day] = None
            daily_weights[current_day] = 0.0
            continue
        weighted_sum = sum(event.goldstein_scale * event_weight(event) for event in day_events)
        weight_sum = sum(event_weight(event) for event in day_events)
        daily_scores[current_day] = weighted_sum / weight_sum if weight_sum else None
        daily_weights[current_day] = weight_sum

    trend: list[DailyTrendPoint] = []
    days = list(date_range(start_date, end_date))
    for current_day in days:
        window_start = current_day - timedelta(days=ROLLING_DAYS - 1)
        window_scores = [
            score
            for day, score in daily_scores.items()
            if window_start <= day <= current_day and score is not None
        ]
        rolling = sum(window_scores) / len(window_scores) if window_scores else 0.0
        temperature = clamp(50 + rolling * TEMPERATURE_SCALE_FACTOR, 0, 100)
        trend.append(
            DailyTrendPoint(
                date=current_day,
                daily_weighted_goldstein=daily_scores[current_day],
                rolling_14d_goldstein=rolling,
                relationship_temperature=temperature,
                event_count=event_counts[current_day],
                event_weight=daily_weights[current_day],
                temperature_band=temperature_band(temperature),
            )
        )
    return trend


def build_turning_points(
    pair_id: str,
    events: list[StandardizedEvent],
    pool: CandidatePool,
    trend: list[DailyTrendPoint],
) -> tuple[TurningPointStatus, list[TurningPoint]]:
    if not trend:
        return "no_data", []
    if (trend[-1].date - trend[0].date).days + 1 < MINIMUM_DATA_DAYS:
        return "data_insufficient", []

    candidates: list[TrendCandidate] = []
    for index in range(ROLLING_DAYS + TREND_SEGMENT_DAYS, len(trend)):
        start_index = index - TREND_SEGMENT_DAYS
        delta = trend[index].relationship_temperature - trend[start_index].relationship_temperature
        if abs(delta) >= CHANGE_THRESHOLD:
            direction: ChangeStatus = "改善" if delta > 0 else "恶化"
            candidates.append((start_index, index, direction, delta))

    selected = build_trend_segments(trend, candidates)

    if not selected:
        return "no_significant_turning_points", []

    points = [
        explain_turning_point(pair_id, events, pool, trend[end_index], trend[start_index], delta)
        for start_index, end_index, delta in selected
    ]
    return "normal", points


def build_trend_segments(trend: list[DailyTrendPoint], candidates: list[TrendCandidate]) -> list[TrendSegment]:
    grouped: list[list[TrendCandidate]] = []
    current_group: list[TrendCandidate] = []
    current_end_index = -1

    for candidate in candidates:
        start_index, end_index, direction, _delta = candidate
        if current_group:
            _previous_start, _previous_end, previous_direction, _previous_delta = current_group[-1]
            should_start_new_group = direction != previous_direction or start_index > current_end_index + 1
            if should_start_new_group:
                grouped.append(current_group)
                current_group = []
                current_end_index = -1
        current_group.append(candidate)
        current_end_index = max(current_end_index, end_index)

    if current_group:
        grouped.append(current_group)

    segments: list[TrendSegment] = []
    for group in grouped:
        start_index = min(candidate[0] for candidate in group)
        end_index = max(candidate[1] for candidate in group)
        direction = group[0][2]
        segment_start, segment_end = snap_segment_to_extrema(trend, start_index, end_index, direction)
        delta = trend[segment_end].relationship_temperature - trend[segment_start].relationship_temperature
        if direction_for_delta(delta) == direction:
            segments.append((segment_start, segment_end, delta))

    selected = sorted(segments, key=lambda item: abs(item[2]), reverse=True)[:MAX_TREND_SEGMENTS]
    return sorted(selected, key=lambda item: trend[item[0]].date)


def snap_segment_to_extrema(
    trend: list[DailyTrendPoint],
    start_index: int,
    end_index: int,
    direction: ChangeStatus,
) -> tuple[int, int]:
    if direction == "改善":
        segment_start = min(
            range(start_index, end_index + 1),
            key=lambda index: trend[index].relationship_temperature,
        )
        segment_end = max(
            range(segment_start, end_index + 1),
            key=lambda index: trend[index].relationship_temperature,
        )
        return segment_start, segment_end

    segment_start = max(
        range(start_index, end_index + 1),
        key=lambda index: trend[index].relationship_temperature,
    )
    segment_end = min(
        range(segment_start, end_index + 1),
        key=lambda index: trend[index].relationship_temperature,
    )
    return segment_start, segment_end


def explain_turning_point(
    pair_id: str,
    events: list[StandardizedEvent],
    pool: CandidatePool,
    current: DailyTrendPoint,
    previous: DailyTrendPoint,
    delta: float,
) -> TurningPoint:
    direction = direction_for_delta(delta)
    change_end = current.date
    change_start = current.date - timedelta(days=EXPLANATION_WINDOW_DAYS - 1)
    baseline_end = change_start - timedelta(days=1)
    baseline_start = baseline_end - timedelta(days=EXPLANATION_WINDOW_DAYS - 1)
    drivers = tuple(
        build_drivers(
            pair_id,
            events,
            pool,
            baseline_start,
            baseline_end,
            change_start,
            change_end,
            direction,
        )
    )
    driver_roots = frozenset(driver.event_root_code for driver in drivers[:3])
    reports = tuple(build_reports(pair_id, events, pool, change_start, change_end, direction, driver_roots))
    driver_names = "”“".join(driver.label for driver in drivers[:3]) or "相关事件"
    direction_word = "上升" if direction == "改善" else "下降"
    leaning = "偏合作" if direction == "改善" else "偏冲突"
    summary = (
        f"这段趋势中，{pool.display_name(pair_id)}关系温度{direction_word}。"
        f"最近 7 天相比前 7 天，“{driver_names}”等{leaning}事件增加，相关报道线索可能推动了这段变化。"
    )
    return TurningPoint(
        date=current.date,
        previous_date=previous.date,
        temperature=current.relationship_temperature,
        previous_temperature=previous.relationship_temperature,
        delta=delta,
        direction=direction,
        summary=summary,
        baseline_start=baseline_start,
        baseline_end=baseline_end,
        change_start=change_start,
        change_end=change_end,
        drivers=drivers,
        reports=reports,
    )


def build_drivers(
    pair_id: str,
    events: list[StandardizedEvent],
    pool: CandidatePool,
    baseline_start: date,
    baseline_end: date,
    change_start: date,
    change_end: date,
    direction: ChangeStatus,
) -> list[DriverEvent]:
    groups: dict[tuple[str, str], dict[str, float]] = defaultdict(
        lambda: {
            "pre_count": 0,
            "post_count": 0,
            "pre_mentions": 0,
            "post_mentions": 0,
            "goldstein": 0.0,
        }
    )
    for event in events:
        if not is_relevant(event, pool, pair_id, source_only=False):
            continue
        if change_start <= event.event_date <= change_end:
            window = "post"
        elif baseline_start <= event.event_date <= baseline_end:
            window = "pre"
        else:
            window = None
        if window is None:
            continue
        root = event.event_root_code or "??"
        label = ROOT_LABELS.get(root, f"CAMEO {root}")
        key = (root, label)
        groups[key][f"{window}_count"] += 1
        groups[key][f"{window}_mentions"] += event.num_mentions
        if window == "post":
            groups[key]["goldstein"] += event.goldstein_scale

    scored: list[tuple[float, DriverEvent]] = []
    for (root, label), values in groups.items():
        post_count = int(values["post_count"])
        if post_count <= 0:
            continue
        pre_count = int(values["pre_count"])
        post_mentions = int(values["post_mentions"])
        pre_mentions = int(values["pre_mentions"])
        avg_goldstein = values["goldstein"] / post_count
        directional_score = avg_goldstein if direction == "改善" else -avg_goldstein
        score = directional_score + math.log1p(post_count) + 0.08 * math.log1p(max(post_mentions - pre_mentions, 0))
        scored.append(
            (
                score,
                DriverEvent(
                    event_root_code=root,
                    label=label,
                    direction="偏合作" if avg_goldstein >= 0 else "偏冲突",
                    post_count=post_count,
                    pre_count=pre_count,
                    count_delta=post_count - pre_count,
                    post_mentions=post_mentions,
                    pre_mentions=pre_mentions,
                    avg_goldstein=avg_goldstein,
                ),
            )
        )
    return [item for _, item in sorted(scored, key=lambda item: item[0], reverse=True)[:3]]


def build_reports(
    pair_id: str,
    events: list[StandardizedEvent],
    pool: CandidatePool,
    change_start: date,
    change_end: date,
    direction: ChangeStatus,
    driver_roots: frozenset[str] = frozenset(),
) -> list[KeyReport]:
    aggregates: dict[str, ReportAggregate] = {}
    for event in events:
        if not (change_start <= event.event_date <= change_end):
            continue
        if not event.source_url:
            continue
        root = event.event_root_code or "??"
        directional_goldstein = event.goldstein_scale if direction == "改善" else -event.goldstein_scale
        if directional_goldstein <= 0:
            continue
        label = ROOT_LABELS.get(root, f"CAMEO {root}")
        impact_direction = "偏合作" if event.goldstein_scale >= 0 else "偏冲突"
        score = directional_goldstein * event_weight(event)
        if root in driver_roots:
            score *= DRIVER_REPORT_MULTIPLIER
        domain = normalized_source_domain(event.source_domain, event.source_url)
        report = KeyReport(
            date=event.event_date,
            source_domain=domain,
            source_url=event.source_url,
            url_title=url_title(event.source_url),
            event_type=label,
            impact_direction=impact_direction,
            goldstein_scale=event.goldstein_scale,
            num_mentions=event.num_mentions,
            num_articles=event.num_articles,
        )
        aggregate = aggregates.get(event.source_url)
        if aggregate is None:
            aggregates[event.source_url] = ReportAggregate(
                total_score=score,
                best_score=score,
                report=report,
                domain=domain,
            )
            continue
        aggregate.total_score += score
        if score > aggregate.best_score:
            aggregate.best_score = score
            aggregate.report = report
            aggregate.domain = domain

    ranked = sorted(
        aggregates.values(),
        key=lambda item: (item.total_score, item.best_score, item.report.num_mentions, item.report.num_articles),
        reverse=True,
    )
    selected: list[ReportAggregate] = []
    selected_urls: set[str] = set()
    domain_counts: dict[str, int] = defaultdict(int)
    for item in ranked:
        if domain_counts[item.domain] >= MAX_REPORTS_PER_DOMAIN:
            continue
        selected.append(item)
        selected_urls.add(item.report.source_url)
        domain_counts[item.domain] += 1
        if len(selected) >= MAX_REPORTS:
            break

    backfill_target = min(MIN_REPORTS_WITH_DOMAIN_BACKFILL, MAX_REPORTS, len(ranked))
    if len(selected) < backfill_target:
        for item in ranked:
            if item.report.source_url in selected_urls:
                continue
            selected.append(item)
            selected_urls.add(item.report.source_url)
            if len(selected) >= backfill_target:
                break

    return [item.report for item in selected[:MAX_REPORTS]]


def normalized_source_domain(source_domain: str | None, source_url: str) -> str:
    domain = source_domain or urlparse(source_url).netloc or "source"
    domain = domain.lower().strip()
    return domain[4:] if domain.startswith("www.") else domain


def is_relevant(event: StandardizedEvent, pool: CandidatePool, pair_id: str, *, source_only: bool) -> bool:
    keywords_a, keywords_b = pool.keywords_for_pair(pair_id)
    if source_only:
        text = " ".join(part or "" for part in (event.source_domain, event.source_url)).lower()
    else:
        text = " ".join(
            part or ""
            for part in (
                event.actor1_name,
                event.actor2_name,
                event.source_domain,
                event.source_url,
            )
        ).lower()
    return any(keyword in text for keyword in keywords_a) and any(keyword in text for keyword in keywords_b)


def url_title(url: str) -> str:
    parsed = urlparse(url)
    tail = unquote(parsed.path.rstrip("/").split("/")[-1])
    cleaned = re.sub(r"[-_]+", " ", tail)
    cleaned = re.sub(r"\.[a-zA-Z0-9]{2,5}$", "", cleaned)
    words = [word for word in re.split(r"\s+", cleaned) if word and not word.isdigit()]
    if len(words) < 3:
        return parsed.netloc or "来源链接"
    return " ".join(words[:14])


def change_status(trend: list[DailyTrendPoint]) -> ChangeStatus:
    if len(trend) <= TREND_SEGMENT_DAYS:
        return "平稳"
    delta = trend[-1].relationship_temperature - trend[-1 - TREND_SEGMENT_DAYS].relationship_temperature
    return direction_for_delta(delta)


def direction_for_delta(delta: float) -> ChangeStatus:
    if delta >= CHANGE_THRESHOLD:
        return "改善"
    if delta <= -CHANGE_THRESHOLD:
        return "恶化"
    return "平稳"


def temperature_band(temperature: float) -> TemperatureBand:
    if temperature < 35:
        return "明显偏冲突"
    if temperature < 45:
        return "偏冲突"
    if temperature <= 55:
        return "接近中性"
    if temperature <= 65:
        return "偏合作"
    return "明显偏合作"


def card_status(band: TemperatureBand) -> CardStatus:
    if band in {"明显偏合作", "偏合作"}:
        return "偏合作"
    if band == "接近中性":
        return "接近中性"
    return "偏冲突"


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def date_range(start_date: date, end_date: date) -> list[date]:
    days = (end_date - start_date).days
    return [start_date + timedelta(days=offset) for offset in range(days + 1)]

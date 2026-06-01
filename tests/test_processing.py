from __future__ import annotations

import math
from datetime import UTC, date, datetime, timedelta

from relationship_temperature.config import load_candidate_pool
from relationship_temperature.models import StandardizedEvent
from relationship_temperature.processing import (
    build_reports,
    build_trend,
    card_status,
    event_weight,
    process_relationship,
    temperature_band,
)


def make_event(
    day: date,
    goldstein: float,
    *,
    root: str = "05",
    url: str | None = None,
    domain: str = "example.com",
    mentions: int = 4,
    articles: int = 2,
) -> StandardizedEvent:
    return StandardizedEvent(
        event_date=day,
        pair_id="chn_usa",
        object_a="chn",
        object_b="usa",
        actor1_country_code="CHN",
        actor2_country_code="USA",
        goldstein_scale=goldstein,
        num_mentions=mentions,
        num_articles=articles,
        event_root_code=root,
        actor1_name="China foreign ministry",
        actor2_name="United States officials",
        source_domain=domain,
        source_url=url or "https://example.com/china-usa-diplomacy-report",
    )


def test_event_weight_uses_natural_log() -> None:
    event = make_event(date(2026, 1, 1), 1.0)

    assert event_weight(event) == math.log1p(4)


def test_temperature_mapping_and_bands() -> None:
    start = date(2026, 1, 1)
    events = [make_event(start + timedelta(days=offset), 2.0) for offset in range(14)]

    trend = build_trend(events, start, start + timedelta(days=13))

    assert trend[-1].relationship_temperature == 74
    assert temperature_band(74) == "明显偏合作"
    assert card_status("明显偏合作") == "偏合作"
    assert card_status("偏冲突") == "偏冲突"


def test_data_insufficient_reason_code() -> None:
    pool = load_candidate_pool()
    start = date(2026, 1, 1)
    events = [make_event(start + timedelta(days=offset), 1.0) for offset in range(10)]

    result = process_relationship(
        "chn_usa",
        events,
        pool,
        generated_at=datetime(2026, 2, 1, tzinfo=UTC),
    )

    assert result.turning_point_status == "data_insufficient"
    assert result.turning_points == ()


def test_turning_points_and_explanation_windows() -> None:
    pool = load_candidate_pool()
    start = date(2026, 1, 1)
    events: list[StandardizedEvent] = []
    for offset in range(35):
        goldstein = -1.0 if offset < 18 else 4.0
        root = "11" if offset < 18 else "05"
        events.append(make_event(start + timedelta(days=offset), goldstein, root=root))

    result = process_relationship(
        "chn_usa",
        events,
        pool,
        generated_at=datetime(2026, 2, 10, tzinfo=UTC),
    )

    assert result.turning_point_status == "normal"
    assert len(result.turning_points) >= 1
    point = result.turning_points[0]
    assert point.previous_date < point.date
    assert point.delta >= 5
    assert point.change_start == point.date - timedelta(days=6)
    assert point.baseline_end == point.change_start - timedelta(days=1)
    assert point.reports
    assert "可能推动" in point.summary


def test_no_significant_turning_points_reason_code() -> None:
    pool = load_candidate_pool()
    start = date(2026, 1, 1)
    events = [make_event(start + timedelta(days=offset), 0.1) for offset in range(35)]

    result = process_relationship("chn_usa", events, pool)

    assert result.turning_point_status == "no_significant_turning_points"


def test_reports_include_actor_matched_url_without_pair_keywords() -> None:
    pool = load_candidate_pool()
    day = date(2026, 1, 20)
    events = [
        make_event(
            day,
            -5.0,
            root="18",
            url="https://bbc.com/news/world-asia-12345678",
            domain="bbc.com",
        )
    ]

    reports = build_reports("chn_usa", events, pool, day, day, "恶化", frozenset({"18"}))

    assert [report.source_domain for report in reports] == ["bbc.com"]


def test_reports_aggregate_same_url_and_keep_best_representative() -> None:
    pool = load_candidate_pool()
    day = date(2026, 1, 20)
    shared_url = "https://example.com/shared-report"
    events = [
        make_event(day, -1.0, root="11", url=shared_url, mentions=2),
        make_event(day, -6.0, root="18", url=shared_url, mentions=8),
        make_event(day, -2.0, root="19", url="https://other.com/second-report"),
    ]

    reports = build_reports("chn_usa", events, pool, day, day, "恶化", frozenset({"18"}))
    report = next(item for item in reports if item.source_url == shared_url)

    assert report.event_type == "攻击"
    assert report.goldstein_scale == -6.0
    assert report.num_mentions == 8


def test_reports_limit_domain_when_enough_sources_exist() -> None:
    pool = load_candidate_pool()
    day = date(2026, 1, 20)
    events = [
        make_event(day, -6.0, root="18", url=f"https://reuters.com/report-{index}", domain="www.reuters.com")
        for index in range(3)
    ]
    events.extend(
        make_event(day, -3.0, root="18", url=f"https://source{index}.com/report", domain=f"source{index}.com")
        for index in range(4)
    )

    reports = build_reports("chn_usa", events, pool, day, day, "恶化", frozenset({"18"}))

    assert len(reports) == 6
    assert sum(report.source_domain == "reuters.com" for report in reports) == 2


def test_reports_backfill_to_three_when_sources_are_sparse() -> None:
    pool = load_candidate_pool()
    day = date(2026, 1, 20)
    events = [
        make_event(day, -6.0, root="18", url=f"https://reuters.com/report-{index}", domain="reuters.com")
        for index in range(4)
    ]

    reports = build_reports("chn_usa", events, pool, day, day, "恶化", frozenset({"18"}))

    assert len(reports) == 3
    assert {report.source_domain for report in reports} == {"reuters.com"}


def test_reports_boost_driver_root_matches() -> None:
    pool = load_candidate_pool()
    day = date(2026, 1, 20)
    events = [
        make_event(day, -1.1, root="18", url="https://driver.com/report", domain="driver.com"),
        make_event(day, -1.4, root="11", url="https://generic.com/report", domain="generic.com"),
    ]

    reports = build_reports("chn_usa", events, pool, day, day, "恶化", frozenset({"18"}))

    assert reports[0].source_domain == "driver.com"


def test_reports_filter_against_trend_direction() -> None:
    pool = load_candidate_pool()
    day = date(2026, 1, 20)
    events = [
        make_event(day, -4.0, root="18", url="https://conflict.com/report", domain="conflict.com"),
        make_event(day, 6.0, root="06", url="https://cooperation.com/report", domain="cooperation.com"),
    ]

    worsening_reports = build_reports("chn_usa", events, pool, day, day, "恶化", frozenset({"18"}))
    improving_reports = build_reports("chn_usa", events, pool, day, day, "改善", frozenset({"06"}))

    assert [report.source_domain for report in worsening_reports] == ["conflict.com"]
    assert [report.source_domain for report in improving_reports] == ["cooperation.com"]

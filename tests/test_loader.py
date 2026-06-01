from __future__ import annotations

from datetime import date

from relationship_temperature.config import load_candidate_pool
from relationship_temperature.loader import build_pair_query, standardize_rows, standardize_rows_for_all_pairs


def test_build_pair_query_expands_europe_codes() -> None:
    pool = load_candidate_pool()

    query = build_pair_query(pool, "chn_europe", date(2026, 1, 1), date(2026, 3, 31))

    assert query.object_a == "chn"
    assert query.object_b == "europe"
    assert ["CHN"] in query.params
    assert ["EUR", "GBR", "DEU", "FRA", "ITA", "ESP", "NLD"] in query.params


def test_standardize_rows_filters_missing_required_values() -> None:
    rows: list[dict[str, object]] = [
        {
            "event_date": date(2026, 1, 1),
            "actor1_country_code": "CHN",
            "actor2_country_code": "USA",
            "goldstein_scale": "2.5",
            "num_mentions": 4,
            "num_articles": 2,
            "event_root_code": "05",
        },
        {
            "event_date": None,
            "actor1_country_code": "CHN",
            "actor2_country_code": "USA",
            "goldstein_scale": "2.5",
        },
    ]

    events = standardize_rows(rows, "chn_usa", "chn", "usa")

    assert len(events) == 1
    assert events[0].goldstein_scale == 2.5
    assert events[0].num_mentions == 4


def test_standardize_rows_for_all_pairs_expands_aggregate_without_illegal_overlap() -> None:
    pool = load_candidate_pool()
    rows: list[dict[str, object]] = [
        {
            "event_date": date(2026, 1, 1),
            "actor1_country_code": "CHN",
            "actor2_country_code": "GBR",
            "goldstein_scale": "1.0",
            "num_mentions": 3,
            "num_articles": 1,
            "event_root_code": "05",
        },
        {
            "event_date": date(2026, 1, 2),
            "actor1_country_code": "GBR",
            "actor2_country_code": "DEU",
            "goldstein_scale": "1.0",
            "num_mentions": 3,
            "num_articles": 1,
            "event_root_code": "05",
        },
    ]

    by_pair = standardize_rows_for_all_pairs(rows, pool)

    assert len(by_pair["chn_europe"]) == 1
    assert "chn_gbr" not in by_pair
    assert "chn_deu" not in by_pair
    assert "europe_gbr" not in by_pair
    assert "deu_europe" not in by_pair

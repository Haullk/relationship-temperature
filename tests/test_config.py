from __future__ import annotations

from relationship_temperature.config import canonical_pair_id, load_candidate_pool


def test_pair_ids_are_canonical_by_alphabetical_order() -> None:
    assert canonical_pair_id("usa", "chn") == "chn_usa"
    assert canonical_pair_id("RUS", "USA") == "rus_usa"


def test_candidate_pool_omits_uk_and_germany_as_selectable_objects() -> None:
    pool = load_candidate_pool()

    assert "gbr" not in pool.objects
    assert "deu" not in pool.objects
    assert all("gbr" not in pair_id.split("_") for pair_id in pool.legal_pair_ids)
    assert all("deu" not in pair_id.split("_") for pair_id in pool.legal_pair_ids)
    assert "chn_europe" in pool.legal_pair_ids
    assert "chn_usa" in pool.legal_pair_ids


def test_resolve_pair_normalizes_order_without_fallback() -> None:
    pool = load_candidate_pool()

    resolution = pool.resolve_pair("usa_chn")

    assert resolution.pair_id == "chn_usa"
    assert resolution.is_valid is True
    assert resolution.used_default is False


def test_resolve_pair_falls_back_for_removed_candidate() -> None:
    pool = load_candidate_pool()

    resolution = pool.resolve_pair("chn_gbr")

    assert resolution.pair_id == "chn_usa"
    assert resolution.is_valid is False
    assert resolution.used_default is True
    assert resolution.message is not None

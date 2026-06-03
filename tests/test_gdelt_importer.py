from __future__ import annotations

from datetime import UTC, date, datetime

from relationship_temperature.gdelt_importer import (
    candidate_country_codes,
    default_import_date,
    domain_from_url,
    export_file,
    export_files_for_day,
    parse_event_row,
)


def event_row(**overrides: str) -> list[str]:
    row = [""] * 61
    row[0] = "1307202076"
    row[1] = "20250603"
    row[6] = "CHINA"
    row[7] = "CHN"
    row[16] = "UNITED STATES"
    row[17] = "USA"
    row[26] = "054"
    row[27] = "054"
    row[28] = "05"
    row[29] = "1"
    row[30] = "6.0"
    row[31] = "5"
    row[33] = "3"
    row[59] = "20260603063000"
    row[60] = "https://www.example.com/story"
    for index, value in overrides.items():
        row[int(index)] = value
    return row


def test_export_files_for_day_uses_gdelt_15_minute_names() -> None:
    files = export_files_for_day(date(2026, 6, 3), "http://data.gdeltproject.org/gdeltv2")

    assert len(files) == 96
    assert files[0].file_name == "20260603000000.export.CSV.zip"
    assert files[-1].file_name == "20260603234500.export.CSV.zip"
    assert export_file(files[0].timestamp).url.endswith("/20260603000000.export.CSV.zip")


def test_parse_event_row_maps_required_project_fields() -> None:
    event = parse_event_row(
        event_row(),
        source_file="20260603063000.export.CSV.zip",
        source_file_timestamp=datetime(2026, 6, 3, 6, 30, tzinfo=UTC),
        candidate_codes=candidate_country_codes(),
    )

    assert event is not None
    assert event.global_event_id == 1307202076
    assert event.event_date == date(2025, 6, 3)
    assert event.actor1_country_code == "CHN"
    assert event.actor2_country_code == "USA"
    assert event.goldstein_scale == 6.0
    assert event.num_mentions == 5
    assert event.num_articles == 3
    assert event.source_domain == "example.com"


def test_parse_event_row_filters_non_candidate_or_invalid_rows() -> None:
    codes = candidate_country_codes()
    timestamp = datetime.now(UTC)

    assert parse_event_row(
        event_row(**{"17": "FJI"}),
        source_file="f.zip",
        source_file_timestamp=timestamp,
        candidate_codes=codes,
    ) is None
    assert parse_event_row(
        event_row(**{"17": "CHN"}),
        source_file="f.zip",
        source_file_timestamp=timestamp,
        candidate_codes=codes,
    ) is None
    assert parse_event_row(
        event_row(**{"30": ""}),
        source_file="f.zip",
        source_file_timestamp=timestamp,
        candidate_codes=codes,
    ) is None


def test_default_import_date_uses_previous_utc_day() -> None:
    assert default_import_date(date(2026, 6, 3)) == date(2026, 6, 2)


def test_domain_from_url_normalizes_www() -> None:
    assert domain_from_url("https://www.example.com/story") == "example.com"
    assert domain_from_url("example.org/path") == "example.org"

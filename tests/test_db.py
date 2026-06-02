from __future__ import annotations

from relationship_temperature.db import REQUIRED_GDELT_FIELDS, missing_required_fields, schema_sql


def test_required_field_check_reports_missing_fields() -> None:
    fields = REQUIRED_GDELT_FIELDS - {"source_url", "quad_class"}

    assert missing_required_fields(fields) == {"source_url", "quad_class"}


def test_schema_defines_independent_cache_table() -> None:
    sql = schema_sql().lower()

    assert "create table if not exists relationship_trend_cache" in sql
    assert "create table if not exists relationship_report_metadata" in sql
    assert "create table if not exists relationship_ai_explanation_cache" in sql
    assert "payload jsonb not null" in sql
    assert "gdelt_events_clean" not in sql

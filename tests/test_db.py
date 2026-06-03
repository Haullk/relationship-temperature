from __future__ import annotations

from pathlib import Path

from pytest import MonkeyPatch

from relationship_temperature import db
from relationship_temperature.db import REQUIRED_GDELT_FIELDS, missing_required_fields, schema_sql


def test_required_field_check_reports_missing_fields() -> None:
    fields = REQUIRED_GDELT_FIELDS - {"source_url", "quad_class"}

    assert missing_required_fields(fields) == {"source_url", "quad_class"}


def test_schema_defines_independent_cache_table() -> None:
    sql = schema_sql().lower()

    assert "create table if not exists relationship_trend_cache" in sql
    assert "create table if not exists relationship_report_metadata" in sql
    assert "create table if not exists relationship_ai_explanation_cache" in sql
    assert "create table if not exists gdelt_events_clean" in sql
    assert "create table if not exists relationship_gdelt_import_files" in sql
    assert "payload jsonb not null" in sql


def test_schema_ignores_hidden_macos_sidecar_files(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    (tmp_path / "001_visible.sql").write_text("select 1;", encoding="utf-8")
    (tmp_path / "._001_visible.sql").write_bytes(b"\xa3")

    monkeypatch.setattr(db, "MIGRATIONS_DIR", tmp_path)

    assert db.schema_sql() == "select 1;"

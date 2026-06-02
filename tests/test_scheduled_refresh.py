from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from relationship_temperature.scheduled_refresh import (
    default_expected_import_date,
    is_successful_import_batch,
    read_import_readiness,
    wait_for_import_readiness,
)


class FakeCursor:
    def __init__(self, conn: FakeConnection) -> None:
        self.conn = conn
        self.query = ""

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, query: str, params: object = ()) -> None:
        self.query = query

    def fetchall(self) -> list[dict[str, Any]]:
        if "from gdelt_import_batches" in self.query:
            return self.conn.batch_rows
        return [{"latest_event_date": self.conn.latest_event_date}]


class FakeConnection:
    def __init__(self, batch_rows: list[dict[str, Any]], latest_event_date: date | None) -> None:
        self.batch_rows = batch_rows
        self.latest_event_date = latest_event_date

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return FakeCursor(self)


def ready_batch(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "id": 1,
        "import_date": date(2026, 6, 1),
        "status": "success",
        "events_status": "success",
        "mentions_status": "success",
        "gkg_status": "skipped",
        "processing_status": "success",
        "files_attempted": 192,
        "files_imported": 192,
    }
    row.update(overrides)
    return row


def test_default_expected_import_date_uses_previous_day() -> None:
    assert default_expected_import_date(date(2026, 6, 2)) == date(2026, 6, 1)


def test_is_successful_import_batch_requires_all_statuses_and_file_counts() -> None:
    assert is_successful_import_batch(ready_batch())
    assert is_successful_import_batch(ready_batch(gkg_status="success"))
    assert not is_successful_import_batch(ready_batch(events_status="running"))
    assert not is_successful_import_batch(ready_batch(files_imported=191))


def test_read_import_readiness_requires_batch_and_clean_events() -> None:
    conn = FakeConnection([ready_batch()], date(2026, 6, 1))

    readiness = read_import_readiness(conn, date(2026, 6, 1))

    assert readiness.ready
    assert readiness.import_date == date(2026, 6, 1)
    assert readiness.latest_event_date == date(2026, 6, 1)


def test_read_import_readiness_rejects_stale_clean_events() -> None:
    conn = FakeConnection([ready_batch()], date(2026, 5, 31))

    readiness = read_import_readiness(conn, date(2026, 6, 1))

    assert not readiness.ready
    assert "gdelt_events_clean latest event_date" in readiness.reason


def test_wait_for_import_readiness_times_out() -> None:
    times = iter([0.0, 0.0, 11.0])

    with pytest.raises(RuntimeError, match="not ready within 10 seconds"):
        wait_for_import_readiness(
            expected_import_date=date(2026, 6, 1),
            timeout_seconds=10,
            poll_seconds=60,
            connector=lambda: FakeConnection([], None),
            sleeper=lambda _seconds: None,
            clock=lambda: next(times),
        )

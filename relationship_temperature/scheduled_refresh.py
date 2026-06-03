from __future__ import annotations

import argparse
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Protocol

from relationship_temperature.db import connect
from relationship_temperature.enrichment import enrich_cached_relationships
from relationship_temperature.precompute import run_precompute

DEFAULT_TIMEOUT_SECONDS = 3600
DEFAULT_POLL_SECONDS = 60


class CursorLike(Protocol):
    def execute(self, query: str, params: object = ...) -> object: ...
    def fetchall(self) -> list[dict[str, Any]]: ...


class ConnectionLike(Protocol):
    def __enter__(self) -> ConnectionLike: ...
    def __exit__(self, *_args: object) -> None: ...
    def cursor(self) -> Any: ...


@dataclass(frozen=True)
class ImportReadiness:
    ready: bool
    import_date: date | None
    latest_event_date: date | None
    reason: str


def default_expected_import_date(today: date | None = None) -> date:
    return (today or datetime.now().date()) - timedelta(days=1)


def is_successful_import_batch(row: dict[str, Any]) -> bool:
    return (
        row.get("status") == "success"
        and row.get("events_status") == "success"
        and row.get("mentions_status") == "success"
        and row.get("gkg_status") in {"skipped", "success"}
        and row.get("processing_status") == "success"
        and row.get("files_attempted") is not None
        and row.get("files_imported") == row.get("files_attempted")
    )


def read_import_readiness(conn: ConnectionLike, expected_import_date: date) -> ImportReadiness:
    batch = read_latest_import_batch(conn, expected_import_date)
    latest_event_date = read_latest_clean_event_date(conn)
    if batch is None:
        return ImportReadiness(
            ready=False,
            import_date=None,
            latest_event_date=latest_event_date,
            reason=f"gdelt_import_batches has no batch on or after {expected_import_date.isoformat()}",
        )

    import_date = coerce_date(batch.get("import_date"))
    if not is_successful_import_batch(batch):
        return ImportReadiness(
            ready=False,
            import_date=import_date,
            latest_event_date=latest_event_date,
            reason=describe_batch_not_ready(batch),
        )

    if latest_event_date is None or latest_event_date < expected_import_date:
        return ImportReadiness(
            ready=False,
            import_date=import_date,
            latest_event_date=latest_event_date,
            reason=f"gdelt_events_clean latest event_date is {latest_event_date}, below {expected_import_date}",
        )

    return ImportReadiness(
        ready=True,
        import_date=import_date,
        latest_event_date=latest_event_date,
        reason="ready",
    )


def read_latest_import_batch(conn: ConnectionLike, expected_import_date: date) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            select
              id,
              import_date,
              status,
              events_status,
              mentions_status,
              gkg_status,
              processing_status,
              files_attempted,
              files_imported
            from gdelt_import_batches
            where import_date >= %s
            order by import_date desc, id desc
            limit 1
            """,
            (expected_import_date,),
        )
        rows = cur.fetchall()
    return rows[0] if rows else None


def read_latest_clean_event_date(conn: ConnectionLike) -> date | None:
    with conn.cursor() as cur:
        cur.execute("select max(event_date) as latest_event_date from gdelt_events_clean")
        rows = cur.fetchall()
    if not rows:
        return None
    return coerce_date(rows[0].get("latest_event_date"))


def wait_for_import_readiness(
    *,
    expected_import_date: date,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    poll_seconds: int = DEFAULT_POLL_SECONDS,
    connector: Callable[[], ConnectionLike] = connect,
    sleeper: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> ImportReadiness:
    deadline = clock() + timeout_seconds
    last_status: ImportReadiness | None = None
    while True:
        with connector() as conn:
            last_status = read_import_readiness(conn, expected_import_date)
        if last_status.ready:
            return last_status
        remaining = deadline - clock()
        if remaining <= 0:
            raise RuntimeError(
                f"GDELT import was not ready within {timeout_seconds} seconds: {last_status.reason}"
            )
        sleeper(min(poll_seconds, remaining))


def run_scheduled_refresh(
    *,
    expected_import_date: date | None = None,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    poll_seconds: int = DEFAULT_POLL_SECONDS,
    with_ai: bool = True,
) -> None:
    target_date = expected_import_date or default_expected_import_date()
    readiness = wait_for_import_readiness(
        expected_import_date=target_date,
        timeout_seconds=timeout_seconds,
        poll_seconds=poll_seconds,
    )
    print(
        "gdelt import ready: "
        f"import_date={readiness.import_date}, latest_event_date={readiness.latest_event_date}"
    )
    count = run_precompute()
    print(f"precomputed {count} relationship pairs")
    if with_ai:
        results = enrich_cached_relationships(refresh_errors=True)
        ready = sum(1 for result in results if result.ai_status == "ready")
        print(f"ai enriched {ready}/{len(results)} turning points")


def describe_batch_not_ready(row: dict[str, Any]) -> str:
    fields = (
        "status",
        "events_status",
        "mentions_status",
        "gkg_status",
        "processing_status",
        "files_imported",
        "files_attempted",
    )
    return ", ".join(f"{field}={row.get(field)!r}" for field in fields)


def coerce_date(value: object) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Wait for GDELT import completion, then refresh trends and AI.")
    parser.add_argument("--expected-import-date", type=date.fromisoformat, default=None)
    parser.add_argument("--timeout-seconds", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--poll-seconds", type=int, default=DEFAULT_POLL_SECONDS)
    parser.add_argument("--without-ai", action="store_true")
    args = parser.parse_args()

    run_scheduled_refresh(
        expected_import_date=args.expected_import_date,
        timeout_seconds=args.timeout_seconds,
        poll_seconds=args.poll_seconds,
        with_ai=not args.without_ai,
    )


if __name__ == "__main__":
    main()

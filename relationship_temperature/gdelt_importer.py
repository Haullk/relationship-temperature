from __future__ import annotations

import argparse
import csv
import io
import os
import time
import zipfile
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from relationship_temperature.config import load_candidate_pool
from relationship_temperature.db import connect, ensure_cache_schema
from relationship_temperature.enrichment import enrich_cached_relationships
from relationship_temperature.precompute import run_precompute

GDELT_BASE_URL = "http://data.gdeltproject.org/gdeltv2"
EXPORT_SUFFIX = "export.CSV.zip"
CSV_FIELD_SIZE_LIMIT = 10 * 1024 * 1024
DEFAULT_REQUEST_TIMEOUT_SECONDS = 45
DEFAULT_WAIT_TIMEOUT_MINUTES = 60
DEFAULT_WAIT_INTERVAL_SECONDS = 300

csv.field_size_limit(CSV_FIELD_SIZE_LIMIT)


@dataclass(frozen=True)
class GdeltExportFile:
    timestamp: datetime
    file_name: str
    url: str


@dataclass(frozen=True)
class ImportStats:
    files_attempted: int = 0
    files_imported: int = 0
    rows_seen: int = 0
    rows_imported: int = 0
    rows_skipped: int = 0

    def add(self, other: ImportStats) -> ImportStats:
        return ImportStats(
            files_attempted=self.files_attempted + other.files_attempted,
            files_imported=self.files_imported + other.files_imported,
            rows_seen=self.rows_seen + other.rows_seen,
            rows_imported=self.rows_imported + other.rows_imported,
            rows_skipped=self.rows_skipped + other.rows_skipped,
        )


@dataclass(frozen=True)
class SourceReadiness:
    files_expected: int
    files_available: int
    missing_files: tuple[str, ...]

    @property
    def ready(self) -> bool:
        return self.files_expected > 0 and self.files_available == self.files_expected


@dataclass(frozen=True)
class EventRow:
    global_event_id: int
    event_date: date
    date_added: datetime | None
    actor1_name: str | None
    actor1_country_code: str
    actor2_name: str | None
    actor2_country_code: str
    event_code: str | None
    event_base_code: str | None
    event_root_code: str | None
    quad_class: int | None
    goldstein_scale: float
    num_mentions: int
    num_articles: int
    source_url: str | None
    source_domain: str | None
    source_file: str
    source_file_timestamp: datetime


def default_import_date(today: date | None = None) -> date:
    return (today or datetime.now(UTC).date()) - timedelta(days=1)


def intervals(day: date) -> Iterator[datetime]:
    start = datetime(day.year, day.month, day.day, tzinfo=UTC)
    for index in range(96):
        yield start + timedelta(minutes=15 * index)


def export_file(stamp: datetime, base_url: str = GDELT_BASE_URL) -> GdeltExportFile:
    prefix = stamp.strftime("%Y%m%d%H%M%S")
    file_name = f"{prefix}.{EXPORT_SUFFIX}"
    return GdeltExportFile(
        timestamp=stamp,
        file_name=file_name,
        url=f"{base_url.rstrip('/')}/{file_name}",
    )


def export_files_for_day(day: date, base_url: str = GDELT_BASE_URL) -> list[GdeltExportFile]:
    return [export_file(stamp, base_url) for stamp in intervals(day)]


def candidate_country_codes() -> frozenset[str]:
    pool = load_candidate_pool()
    return frozenset(code for candidate in pool.objects.values() for code in candidate.gdelt_codes)


def source_file_available(gdelt_file: GdeltExportFile, *, timeout_seconds: int = 15) -> bool:
    request = Request(gdelt_file.url, method="HEAD")
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            content_length = response.headers.get("Content-Length")
    except HTTPError as exc:
        return exc.code != 404 and exc.code < 400
    except URLError:
        return False
    if content_length is None:
        return True
    try:
        return int(content_length) > 0
    except ValueError:
        return False


def check_source_readiness(
    day: date,
    *,
    base_url: str = GDELT_BASE_URL,
    limit_files: int | None = None,
) -> SourceReadiness:
    files = export_files_for_day(day, base_url)
    if limit_files is not None:
        files = files[:limit_files]
    availability = [source_file_available(gdelt_file) for gdelt_file in files]
    missing = tuple(file.file_name for file, available in zip(files, availability, strict=True) if not available)
    return SourceReadiness(
        files_expected=len(files),
        files_available=len(files) - len(missing),
        missing_files=missing,
    )


def wait_for_source_readiness(
    day: date,
    *,
    base_url: str = GDELT_BASE_URL,
    limit_files: int | None = None,
    timeout_minutes: int = DEFAULT_WAIT_TIMEOUT_MINUTES,
    interval_seconds: int = DEFAULT_WAIT_INTERVAL_SECONDS,
) -> SourceReadiness:
    deadline = time.monotonic() + max(timeout_minutes, 0) * 60
    while True:
        readiness = check_source_readiness(day, base_url=base_url, limit_files=limit_files)
        if readiness.ready:
            return readiness
        missing_preview = ", ".join(readiness.missing_files[:6])
        if len(readiness.missing_files) > 6:
            missing_preview = f"{missing_preview}, ..."
        if time.monotonic() >= deadline:
            raise RuntimeError(
                f"GDELT export files are not ready for {day.isoformat()} after {timeout_minutes} minutes: "
                f"{readiness.files_available}/{readiness.files_expected} available. "
                f"Missing examples: {missing_preview}"
            )
        time.sleep(max(interval_seconds, 1))


def download_file(
    gdelt_file: GdeltExportFile,
    raw_dir: Path,
    *,
    timeout_seconds: int = DEFAULT_REQUEST_TIMEOUT_SECONDS,
) -> Path | None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    target = raw_dir / gdelt_file.file_name
    if target.exists() and target.stat().st_size > 0:
        return target
    try:
        with urlopen(gdelt_file.url, timeout=timeout_seconds) as response:
            payload = response.read()
    except HTTPError as exc:
        if exc.code == 404:
            return None
        raise
    target.write_bytes(payload)
    return target


def rows_from_zip(zip_path: Path) -> Iterator[list[str]]:
    with zipfile.ZipFile(zip_path) as archive:
        csv_names = archive.namelist()
        if not csv_names:
            return
        with archive.open(csv_names[0]) as zipped_csv:
            text_stream = io.TextIOWrapper(zipped_csv, encoding="latin-1", newline="")
            yield from csv.reader(text_stream, delimiter="\t")


def parse_event_row(
    row: Sequence[str],
    *,
    source_file: str,
    source_file_timestamp: datetime,
    candidate_codes: frozenset[str],
) -> EventRow | None:
    if len(row) < 61:
        return None
    actor1_country_code = optional_str(row[7])
    actor2_country_code = optional_str(row[17])
    if actor1_country_code is None or actor2_country_code is None:
        return None
    if actor1_country_code == actor2_country_code:
        return None
    if actor1_country_code not in candidate_codes or actor2_country_code not in candidate_codes:
        return None

    global_event_id = parse_int(row[0])
    event_date = parse_yyyymmdd(row[1])
    goldstein_scale = parse_float(row[30])
    if global_event_id is None or event_date is None or goldstein_scale is None:
        return None

    source_url = optional_str(row[60])
    return EventRow(
        global_event_id=global_event_id,
        event_date=event_date,
        date_added=parse_timestamp(row[59]),
        actor1_name=optional_str(row[6]),
        actor1_country_code=actor1_country_code,
        actor2_name=optional_str(row[16]),
        actor2_country_code=actor2_country_code,
        event_code=optional_str(row[26]),
        event_base_code=optional_str(row[27]),
        event_root_code=optional_str(row[28]),
        quad_class=parse_int(row[29]),
        goldstein_scale=goldstein_scale,
        num_mentions=parse_int(row[31]) or 0,
        num_articles=parse_int(row[33]) or 0,
        source_url=source_url,
        source_domain=domain_from_url(source_url),
        source_file=source_file,
        source_file_timestamp=source_file_timestamp,
    )


def import_zip(conn: Any, gdelt_file: GdeltExportFile, zip_path: Path, candidate_codes: frozenset[str]) -> ImportStats:
    rows_seen = 0
    rows_imported = 0
    rows_skipped = 0
    batch: list[EventRow] = []
    for row in rows_from_zip(zip_path):
        rows_seen += 1
        event = parse_event_row(
            row,
            source_file=gdelt_file.file_name,
            source_file_timestamp=gdelt_file.timestamp,
            candidate_codes=candidate_codes,
        )
        if event is None:
            rows_skipped += 1
            continue
        batch.append(event)
        if len(batch) >= 500:
            rows_imported += upsert_events(conn, batch)
            batch = []
    if batch:
        rows_imported += upsert_events(conn, batch)
    return ImportStats(
        files_imported=1,
        rows_seen=rows_seen,
        rows_imported=rows_imported,
        rows_skipped=rows_skipped,
    )


def upsert_events(conn: Any, events: Sequence[EventRow]) -> int:
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into gdelt_events_clean (
              global_event_id,
              event_date,
              date_added,
              actor1_name,
              actor1_country_code,
              actor2_name,
              actor2_country_code,
              event_code,
              event_base_code,
              event_root_code,
              quad_class,
              goldstein_scale,
              num_mentions,
              num_articles,
              source_url,
              source_domain,
              source_file,
              source_file_timestamp,
              imported_at
            )
            values (
              %(global_event_id)s,
              %(event_date)s,
              %(date_added)s,
              %(actor1_name)s,
              %(actor1_country_code)s,
              %(actor2_name)s,
              %(actor2_country_code)s,
              %(event_code)s,
              %(event_base_code)s,
              %(event_root_code)s,
              %(quad_class)s,
              %(goldstein_scale)s,
              %(num_mentions)s,
              %(num_articles)s,
              %(source_url)s,
              %(source_domain)s,
              %(source_file)s,
              %(source_file_timestamp)s,
              now()
            )
            on conflict (global_event_id) do update set
              event_date = excluded.event_date,
              date_added = excluded.date_added,
              actor1_name = excluded.actor1_name,
              actor1_country_code = excluded.actor1_country_code,
              actor2_name = excluded.actor2_name,
              actor2_country_code = excluded.actor2_country_code,
              event_code = excluded.event_code,
              event_base_code = excluded.event_base_code,
              event_root_code = excluded.event_root_code,
              quad_class = excluded.quad_class,
              goldstein_scale = excluded.goldstein_scale,
              num_mentions = excluded.num_mentions,
              num_articles = excluded.num_articles,
              source_url = excluded.source_url,
              source_domain = excluded.source_domain,
              source_file = excluded.source_file,
              source_file_timestamp = excluded.source_file_timestamp,
              imported_at = now()
            """,
            [event_to_params(event) for event in events],
        )
        return int(cur.rowcount)


def record_file_status(
    conn: Any,
    gdelt_file: GdeltExportFile,
    status: str,
    stats: ImportStats,
    *,
    error_message: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into relationship_gdelt_import_files (
              file_name,
              file_timestamp,
              source_url,
              status,
              rows_seen,
              rows_imported,
              rows_skipped,
              error_message,
              imported_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, now())
            on conflict (file_name) do update set
              file_timestamp = excluded.file_timestamp,
              source_url = excluded.source_url,
              status = excluded.status,
              rows_seen = excluded.rows_seen,
              rows_imported = excluded.rows_imported,
              rows_skipped = excluded.rows_skipped,
              error_message = excluded.error_message,
              imported_at = now()
            """,
            (
                gdelt_file.file_name,
                gdelt_file.timestamp,
                gdelt_file.url,
                status,
                stats.rows_seen,
                stats.rows_imported,
                stats.rows_skipped,
                error_message,
            ),
        )


def import_day(
    day: date,
    *,
    raw_dir: Path,
    base_url: str = GDELT_BASE_URL,
    limit_files: int | None = None,
    keep_raw: bool = False,
) -> ImportStats:
    files = export_files_for_day(day, base_url)
    if limit_files is not None:
        files = files[:limit_files]
    codes = candidate_country_codes()
    total = ImportStats()
    with connect() as conn:
        ensure_cache_schema(conn)
        conn.commit()
        for gdelt_file in files:
            total = total.add(ImportStats(files_attempted=1))
            try:
                zip_path = download_file(gdelt_file, raw_dir)
                if zip_path is None:
                    record_file_status(conn, gdelt_file, "skipped", ImportStats(files_attempted=1))
                    conn.commit()
                    total = total.add(ImportStats(rows_skipped=1))
                    continue
                stats = import_zip(conn, gdelt_file, zip_path, codes)
                record_file_status(conn, gdelt_file, "imported", stats)
                conn.commit()
                total = total.add(stats)
                if not keep_raw:
                    zip_path.unlink(missing_ok=True)
            except Exception as exc:
                conn.rollback()
                record_file_status(
                    conn,
                    gdelt_file,
                    "failed",
                    ImportStats(files_attempted=1),
                    error_message=str(exc),
                )
                conn.commit()
                raise
    return total


def import_days(
    start_date: date,
    days: int,
    *,
    raw_dir: Path,
    base_url: str = GDELT_BASE_URL,
    limit_files: int | None = None,
    keep_raw: bool = False,
) -> ImportStats:
    total = ImportStats()
    for offset in range(days):
        total = total.add(
            import_day(
                start_date + timedelta(days=offset),
                raw_dir=raw_dir,
                base_url=base_url,
                limit_files=limit_files,
                keep_raw=keep_raw,
            )
        )
    return total


def prune_old_events(retention_days: int) -> int:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                delete from gdelt_events_clean
                where event_date < (
                  select max(event_date) from gdelt_events_clean
                ) - (%s::int * interval '1 day')
                """,
                (retention_days,),
            )
            deleted = int(cur.rowcount)
        conn.commit()
    return deleted


def event_to_params(event: EventRow) -> dict[str, object]:
    return {
        "global_event_id": event.global_event_id,
        "event_date": event.event_date,
        "date_added": event.date_added,
        "actor1_name": event.actor1_name,
        "actor1_country_code": event.actor1_country_code,
        "actor2_name": event.actor2_name,
        "actor2_country_code": event.actor2_country_code,
        "event_code": event.event_code,
        "event_base_code": event.event_base_code,
        "event_root_code": event.event_root_code,
        "quad_class": event.quad_class,
        "goldstein_scale": event.goldstein_scale,
        "num_mentions": event.num_mentions,
        "num_articles": event.num_articles,
        "source_url": event.source_url,
        "source_domain": event.source_domain,
        "source_file": event.source_file,
        "source_file_timestamp": event.source_file_timestamp,
    }


def parse_int(value: str | None) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(str(value))
    except ValueError:
        return None


def parse_float(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value))
    except ValueError:
        return None


def parse_yyyymmdd(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except ValueError:
        return None


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=UTC)
    except ValueError:
        return None


def optional_str(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def domain_from_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value if "://" in value else f"http://{value}")
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host or None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import filtered GDELT 2.0 export events for relationship temperature."
    )
    parser.add_argument("--date", type=date.fromisoformat, default=None, help="UTC date to import, YYYY-MM-DD.")
    parser.add_argument("--days", type=int, default=1, help="Number of consecutive days to import.")
    parser.add_argument(
        "--limit-files",
        type=int,
        default=None,
        help="Import only the first N 15-minute files per day.",
    )
    parser.add_argument("--keep-raw", action="store_true", help="Keep downloaded zip files under GDELT_RAW_DIR.")
    parser.add_argument(
        "--wait-for-files",
        action="store_true",
        help="Wait until all selected export files are available.",
    )
    parser.add_argument("--wait-timeout-minutes", type=int, default=DEFAULT_WAIT_TIMEOUT_MINUTES)
    parser.add_argument("--wait-interval-seconds", type=int, default=DEFAULT_WAIT_INTERVAL_SECONDS)
    parser.add_argument("--precompute", action="store_true", help="Run relationship precompute after importing.")
    parser.add_argument("--with-ai", action="store_true", help="Run AI enrichment for every cached pair after precompute.")
    parser.add_argument("--precompute-days", type=int, default=90, help="Lookback days for relationship precompute.")
    parser.add_argument(
        "--prune-days",
        type=int,
        default=None,
        help="Delete events older than N days from latest event date.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    start_date = args.date or default_import_date()
    raw_dir = Path(os.getenv("GDELT_RAW_DIR", "data/gdelt/raw"))
    base_url = os.getenv("GDELT_BASE_URL", GDELT_BASE_URL)
    if args.wait_for_files:
        for offset in range(args.days):
            wait_for_source_readiness(
                start_date + timedelta(days=offset),
                base_url=base_url,
                limit_files=args.limit_files,
                timeout_minutes=args.wait_timeout_minutes,
                interval_seconds=args.wait_interval_seconds,
            )

    stats = import_days(
        start_date,
        args.days,
        raw_dir=raw_dir,
        base_url=base_url,
        limit_files=args.limit_files,
        keep_raw=args.keep_raw,
    )
    print(
        "gdelt imported "
        f"files={stats.files_imported}/{stats.files_attempted} "
        f"rows_seen={stats.rows_seen} rows_imported={stats.rows_imported} rows_skipped={stats.rows_skipped}"
    )

    if args.prune_days is not None:
        deleted = prune_old_events(args.prune_days)
        print(f"pruned {deleted} old gdelt_events_clean rows")

    if args.precompute:
        count = run_precompute(days=args.precompute_days)
        print(f"precomputed {count} relationship pairs")
        if args.with_ai:
            results = enrich_cached_relationships(refresh_errors=True)
            ready = sum(1 for result in results if result.ai_status == "ready")
            print(f"ai enriched {ready}/{len(results)} turning points")


if __name__ == "__main__":
    main()

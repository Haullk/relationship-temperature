from __future__ import annotations

import argparse
import hashlib
import json
import time
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any, cast

from relationship_temperature.ai import (
    DEFAULT_DEEPSEEK_MODEL,
    AiExplanation,
    AiExplanationInput,
    AiReportInput,
    AiReportSummary,
    DeepSeekClient,
    MissingDeepSeekKeyError,
)
from relationship_temperature.config import load_candidate_pool
from relationship_temperature.db import connect, ensure_cache_schema
from relationship_temperature.metadata import (
    FetchResponse,
    ReportMetadata,
    fallback_title_from_url,
    fetch_report_metadata,
)

MAX_SHORT_SUMMARY_LENGTH = 96
MAX_ERROR_MESSAGE_LENGTH = 200
AI_PROMPT_VERSION = "report-cn-v4"
METADATA_FETCH_WORKERS = 4
MAX_ENRICHMENT_RETRIES = 3


@dataclass(frozen=True)
class AiCacheRecord:
    status: str
    ai_payload: dict[str, Any] | None
    error_message: str | None
    generated_at: datetime | None


@dataclass(frozen=True)
class EnrichmentResult:
    pair_id: str
    turning_point_date: date
    ai_status: str
    message: str | None = None


def enrich_featured_relationships(
    *,
    client: DeepSeekClient | None = None,
    fetcher: Callable[[str], FetchResponse] | None = None,
) -> list[EnrichmentResult]:
    pool = load_candidate_pool()
    results: list[EnrichmentResult] = []
    for featured_pair in pool.featured_pairs:
        payload = read_relationship_payload(featured_pair.pair_id)
        if payload is None:
            continue
        relationship = payload
        for point in relationship.get("turning_points", []):
            if isinstance(point, dict) and isinstance(point.get("date"), str):
                results.append(
                    enrich_turning_point_with_retry(
                        featured_pair.pair_id,
                        date.fromisoformat(point["date"]),
                        payload=relationship,
                        client=client,
                        fetcher=fetcher,
                    )
                )
    return results


def enrich_turning_point_with_retry(
    pair_id: str,
    turning_point_date: date,
    *,
    payload: dict[str, Any] | None = None,
    client: DeepSeekClient | None = None,
    fetcher: Callable[[str], FetchResponse] | None = None,
    max_attempts: int = MAX_ENRICHMENT_RETRIES,
) -> EnrichmentResult:
    for attempt in range(1, max_attempts + 1):
        try:
            return enrich_turning_point(
                pair_id,
                turning_point_date,
                payload=payload,
                client=client,
                fetcher=fetcher,
            )
        except Exception as exc:
            if not is_retryable_database_error(exc) or attempt >= max_attempts:
                raise
            time.sleep(0.5 * attempt)
    raise RuntimeError("unreachable enrichment retry state")


def is_retryable_database_error(exc: Exception) -> bool:
    name = exc.__class__.__name__.lower()
    message = str(exc).lower()
    return "deadlock" in name or "deadlock detected" in message


def enrich_turning_point(
    pair_id: str,
    turning_point_date: date,
    *,
    payload: dict[str, Any] | None = None,
    client: DeepSeekClient | None = None,
    fetcher: Callable[[str], FetchResponse] | None = None,
) -> EnrichmentResult:
    with connect() as conn:
        ensure_cache_schema(conn)
        relationship_payload = payload if payload is not None else _read_relationship_payload(conn, pair_id)
        if relationship_payload is None:
            return EnrichmentResult(pair_id, turning_point_date, "error", "relationship cache missing")

        turning_point = find_turning_point(relationship_payload, turning_point_date)
        if turning_point is None:
            return EnrichmentResult(pair_id, turning_point_date, "error", "turning point missing")

        metadata_by_url = ensure_report_metadata(conn, turning_point, fetcher=fetcher)
        merge_metadata_into_turning_point(turning_point, metadata_by_url)
        ai_input = build_ai_input(relationship_payload, turning_point)
        input_hash = ai_input_hash(ai_input)
        actual_client = client or DeepSeekClient()
        model = actual_client.model or DEFAULT_DEEPSEEK_MODEL
        cached = read_ai_cache(conn, pair_id, turning_point_date, input_hash, model)
        if cached is not None:
            apply_ai_cache_to_turning_point(turning_point, cached)
            _update_relationship_payload(conn, pair_id, relationship_payload)
            return EnrichmentResult(
                pair_id,
                turning_point_date,
                str(turning_point.get("ai_status")),
                cached.error_message,
            )

        try:
            explanation = actual_client.generate_explanation(ai_input)
        except MissingDeepSeekKeyError as exc:
            turning_point["ai_status"] = "missing_key"
            _update_relationship_payload(conn, pair_id, relationship_payload)
            return EnrichmentResult(pair_id, turning_point_date, "missing_key", str(exc))
        except Exception as exc:
            error_message = sanitize_error_message(str(exc))
            write_ai_cache(conn, pair_id, turning_point_date, input_hash, model, "error", None, error_message)
            turning_point["ai_status"] = "error"
            _update_relationship_payload(conn, pair_id, relationship_payload)
            return EnrichmentResult(pair_id, turning_point_date, "error", error_message)

        write_ai_cache(conn, pair_id, turning_point_date, input_hash, model, "ready", explanation.to_payload(), None)
        apply_ai_to_turning_point(turning_point, explanation, datetime.now(UTC))
        _update_relationship_payload(conn, pair_id, relationship_payload)
        return EnrichmentResult(pair_id, turning_point_date, "ready")


def sanitize_error_message(message: str | None, limit: int = MAX_ERROR_MESSAGE_LENGTH) -> str | None:
    if message is None:
        return None
    cleaned = " ".join(message.split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[:limit].rstrip()}..."


def ensure_report_metadata(
    conn: Any,
    turning_point: dict[str, Any],
    *,
    fetcher: Callable[[str], FetchResponse] | None = None,
) -> dict[str, ReportMetadata]:
    reports = [report for report in turning_point.get("reports", []) if isinstance(report, dict)]
    urls = [str(report.get("source_url")) for report in reports if report.get("source_url")]
    metadata_by_url = read_report_metadata(conn, urls)
    missing_urls = list(dict.fromkeys(source_url for source_url in urls if source_url not in metadata_by_url))
    if not missing_urls:
        return metadata_by_url

    max_workers = min(METADATA_FETCH_WORKERS, len(missing_urls))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures: dict[Future[ReportMetadata], str] = {
            executor.submit(fetch_report_metadata, source_url, fetcher=fetcher): source_url
            for source_url in missing_urls
        }
        for future in as_completed(futures):
            source_url = futures[future]
            try:
                metadata = future.result()
            except Exception as exc:
                metadata = ReportMetadata(
                    source_url=source_url,
                    status="fetch_error",
                    error_message=str(exc),
                )
            write_report_metadata(conn, metadata)
            metadata_by_url[source_url] = metadata
    return metadata_by_url


def merge_metadata_into_turning_point(
    turning_point: dict[str, Any],
    metadata_by_url: dict[str, ReportMetadata],
) -> None:
    reports = [report for report in turning_point.get("reports", []) if isinstance(report, dict)]
    for report in reports:
        source_url = str(report.get("source_url") or "")
        metadata = metadata_by_url.get(source_url)
        if metadata is None:
            report["metadata_status"] = "missing"
            continue
        report["metadata_status"] = metadata.status
        report["resolved_title"] = metadata.resolved_title
        report["meta_description"] = metadata.meta_description
        report["short_summary"] = short_summary(metadata.meta_description)


def build_ai_input(relationship: dict[str, Any], turning_point: dict[str, Any]) -> AiExplanationInput:
    reports: list[AiReportInput] = []
    for report in turning_point.get("reports", []):
        if not isinstance(report, dict):
            continue
        source_url = str(report.get("source_url") or "")
        if not source_url:
            continue
        reports.append(
            AiReportInput(
                date=date.fromisoformat(str(report["date"])),
                source_domain=str(report.get("source_domain") or ""),
                source_url=source_url,
                event_type=str(report.get("event_type") or ""),
                title=str(
                    report.get("resolved_title")
                    or report.get("url_title")
                    or fallback_title_from_url(source_url)
                ),
                description=cast(str | None, report.get("meta_description")),
            )
        )

    drivers = tuple(
        str(driver.get("label"))
        for driver in turning_point.get("drivers", [])
        if isinstance(driver, dict) and driver.get("label")
    )
    return AiExplanationInput(
        pair_id=str(relationship["pair_id"]),
        display_name=str(relationship["display_name"]),
        direction=str(turning_point["direction"]),
        delta=float(turning_point["delta"]),
        previous_date=date.fromisoformat(str(turning_point["previous_date"])),
        date=date.fromisoformat(str(turning_point["date"])),
        change_start=date.fromisoformat(str(turning_point["change_start"])),
        change_end=date.fromisoformat(str(turning_point["change_end"])),
        drivers=drivers[:3],
        reports=tuple(reports[:6]),
    )


def ai_input_hash(ai_input: AiExplanationInput) -> str:
    payload = json.dumps(
        {"prompt_version": AI_PROMPT_VERSION, "input": _json_ready(ai_input)},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def apply_ai_cache_to_turning_point(turning_point: dict[str, Any], cached: AiCacheRecord) -> None:
    if cached.status == "ready" and cached.ai_payload is not None:
        explanation = AiExplanation(
            main_event=str(cached.ai_payload.get("main_event") or ""),
            summary=str(cached.ai_payload.get("summary") or ""),
            evidence=tuple(str(item) for item in cached.ai_payload.get("evidence", []) if str(item)),
            caveat=str(cached.ai_payload.get("caveat") or ""),
            report_summaries=tuple(
                AiReportSummary(
                    source_url=str(item.get("source_url") or ""),
                    title=str(item.get("title") or ""),
                    summary=str(item.get("summary") or ""),
                )
                for item in cached.ai_payload.get("report_summaries", [])
                if isinstance(item, dict)
            ),
        )
        apply_ai_to_turning_point(turning_point, explanation, cached.generated_at)
        return
    turning_point["ai_status"] = cached.status


def apply_ai_to_turning_point(
    turning_point: dict[str, Any],
    explanation: AiExplanation,
    generated_at: datetime | None,
) -> None:
    turning_point["ai_status"] = "ready"
    turning_point["ai_summary"] = explanation.summary
    turning_point["ai_main_event"] = explanation.main_event
    turning_point["ai_evidence"] = list(explanation.evidence)
    turning_point["ai_generated_at"] = generated_at.isoformat() if generated_at else None
    turning_point["ai_prompt_version"] = AI_PROMPT_VERSION
    apply_report_summaries(turning_point, explanation.report_summaries)


def apply_report_summaries(
    turning_point: dict[str, Any],
    report_summaries: tuple[AiReportSummary, ...],
) -> None:
    summaries_by_url = {item.source_url: item for item in report_summaries if item.source_url}
    reports = [report for report in turning_point.get("reports", []) if isinstance(report, dict)]
    for report in reports:
        source_url = str(report.get("source_url") or "")
        summary = summaries_by_url.get(source_url)
        if summary is None:
            report["chinese_title"] = fallback_chinese_report_title(report)
            report["chinese_summary"] = fallback_chinese_report_summary(report)
            continue
        report["chinese_title"] = summary.title
        report["chinese_summary"] = summary.summary


def fallback_chinese_report_title(report: dict[str, Any]) -> str:
    event_type = str(report.get("event_type") or "").strip() or "相关事件"
    return f"{event_type}相关报道线索"


def fallback_chinese_report_summary(report: dict[str, Any]) -> str:
    report_date = str(report.get("date") or "").strip()
    source_domain = str(report.get("source_domain") or "").strip() or "来源网站"
    event_type = str(report.get("event_type") or "").strip() or "相关事件"
    date_prefix = f"{report_date}，" if report_date else ""
    return f"{date_prefix}{source_domain} 提供了一条“{event_type}”相关线索；点击可查看原始报道。"


def short_summary(description: str | None) -> str | None:
    if not description:
        return None
    cleaned = " ".join(description.split())
    if len(cleaned) <= MAX_SHORT_SUMMARY_LENGTH:
        return cleaned
    return f"{cleaned[:MAX_SHORT_SUMMARY_LENGTH].rstrip()}..."


def find_turning_point(payload: dict[str, Any], turning_point_date: date) -> dict[str, Any] | None:
    for point in payload.get("turning_points", []):
        if isinstance(point, dict) and point.get("date") == turning_point_date.isoformat():
            return point
    return None


def read_relationship_payload(pair_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        ensure_cache_schema(conn)
        return _read_relationship_payload(conn, pair_id)


def _read_relationship_payload(conn: Any, pair_id: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute("select payload from relationship_trend_cache where pair_id = %s", (pair_id,))
        rows = cur.fetchall()
    if not rows:
        return None
    return cast(dict[str, Any], rows[0]["payload"])


def _update_relationship_payload(conn: Any, pair_id: str, payload: dict[str, Any]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "update relationship_trend_cache set payload = %s::jsonb, generated_at = generated_at where pair_id = %s",
            (json.dumps(payload, ensure_ascii=False), pair_id),
        )


def read_report_metadata(conn: Any, source_urls: list[str]) -> dict[str, ReportMetadata]:
    if not source_urls:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            """
            select
              source_url, resolved_title, meta_description, canonical_url,
              status, http_status, error_message, fetched_at
            from relationship_report_metadata
            where source_url = any(%s::text[])
            """,
            (source_urls,),
        )
        rows = cur.fetchall()
    return {
        str(row["source_url"]): ReportMetadata(
            source_url=str(row["source_url"]),
            status=cast(Any, row["status"]),
            resolved_title=cast(str | None, row["resolved_title"]),
            meta_description=cast(str | None, row["meta_description"]),
            canonical_url=cast(str | None, row["canonical_url"]),
            http_status=cast(int | None, row["http_status"]),
            error_message=cast(str | None, row["error_message"]),
            fetched_at=cast(datetime | None, row["fetched_at"]),
        )
        for row in rows
    }


def write_report_metadata(conn: Any, metadata: ReportMetadata) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into relationship_report_metadata (
              source_url, resolved_title, meta_description, canonical_url,
              status, http_status, error_message, fetched_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, now())
            on conflict (source_url) do update set
              resolved_title = excluded.resolved_title,
              meta_description = excluded.meta_description,
              canonical_url = excluded.canonical_url,
              status = excluded.status,
              http_status = excluded.http_status,
              error_message = excluded.error_message,
              fetched_at = now()
            """,
            (
                metadata.source_url,
                metadata.resolved_title,
                metadata.meta_description,
                metadata.canonical_url,
                metadata.status,
                metadata.http_status,
                metadata.error_message,
            ),
        )


def read_ai_cache(
    conn: Any,
    pair_id: str,
    turning_point_date: date,
    input_hash: str,
    model: str,
) -> AiCacheRecord | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            select status, ai_payload, error_message, generated_at
            from relationship_ai_explanation_cache
            where pair_id = %s
              and turning_point_date = %s
              and input_hash = %s
              and model = %s
            """,
            (pair_id, turning_point_date, input_hash, model),
        )
        rows = cur.fetchall()
    if not rows:
        return None
    row = rows[0]
    return AiCacheRecord(
        status=str(row["status"]),
        ai_payload=cast(dict[str, Any] | None, row["ai_payload"]),
        error_message=cast(str | None, row["error_message"]),
        generated_at=cast(datetime | None, row["generated_at"]),
    )


def write_ai_cache(
    conn: Any,
    pair_id: str,
    turning_point_date: date,
    input_hash: str,
    model: str,
    status: str,
    ai_payload: dict[str, Any] | None,
    error_message: str | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into relationship_ai_explanation_cache (
              pair_id, turning_point_date, input_hash, model, status, ai_payload, error_message, generated_at
            )
            values (%s, %s, %s, %s, %s, %s::jsonb, %s, now())
            on conflict (pair_id, turning_point_date, input_hash, model) do update set
              status = excluded.status,
              ai_payload = excluded.ai_payload,
              error_message = excluded.error_message,
              generated_at = now()
            """,
            (
                pair_id,
                turning_point_date,
                input_hash,
                model,
                status,
                json.dumps(ai_payload, ensure_ascii=False) if ai_payload is not None else None,
                error_message,
            ),
        )


def _json_ready(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return _json_ready(value.__dict__)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, tuple):
        return [_json_ready(item) for item in value]
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_ready(item) for key, item in value.items()}
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich relationship trend cache with metadata and AI explanation.")
    parser.add_argument("--pair", help="Pair id, e.g. rus_ukr")
    parser.add_argument("--turning-point-date", help="Turning point date, e.g. 2026-04-06")
    parser.add_argument("--featured", action="store_true", help="Enrich all featured pairs.")
    args = parser.parse_args()

    if args.featured:
        results = enrich_featured_relationships()
        print(json.dumps([result.__dict__ for result in results], ensure_ascii=False, default=str))
        return
    if not args.pair or not args.turning_point_date:
        parser.error("--pair and --turning-point-date are required unless --featured is set")
    result = enrich_turning_point(args.pair, date.fromisoformat(args.turning_point_date))
    print(json.dumps(result.__dict__, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()

from __future__ import annotations

from datetime import UTC, datetime

from relationship_temperature.ai import AiExplanation, AiLocalizedExplanation, AiReportSummary
from relationship_temperature.enrichment import (
    AiCacheRecord,
    ai_input_hash,
    apply_ai_cache_to_turning_point,
    apply_ai_to_turning_point,
    best_report_title,
    build_ai_input,
    is_retryable_database_error,
    merge_metadata_into_turning_point,
    sanitize_error_message,
    short_summary,
    should_use_ai_cache,
)
from relationship_temperature.metadata import ReportMetadata


def relationship_payload() -> dict[str, object]:
    return {
        "pair_id": "rus_ukr",
        "display_name": "俄罗斯-乌克兰",
        "turning_points": [turning_point_payload()],
    }


def turning_point_payload() -> dict[str, object]:
    return {
        "date": "2026-04-06",
        "previous_date": "2026-03-22",
        "direction": "恶化",
        "delta": -11.1,
        "baseline_start": "2026-03-24",
        "baseline_end": "2026-03-30",
        "change_start": "2026-03-31",
        "change_end": "2026-04-06",
        "drivers": [
            {"event_root_code": "19", "label": "战斗"},
            {"event_root_code": "18", "label": "攻击"},
        ],
        "reports": [
            {
                "date": "2026-04-03",
                "source_domain": "example.com",
                "source_url": "https://example.com/story",
                "url_title": "url fallback title",
                "event_type": "战斗",
            }
        ],
    }


def test_merge_metadata_into_turning_point_prefers_resolved_title_and_summary() -> None:
    point = turning_point_payload()
    metadata = ReportMetadata(
        source_url="https://example.com/story",
        status="ready",
        resolved_title="Russia strikes targets near Kyiv",
        meta_description="A concise description from the source page.",
    )

    merge_metadata_into_turning_point(point, {metadata.source_url: metadata})

    report = point["reports"][0]  # type: ignore[index]
    assert report["metadata_status"] == "ready"
    assert report["resolved_title"] == "Russia strikes targets near Kyiv"
    assert report["short_summary"] == "A concise description from the source page."


def test_build_ai_input_uses_metadata_title_and_driver_labels() -> None:
    relationship = relationship_payload()
    point = turning_point_payload()
    metadata = ReportMetadata(
        source_url="https://example.com/story",
        status="ready",
        resolved_title="Resolved source title",
        meta_description="Source description",
    )
    merge_metadata_into_turning_point(point, {metadata.source_url: metadata})

    ai_input = build_ai_input(relationship, point)

    assert ai_input.display_name == "俄罗斯-乌克兰"
    assert ai_input.drivers == ("战斗", "攻击")
    assert ai_input.reports[0].title == "Resolved source title"
    assert ai_input.reports[0].description == "Source description"


def test_ai_input_hash_changes_when_metadata_changes() -> None:
    relationship = relationship_payload()
    first = turning_point_payload()
    second = turning_point_payload()
    merge_metadata_into_turning_point(
        first,
        {
            "https://example.com/story": ReportMetadata(
                source_url="https://example.com/story",
                status="ready",
                resolved_title="First title",
            )
        },
    )
    merge_metadata_into_turning_point(
        second,
        {
            "https://example.com/story": ReportMetadata(
                source_url="https://example.com/story",
                status="ready",
                resolved_title="Second title",
            )
        },
    )

    assert ai_input_hash(build_ai_input(relationship, first)) != ai_input_hash(build_ai_input(relationship, second))


def test_apply_ai_payload_and_cached_error_status() -> None:
    point = turning_point_payload()
    generated_at = datetime(2026, 4, 7, tzinfo=UTC)

    apply_ai_to_turning_point(
        point,
        AiExplanation(
            main_event="战场袭击升级",
            summary="相关报道集中在袭击和战斗事件，关系指数随之下降。",
            evidence=("2026-04-03：报道标题提到 Kyiv strikes",),
            caveat="这是媒体事件信号。",
            report_summaries=(
                AiReportSummary(
                    source_url="https://example.com/story",
                    title="俄方打击基辅附近目标",
                    summary="报道提到俄方打击和停火希望。",
                ),
            ),
            ai_i18n={
                "en": AiLocalizedExplanation(
                    main_event="Battlefield strikes intensified",
                    summary="Reports focused on strikes and fighting, and the relationship index fell.",
                    evidence=("2026-04-03: example.com reported strikes near Kyiv.",),
                    caveat="This is a media-event signal.",
                ),
            },
        ),
        generated_at,
    )

    assert point["ai_status"] == "ready"
    assert point["ai_main_event"] == "战场袭击升级"
    assert point["ai_i18n"]["en"]["main_event"] == "Battlefield strikes intensified"  # type: ignore[index]
    assert point["ai_generated_at"] == generated_at.isoformat()
    report = point["reports"][0]  # type: ignore[index]
    assert report["chinese_title"] == "俄方打击基辅附近目标"
    assert report["chinese_summary"] == "报道提到俄方打击和停火希望。"

    error_point = turning_point_payload()
    apply_ai_cache_to_turning_point(
        error_point,
        AiCacheRecord(status="error", ai_payload=None, error_message="boom", generated_at=None),
    )
    assert error_point["ai_status"] == "error"


def test_cached_error_can_be_retried_when_forced() -> None:
    error_cache = AiCacheRecord(status="error", ai_payload=None, error_message="boom", generated_at=None)
    incomplete_ready_cache = AiCacheRecord(
        status="ready",
        ai_payload={"summary": "ready"},
        error_message=None,
        generated_at=None,
    )
    ready_cache = AiCacheRecord(
        status="ready",
        ai_payload={
            "summary": "ready",
            "ai_i18n": {
                locale: {"main_event": "Event", "summary": "Summary"}
                for locale in ("en", "ja", "ko", "zh-TW")
            },
        },
        error_message=None,
        generated_at=None,
    )

    assert should_use_ai_cache(error_cache, refresh_errors=False)
    assert not should_use_ai_cache(error_cache, refresh_errors=True)
    assert not should_use_ai_cache(incomplete_ready_cache, refresh_errors=True)
    assert should_use_ai_cache(ready_cache, refresh_errors=True)


def test_apply_ai_payload_fills_missing_report_translation_with_chinese_fallback() -> None:
    point = turning_point_payload()

    apply_ai_to_turning_point(
        point,
        AiExplanation(
            main_event="战场袭击升级",
            summary="相关报道集中在袭击和战斗事件。",
            evidence=("2026-04-03：报道标题提到 Kyiv strikes",),
            caveat="这是媒体事件信号。",
            report_summaries=(),
        ),
        datetime(2026, 4, 7, tzinfo=UTC),
    )

    report = point["reports"][0]  # type: ignore[index]
    assert report["chinese_title"] == "来自 example.com 的相关报道"
    assert report["chinese_summary"] == "2026-04-03，example.com 提供了一条相关报道线索；点击可查看原始报道。"


def test_best_report_title_ignores_boilerplate_metadata() -> None:
    report = {
        "resolved_title": "Just a moment...",
        "url_title": "us china trade journalist expulsions",
    }

    assert best_report_title(report, "https://example.com/us-china-trade-journalist-expulsions") == (
        "us china trade journalist expulsions"
    )


def test_short_summary_truncates_long_descriptions() -> None:
    assert short_summary(None) is None
    long_text = " ".join(["description"] * 30)

    summary = short_summary(long_text)

    assert summary is not None
    assert summary.endswith("...")
    assert len(summary) <= 99


def test_sanitize_error_message_compacts_and_limits_storage_value() -> None:
    message = " \n ".join(["api-error"] * 80)

    sanitized = sanitize_error_message(message)

    assert sanitized is not None
    assert "\n" not in sanitized
    assert len(sanitized) <= 203
    assert sanitized.endswith("...")


def test_deadlock_error_is_retryable() -> None:
    assert is_retryable_database_error(RuntimeError("deadlock detected"))
    assert not is_retryable_database_error(RuntimeError("ordinary failure"))

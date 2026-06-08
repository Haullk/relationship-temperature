from __future__ import annotations

import json
from datetime import date
from typing import Any

import pytest

from relationship_temperature.ai import (
    AiExplanationInput,
    AiLocalizedExplanation,
    AiReportInput,
    AiReportSummary,
    DeepSeekClient,
    MissingDeepSeekKeyError,
    build_deepseek_payload,
    complete_ai_explanation,
    parse_ai_explanation,
    truncate_error_body,
)


def make_prompt_input() -> AiExplanationInput:
    return AiExplanationInput(
        pair_id="rus_ukr",
        display_name="俄罗斯-乌克兰",
        direction="恶化",
        delta=-11.1,
        previous_date=date(2026, 3, 22),
        date=date(2026, 4, 6),
        change_start=date(2026, 3, 31),
        change_end=date(2026, 4, 6),
        drivers=("战斗", "攻击", "非常规暴力"),
        reports=(
            AiReportInput(
                date=date(2026, 4, 3),
                source_domain="example.com",
                source_url="https://example.com/story",
                event_type="战斗",
                title="Russia strikes targets near Kyiv",
                description="Ukraine hopes for an Easter truce.",
            ),
        ),
    )


def test_build_deepseek_payload_uses_json_output_and_disabled_thinking() -> None:
    payload = build_deepseek_payload(make_prompt_input(), "deepseek-v4-flash")

    assert payload["model"] == "deepseek-v4-flash"
    assert payload["response_format"] == {"type": "json_object"}
    assert payload["thinking"] == {"type": "disabled"}
    assert "俄罗斯-乌克兰" in payload["messages"][1]["content"]
    assert "ai_i18n" in payload["messages"][1]["content"]


def test_parse_ai_explanation_requires_json_fields() -> None:
    parsed = parse_ai_explanation(
        json.dumps(
            {
                "main_event": "战场袭击升级",
                "summary": "俄乌关系指数下降，相关报道集中在袭击和战斗事件。",
                "evidence": ["2026-04-03：报道提到 Kyiv region strikes", "2026-04-03：事件类型集中在战斗"],
                "report_summaries": [
                    {
                        "source_url": "https://example.com/story",
                        "title": "俄方打击基辅附近目标",
                        "summary": "报道提到俄方打击与复活节停火希望。",
                    }
                ],
                "caveat": "这是媒体事件信号，不代表确定因果。",
            }
        )
    )

    assert parsed.main_event == "战场袭击升级"
    assert len(parsed.evidence) == 2
    assert parsed.report_summaries == (
        AiReportSummary(
            source_url="https://example.com/story",
            title="俄方打击基辅附近目标",
            summary="报道提到俄方打击与复活节停火希望。",
        ),
    )


def test_parse_ai_explanation_accepts_multilingual_payload() -> None:
    parsed = parse_ai_explanation(
        json.dumps(
            {
                "main_event": "战场袭击升级",
                "summary": "俄乌关系指数下降，相关报道集中在袭击和战斗事件。",
                "evidence": ["2026-04-03：报道提到 Kyiv region strikes"],
                "report_summaries": [],
                "caveat": "这是媒体事件信号。",
                "ai_i18n": {
                    "en": {
                        "main_event": "Battle reports intensified",
                        "summary": "The relationship index fell as reports focused on fighting and strikes.",
                        "evidence": ["2026-04-03: example.com reported strikes near Kyiv."],
                        "caveat": "This is a media-event signal.",
                    },
                    "ja": {
                        "main_event": "戦闘報道が増加",
                        "summary": "戦闘と攻撃に関する報道が集中し、関係指数は低下しました。",
                        "evidence": ["2026-04-03：example.com はキーウ近郊への攻撃を報じました。"],
                        "caveat": "これはメディア上のイベント信号です。",
                    },
                },
            }
        )
    )

    assert parsed.ai_i18n["en"] == AiLocalizedExplanation(
        main_event="Battle reports intensified",
        summary="The relationship index fell as reports focused on fighting and strikes.",
        evidence=("2026-04-03: example.com reported strikes near Kyiv.",),
        caveat="This is a media-event signal.",
    )
    assert parsed.ai_i18n["ja"].main_event == "戦闘報道が増加"


def test_parse_ai_explanation_rejects_invalid_json() -> None:
    with pytest.raises(ValueError):
        parse_ai_explanation("not json")


def test_parse_ai_explanation_keeps_all_evidence_items() -> None:
    parsed = parse_ai_explanation(
        json.dumps(
            {
                "main_event": "报道线索集中",
                "summary": "相关报道线索覆盖多个来源。",
                "evidence": [
                    "2026-04-01：第一条报道线索",
                    "2026-04-02：第二条报道线索",
                    "2026-04-03：第三条报道线索",
                    "2026-04-04：第四条报道线索",
                    "2026-04-05：第五条报道线索",
                    "2026-04-06：第六条报道线索",
                ],
                "report_summaries": [],
                "caveat": "这是媒体事件信号。",
            }
        )
    )

    assert len(parsed.evidence) == 6
    assert parsed.evidence[-1] == "2026-04-06：第六条报道线索"


def test_complete_ai_explanation_fills_empty_evidence_from_reports() -> None:
    parsed = parse_ai_explanation(
        json.dumps(
            {
                "main_event": "报道线索集中",
                "summary": "相关报道线索覆盖多个来源。",
                "evidence": [],
                "report_summaries": [],
                "caveat": "这是媒体事件信号。",
            }
        )
    )

    completed = complete_ai_explanation(parsed, make_prompt_input())

    assert completed.evidence == (
        "2026-04-03：example.com 报道标题为“Russia strikes targets near Kyiv”，事件类型为战斗。",
    )


def test_deepseek_client_raises_when_key_missing() -> None:
    client = DeepSeekClient(api_key="", requester=lambda _payload, _key, _url: {})

    with pytest.raises(MissingDeepSeekKeyError):
        client.generate_explanation(make_prompt_input())


def test_truncate_error_body_compacts_and_limits_technical_body() -> None:
    body = " \n ".join(["detail"] * 80)

    truncated = truncate_error_body(body)

    assert "\n" not in truncated
    assert len(truncated) <= 203
    assert truncated.endswith("...")


def test_deepseek_client_parses_mock_response() -> None:
    def requester(_payload: dict[str, Any], _key: str, _url: str) -> dict[str, Any]:
        return {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "main_event": "战场袭击升级",
                                "summary": "俄乌关系指数下降，报道线索集中在战斗事件。",
                                "evidence": ["2026-04-03：Russia strikes targets near Kyiv"],
                                "report_summaries": [
                                    {
                                        "source_url": "https://example.com/story",
                                        "title": "俄方打击基辅附近目标",
                                        "summary": "报道显示冲突仍在延续。",
                                    }
                                ],
                                "caveat": "这是媒体事件信号，不代表确定因果。",
                            }
                        )
                    }
                }
            ]
        }

    client = DeepSeekClient(api_key="test-key", requester=requester)
    parsed = client.generate_explanation(make_prompt_input())

    assert parsed.main_event == "战场袭击升级"
    assert parsed.report_summaries[0].title == "俄方打击基辅附近目标"

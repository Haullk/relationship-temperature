from __future__ import annotations

import json
import os
from collections.abc import Callable
from dataclasses import asdict, dataclass, field, replace
from datetime import date as Date
from typing import Any, cast
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from relationship_temperature.db import load_environment

DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash"
DEFAULT_DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
MAX_API_ERROR_BODY_LENGTH = 200


class MissingDeepSeekKeyError(RuntimeError):
    pass


@dataclass(frozen=True)
class AiReportInput:
    date: Date
    source_domain: str
    source_url: str
    event_type: str
    title: str
    description: str | None


@dataclass(frozen=True)
class AiExplanationInput:
    pair_id: str
    display_name: str
    direction: str
    delta: float
    previous_date: Date
    date: Date
    change_start: Date
    change_end: Date
    drivers: tuple[str, ...]
    reports: tuple[AiReportInput, ...]


@dataclass(frozen=True)
class AiReportSummary:
    source_url: str
    title: str
    summary: str


@dataclass(frozen=True)
class AiLocalizedExplanation:
    main_event: str
    summary: str
    evidence: tuple[str, ...]
    caveat: str = ""


@dataclass(frozen=True)
class AiExplanation:
    main_event: str
    summary: str
    evidence: tuple[str, ...]
    caveat: str
    report_summaries: tuple[AiReportSummary, ...] = ()
    ai_i18n: dict[str, AiLocalizedExplanation] = field(default_factory=dict)

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)


Requester = Callable[[dict[str, Any], str, str], dict[str, Any]]


class DeepSeekClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        api_url: str | None = None,
        requester: Requester | None = None,
    ) -> None:
        load_environment()
        self.api_key = api_key if api_key is not None else os.getenv("DEEPSEEK_API_KEY")
        self.model = model if model is not None else os.getenv("DEEPSEEK_MODEL", DEFAULT_DEEPSEEK_MODEL)
        self.api_url = api_url if api_url is not None else os.getenv("DEEPSEEK_API_URL", DEFAULT_DEEPSEEK_URL)
        self.requester = requester or request_deepseek

    def generate_explanation(self, prompt_input: AiExplanationInput) -> AiExplanation:
        if not self.api_key:
            raise MissingDeepSeekKeyError("DEEPSEEK_API_KEY is not configured.")
        request_payload = build_deepseek_payload(prompt_input, self.model)
        response = self.requester(request_payload, self.api_key, self.api_url)
        content = extract_response_content(response)
        return complete_ai_explanation(parse_ai_explanation(content), prompt_input)


def build_deepseek_payload(prompt_input: AiExplanationInput, model: str) -> dict[str, Any]:
    return {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是一个谨慎的国际关系新闻事件解释助手。"
                    "只能基于用户提供的结构化事件、报道标题和描述生成解释；"
                    "不得编造外部事实，不得把媒体事件信号写成确定因果。"
                    "不要使用“近期”“近来”“近日”“最近”等相对时间词，优先使用趋势段日期或中性表述。"
                    "输出必须是 JSON。"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "task": "生成双边关系趋势段解释，并同步生成多语言版本",
                        "output_schema": {
                            "main_event": "一句话概括最可能的主线事件，不超过 32 个中文字符",
                            "summary": "2-3 句中文摘要，说明关系指数为何变化，必须使用谨慎措辞",
                            "evidence": (
                                "数组，长度应等于 input.reports 数量。为每条 input.reports 生成一条中文证据线索，"
                                "每条必须以 YYYY-MM-DD：开头，按 input.reports 原顺序输出；不得遗漏输入报道，"
                                "不得新增输入外事实"
                            ),
                            "report_summaries": (
                                "数组，长度必须等于 input.reports 数量。为每条 input.reports 生成中文 title "
                                "和中文 summary，必须覆盖每一个 input.reports.source_url，source_url 必须原样返回，"
                                "不得遗漏、改写或新增 source_url。title/summary 必须使用中文；如果标题信息不足，"
                                "也要基于来源域名、日期和事件类型给出中文报道线索，不得新增输入外事实"
                            ),
                            "caveat": "一句限制说明，强调这是媒体事件信号",
                            "ai_i18n": {
                                "en": {
                                    "main_event": "One concise English main thread, no more than 18 words",
                                    "summary": "2-3 English sentences explaining the relationship-index change cautiously",
                                    "evidence": "English evidence array, same length and order as input.reports, each item starts with YYYY-MM-DD:",
                                    "caveat": "One English caveat that this is a media-event signal",
                                },
                                "ja": {
                                    "main_event": "日本語の主線を一文で簡潔に書く",
                                    "summary": "関係指数の変化を慎重に説明する日本語 2-3 文",
                                    "evidence": "日本語の根拠配列。input.reports と同じ長さと順序。各項目は YYYY-MM-DD：で始める",
                                    "caveat": "これはメディア上のイベント信号であることを示す日本語の注意書き",
                                },
                                "ko": {
                                    "main_event": "한국어 핵심 흐름을 한 문장으로 간결하게 작성",
                                    "summary": "관계 지수 변화를 신중하게 설명하는 한국어 2-3문장",
                                    "evidence": "한국어 근거 배열. input.reports와 같은 길이와 순서. 각 항목은 YYYY-MM-DD:로 시작",
                                    "caveat": "이것이 언론 이벤트 신호임을 밝히는 한국어 주의 문구",
                                },
                                "zh-TW": {
                                    "main_event": "繁體中文主線，一句話簡潔概括",
                                    "summary": "繁體中文 2-3 句摘要，謹慎說明關係指數變化",
                                    "evidence": "繁體中文證據陣列，長度和順序與 input.reports 一致，每項以 YYYY-MM-DD：開頭",
                                    "caveat": "一句繁體中文限制說明，強調這是媒體事件信號",
                                },
                            },
                        },
                        "input": _json_ready(asdict(prompt_input)),
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    }


def request_deepseek(payload: dict[str, Any], api_key: str, api_url: str) -> dict[str, Any]:
    request = Request(
        api_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DeepSeek API {exc.code}: {truncate_error_body(body)}") from exc
    except URLError as exc:
        raise RuntimeError(f"DeepSeek API request failed: {exc.reason}") from exc
    return cast(dict[str, Any], json.loads(body))


def truncate_error_body(body: str, limit: int = MAX_API_ERROR_BODY_LENGTH) -> str:
    cleaned = " ".join(body.split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[:limit].rstrip()}..."


def extract_response_content(response: dict[str, Any]) -> str:
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("DeepSeek response does not contain choices[0].message.content.") from exc
    if not isinstance(content, str) or not content.strip():
        raise ValueError("DeepSeek response content is empty.")
    return content


def parse_ai_explanation(content: str) -> AiExplanation:
    try:
        raw = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError("DeepSeek response is not valid JSON.") from exc
    if not isinstance(raw, dict):
        raise ValueError("DeepSeek JSON response must be an object.")

    main_event = _required_text(raw, "main_event")
    summary = _required_text(raw, "summary")
    caveat = _required_text(raw, "caveat")
    evidence_value = raw.get("evidence")
    if not isinstance(evidence_value, list):
        raise ValueError("DeepSeek JSON response must include evidence as a list.")
    evidence = tuple(str(item).strip() for item in evidence_value if str(item).strip())
    return AiExplanation(
        main_event=main_event,
        summary=summary,
        evidence=evidence,
        caveat=caveat,
        report_summaries=parse_report_summaries(raw.get("report_summaries")),
        ai_i18n=parse_localized_explanations(raw.get("ai_i18n")),
    )


def complete_ai_explanation(explanation: AiExplanation, prompt_input: AiExplanationInput) -> AiExplanation:
    if explanation.evidence or not prompt_input.reports:
        return explanation
    return replace(explanation, evidence=fallback_evidence_from_reports(prompt_input.reports))


def fallback_evidence_from_reports(reports: tuple[AiReportInput, ...]) -> tuple[str, ...]:
    evidence: list[str] = []
    for report in reports:
        source = report.source_domain.strip() or "来源网站"
        title = report.title.strip() or "相关报道"
        event_type = report.event_type.strip()
        suffix = f"，事件类型为{event_type}" if event_type else ""
        evidence.append(f"{report.date.isoformat()}：{source} 报道标题为“{title}”{suffix}。")
    return tuple(evidence)


def parse_report_summaries(value: Any) -> tuple[AiReportSummary, ...]:
    if value is None:
        return ()
    if not isinstance(value, list):
        raise ValueError("DeepSeek JSON response report_summaries must be a list.")
    summaries: list[AiReportSummary] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        source_url = str(item.get("source_url") or "").strip()
        title = str(item.get("title") or "").strip()
        summary = str(item.get("summary") or "").strip()
        if source_url and title and summary:
            summaries.append(AiReportSummary(source_url=source_url, title=title, summary=summary))
    return tuple(summaries)


def parse_localized_explanations(value: Any) -> dict[str, AiLocalizedExplanation]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValueError("DeepSeek JSON response ai_i18n must be an object when present.")

    localized: dict[str, AiLocalizedExplanation] = {}
    for locale in ("en", "ja", "ko", "zh-TW"):
        item = value.get(locale)
        if not isinstance(item, dict):
            continue
        main_event = str(item.get("main_event") or "").strip()
        summary = str(item.get("summary") or "").strip()
        caveat = str(item.get("caveat") or "").strip()
        evidence_value = item.get("evidence")
        evidence = tuple(str(line).strip() for line in evidence_value if str(line).strip()) if isinstance(evidence_value, list) else ()
        if main_event and summary:
            localized[locale] = AiLocalizedExplanation(
                main_event=main_event,
                summary=summary,
                evidence=evidence,
                caveat=caveat,
            )
    return localized


def _required_text(raw: dict[str, Any], key: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"DeepSeek JSON response missing non-empty {key}.")
    return value.strip()


def _json_ready(value: Any) -> Any:
    if isinstance(value, Date):
        return value.isoformat()
    if isinstance(value, tuple):
        return [_json_ready(item) for item in value]
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_ready(item) for key, item in value.items()}
    return value

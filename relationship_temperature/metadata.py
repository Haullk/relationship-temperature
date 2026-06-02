from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from html import unescape
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

from relationship_temperature.models import MetadataStatus

FETCH_TIMEOUT_SECONDS = 5
MAX_METADATA_BYTES = 256_000
USER_AGENT = "relationship-temperature/0.1 (+https://github.com/Haullk/relationship-temperature)"


@dataclass(frozen=True)
class ReportMetadata:
    source_url: str
    status: MetadataStatus
    resolved_title: str | None = None
    meta_description: str | None = None
    canonical_url: str | None = None
    http_status: int | None = None
    error_message: str | None = None
    fetched_at: datetime | None = None


@dataclass(frozen=True)
class FetchResponse:
    body: str
    http_status: int


class MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.title_parts: list[str] = []
        self.og_title: str | None = None
        self.twitter_title: str | None = None
        self.description: str | None = None
        self.og_description: str | None = None
        self.canonical_url: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {name.lower(): (value or "").strip() for name, value in attrs}
        lowered_tag = tag.lower()
        if lowered_tag == "title":
            self.in_title = True
            return
        if lowered_tag == "meta":
            key = (attrs_dict.get("property") or attrs_dict.get("name") or "").lower()
            content = clean_text(attrs_dict.get("content") or "")
            if not content:
                return
            if key == "og:title":
                self.og_title = content
            elif key == "twitter:title":
                self.twitter_title = content
            elif key in {"description", "twitter:description"}:
                self.description = self.description or content
            elif key == "og:description":
                self.og_description = content
            return
        if lowered_tag == "link":
            rel = {part.lower() for part in re.split(r"\s+", attrs_dict.get("rel", "")) if part}
            href = clean_text(attrs_dict.get("href") or "")
            if "canonical" in rel and href:
                self.canonical_url = href

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)


def parse_html_metadata(source_url: str, html: str, *, http_status: int | None = None) -> ReportMetadata:
    parser = MetadataParser()
    try:
        parser.feed(html)
    except Exception as exc:
        return ReportMetadata(
            source_url=source_url,
            status="parse_error",
            error_message=str(exc),
            http_status=http_status,
            fetched_at=datetime.now(UTC),
        )

    title = first_present(
        parser.og_title,
        parser.twitter_title,
        clean_text(" ".join(parser.title_parts)),
        fallback_title_from_url(source_url),
    )
    description = first_present(parser.og_description, parser.description)
    return ReportMetadata(
        source_url=source_url,
        status="ready",
        resolved_title=title,
        meta_description=description,
        canonical_url=parser.canonical_url,
        http_status=http_status,
        fetched_at=datetime.now(UTC),
    )


def fetch_report_metadata(
    source_url: str,
    *,
    fetcher: Callable[[str], FetchResponse] | None = None,
) -> ReportMetadata:
    parsed = urlparse(source_url)
    if parsed.scheme not in {"http", "https"}:
        return ReportMetadata(
            source_url=source_url,
            status="unsupported_url",
            error_message="Only http and https URLs are supported.",
            fetched_at=datetime.now(UTC),
        )

    actual_fetcher = fetcher or default_fetcher
    try:
        response = actual_fetcher(source_url)
    except Exception as exc:
        return ReportMetadata(
            source_url=source_url,
            status="fetch_error",
            error_message=str(exc),
            fetched_at=datetime.now(UTC),
        )
    return parse_html_metadata(source_url, response.body, http_status=response.http_status)


def default_fetcher(source_url: str) -> FetchResponse:
    request = Request(source_url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    try:
        with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            body = response.read(MAX_METADATA_BYTES + 1)[:MAX_METADATA_BYTES]
            charset = response.headers.get_content_charset() or "utf-8"
            return FetchResponse(body=body.decode(charset, errors="replace"), http_status=int(response.status))
    except HTTPError as exc:
        body = exc.read(MAX_METADATA_BYTES + 1)[:MAX_METADATA_BYTES]
        charset = exc.headers.get_content_charset() or "utf-8"
        return FetchResponse(body=body.decode(charset, errors="replace"), http_status=int(exc.code))
    except URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc


def first_present(*values: str | None) -> str | None:
    for value in values:
        cleaned = clean_text(value or "")
        if cleaned:
            return cleaned
    return None


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(value)).strip()


def fallback_title_from_url(source_url: str) -> str:
    parsed = urlparse(source_url)
    tail = unquote(parsed.path.rstrip("/").split("/")[-1])
    cleaned = re.sub(r"[-_]+", " ", tail)
    cleaned = re.sub(r"\.[a-zA-Z0-9]{2,5}$", "", cleaned)
    words = [word for word in re.split(r"\s+", cleaned) if word and not word.isdigit()]
    if len(words) < 3:
        return parsed.netloc or "来源链接"
    return " ".join(words[:14])

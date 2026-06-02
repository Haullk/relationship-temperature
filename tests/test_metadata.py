from __future__ import annotations

from relationship_temperature.metadata import FetchResponse, fetch_report_metadata, parse_html_metadata


def test_parse_html_metadata_prefers_og_title() -> None:
    html = """
    <html>
      <head>
        <title>Plain title</title>
        <meta property="og:title" content="OG Title">
        <meta name="description" content="Short description">
        <link rel="canonical" href="https://example.com/canonical">
      </head>
    </html>
    """

    metadata = parse_html_metadata("https://example.com/news/story", html, http_status=200)

    assert metadata.status == "ready"
    assert metadata.resolved_title == "OG Title"
    assert metadata.meta_description == "Short description"
    assert metadata.canonical_url == "https://example.com/canonical"
    assert metadata.http_status == 200


def test_parse_html_metadata_falls_back_to_url_slug() -> None:
    metadata = parse_html_metadata(
        "https://example.com/world/ukraine-russia-war-live-123.html",
        "<html><head></head><body>No metadata</body></html>",
    )

    assert metadata.resolved_title == "ukraine russia war live"


def test_fetch_report_metadata_skips_non_http_urls() -> None:
    metadata = fetch_report_metadata("ftp://example.com/story")

    assert metadata.status == "unsupported_url"


def test_fetch_report_metadata_records_fetch_errors() -> None:
    def failing_fetcher(_url: str) -> FetchResponse:
        raise RuntimeError("timeout")

    metadata = fetch_report_metadata("https://example.com/story", fetcher=failing_fetcher)

    assert metadata.status == "fetch_error"
    assert metadata.error_message == "timeout"


def test_fetch_report_metadata_limits_body_to_parser_input() -> None:
    def large_fetcher(_url: str) -> FetchResponse:
        return FetchResponse(
            body="<title>Limited Title</title>" + ("x" * 300_000),
            http_status=200,
        )

    metadata = fetch_report_metadata("https://example.com/story", fetcher=large_fetcher)

    assert metadata.status == "ready"
    assert metadata.resolved_title == "Limited Title"

from __future__ import annotations

import csv
import math
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

import psycopg
from psycopg.rows import dict_row


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"
DAILY_CSV_PATH = ARTIFACTS_DIR / "bilateral_relationships_2026_daily.csv"
REPORT_PATH = ARTIFACTS_DIR / "turning_points_report.md"

ROLLING_COMPARE_DAYS = 7
EXPLANATION_WINDOW_DAYS = 7
MAX_TURNING_POINTS_PER_SERIES = 3
MAX_REPORTS_PER_TURNING_POINT = 6

SERIES_ORDER = [
    "China-USA",
    "China-Russia",
    "USA-Russia",
    "Overall with China",
    "Overall with USA",
]

ROOT_LABELS = {
    "01": "公开声明",
    "02": "呼吁/倡议",
    "03": "表达合作意向",
    "04": "磋商/外交接触",
    "05": "外交合作",
    "06": "物质合作",
    "07": "援助",
    "08": "让步/妥协",
    "09": "调查",
    "10": "要求",
    "11": "反对/批评",
    "12": "拒绝",
    "13": "威胁",
    "14": "抗议",
    "15": "军事姿态",
    "16": "关系降级",
    "17": "胁迫",
    "18": "攻击",
    "19": "战斗",
    "20": "非常规暴力",
}

QUAD_LABELS = {
    1: "口头合作",
    2: "实质合作",
    3: "口头冲突",
    4: "实质冲突",
}

COUNTRY_TEXT_PATTERNS = {
    "CHN": r"(china|chinese|beijing|xi jinping|huawei|taiwan)",
    "USA": r"(united states|u[.]s[.]|\\bus\\b|usa|american|washington|trump|nvidia)",
    "RUS": r"(russia|russian|moscow|putin|kremlin)",
}


@dataclass(frozen=True)
class DailyPoint:
    series: str
    event_date: date
    avg_goldstein: float
    rolling_goldstein: float
    event_count: int


@dataclass(frozen=True)
class TurningPoint:
    series: str
    event_date: date
    previous_date: date
    previous_score: float
    score: float
    delta: float

    @property
    def direction(self) -> str:
        return "up" if self.delta >= 0 else "down"

    @property
    def direction_label(self) -> str:
        return "上行" if self.direction == "up" else "下行"


def load_environment() -> None:
    for env_name in (".env", ".env.local"):
        env_path = PROJECT_ROOT / env_name
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def database_url() -> str:
    load_environment()
    url = os.getenv("GDELT_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Set GDELT_DATABASE_URL or DATABASE_URL in .env.local before running this script.")
    return url


def connect() -> psycopg.Connection:
    return psycopg.connect(database_url(), row_factory=dict_row)


def load_daily_points() -> list[DailyPoint]:
    if not DAILY_CSV_PATH.exists():
        raise RuntimeError(f"Missing {DAILY_CSV_PATH}. Run scripts/plot_bilateral_relationships.py first.")

    points: list[DailyPoint] = []
    with DAILY_CSV_PATH.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            points.append(
                DailyPoint(
                    series=row["series"],
                    event_date=date.fromisoformat(row["date"]),
                    avg_goldstein=float(row["avg_goldstein"]),
                    rolling_goldstein=float(row["rolling_7d_goldstein"]),
                    event_count=int(row["event_count"]),
                )
            )
    return points


def detect_turning_points(points: list[DailyPoint]) -> list[TurningPoint]:
    by_series: dict[str, list[DailyPoint]] = {}
    for point in points:
        by_series.setdefault(point.series, []).append(point)

    selected: list[TurningPoint] = []
    for series in SERIES_ORDER:
        series_points = sorted(by_series.get(series, []), key=lambda point: point.event_date)
        candidates: list[TurningPoint] = []
        for index in range(ROLLING_COMPARE_DAYS, len(series_points)):
            current = series_points[index]
            previous = series_points[index - ROLLING_COMPARE_DAYS]
            delta = current.rolling_goldstein - previous.rolling_goldstein
            candidates.append(
                TurningPoint(
                    series=series,
                    event_date=current.event_date,
                    previous_date=previous.event_date,
                    previous_score=previous.rolling_goldstein,
                    score=current.rolling_goldstein,
                    delta=delta,
                )
            )

        picks: list[TurningPoint] = []
        for candidate in sorted(candidates, key=lambda item: abs(item.delta), reverse=True):
            if all(abs((candidate.event_date - existing.event_date).days) >= 10 for existing in picks):
                picks.append(candidate)
            if len(picks) == MAX_TURNING_POINTS_PER_SERIES:
                break
        selected.extend(sorted(picks, key=lambda item: item.event_date))
    return selected


def series_filter_sql(series: str) -> tuple[str, tuple[str, ...]]:
    if series == "China-USA":
        return pair_filter("CHN", "USA")
    if series == "China-Russia":
        return pair_filter("CHN", "RUS")
    if series == "USA-Russia":
        return pair_filter("USA", "RUS")
    if series == "Overall with China":
        return overall_filter("CHN")
    if series == "Overall with USA":
        return overall_filter("USA")
    raise ValueError(f"Unknown series: {series}")


def series_relevance_sql(series: str) -> tuple[str, tuple[str, ...]]:
    text_expr = "lower(concat_ws(' ', actor1_name, actor2_name, source_domain, source_url))"
    return relevance_sql_for_expr(series, text_expr)


def series_source_relevance_sql(series: str) -> tuple[str, tuple[str, ...]]:
    text_expr = "lower(concat_ws(' ', source_domain, source_url))"
    return relevance_sql_for_expr(series, text_expr)


def relevance_sql_for_expr(series: str, text_expr: str) -> tuple[str, tuple[str, ...]]:
    if series == "China-USA":
        return (f"{text_expr} ~ %s and {text_expr} ~ %s", (COUNTRY_TEXT_PATTERNS["CHN"], COUNTRY_TEXT_PATTERNS["USA"]))
    if series == "China-Russia":
        return (f"{text_expr} ~ %s and {text_expr} ~ %s", (COUNTRY_TEXT_PATTERNS["CHN"], COUNTRY_TEXT_PATTERNS["RUS"]))
    if series == "USA-Russia":
        return (f"{text_expr} ~ %s and {text_expr} ~ %s", (COUNTRY_TEXT_PATTERNS["USA"], COUNTRY_TEXT_PATTERNS["RUS"]))
    if series == "Overall with China":
        return (f"{text_expr} ~ %s", (COUNTRY_TEXT_PATTERNS["CHN"],))
    if series == "Overall with USA":
        return (f"{text_expr} ~ %s", (COUNTRY_TEXT_PATTERNS["USA"],))
    raise ValueError(f"Unknown series: {series}")


def pair_filter(country_a: str, country_b: str) -> tuple[str, tuple[str, ...]]:
    return (
        """
        (
          (actor1_country_code = %s and actor2_country_code = %s)
          or (actor1_country_code = %s and actor2_country_code = %s)
        )
        """,
        (country_a, country_b, country_b, country_a),
    )


def overall_filter(country: str) -> tuple[str, tuple[str, ...]]:
    return ("(actor1_country_code = %s or actor2_country_code = %s)", (country, country))


def explanation_windows(turning_point: TurningPoint) -> tuple[date, date, date, date]:
    post_end = turning_point.event_date
    post_start = post_end - timedelta(days=EXPLANATION_WINDOW_DAYS - 1)
    pre_end = post_start - timedelta(days=1)
    pre_start = pre_end - timedelta(days=EXPLANATION_WINDOW_DAYS - 1)
    return pre_start, pre_end, post_start, post_end


def load_root_breakdown(conn: psycopg.Connection, turning_point: TurningPoint) -> list[dict[str, object]]:
    condition, params = series_filter_sql(turning_point.series)
    relevance_condition, relevance_params = series_relevance_sql(turning_point.series)
    pre_start, pre_end, post_start, post_end = explanation_windows(turning_point)
    sql = f"""
        with windowed as (
          select
            case
              when event_date between %s and %s then 'pre'
              when event_date between %s and %s then 'post'
            end as window_name,
            event_root_code,
            channel,
            quad_class,
            goldstein_scale::float as goldstein_scale,
            greatest(num_mentions, 0) as num_mentions
          from gdelt_events_clean
          where event_date between %s and %s
            and goldstein_scale is not null
            and actor1_country_code is not null
            and actor2_country_code is not null
            and actor1_country_code <> actor2_country_code
            and {condition}
            and {relevance_condition}
        )
        select
          window_name,
          coalesce(event_root_code, '??') as event_root_code,
          coalesce(channel, '未知') as channel,
          quad_class,
          count(*) as event_count,
          avg(goldstein_scale) as avg_goldstein,
          sum(num_mentions) as mentions
        from windowed
        where window_name is not null
        group by 1, 2, 3, 4
        order by window_name, event_count desc;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (pre_start, pre_end, post_start, post_end, pre_start, post_end, *params, *relevance_params))
        return [dict(row) for row in cur.fetchall()]


def load_key_reports(conn: psycopg.Connection, turning_point: TurningPoint) -> list[dict[str, object]]:
    condition, params = series_filter_sql(turning_point.series)
    relevance_condition, relevance_params = series_source_relevance_sql(turning_point.series)
    _pre_start, _pre_end, post_start, post_end = explanation_windows(turning_point)
    direction_score = "greatest(goldstein_scale::float, 0)" if turning_point.direction == "up" else "greatest(-goldstein_scale::float, 0)"
    sql = f"""
        select distinct on (source_url)
          event_date,
          actor1_name,
          actor1_country_code,
          actor2_name,
          actor2_country_code,
          event_code,
          event_root_code,
          channel,
          quad_class,
          goldstein_scale::float as goldstein_scale,
          num_mentions,
          num_articles,
          avg_tone::float as avg_tone,
          source_domain,
          source_url,
          ({direction_score} * ln(greatest(num_mentions, 1) + 1)) as impact_score
        from gdelt_events_clean
        where event_date between %s and %s
          and goldstein_scale is not null
          and source_url is not null
          and source_url <> ''
          and actor1_country_code is not null
          and actor2_country_code is not null
          and actor1_country_code <> actor2_country_code
          and {condition}
          and {relevance_condition}
        order by source_url, impact_score desc, num_mentions desc, num_articles desc
    """
    outer_sql = f"""
        select *
        from ({sql}) ranked
        where impact_score > 0
        order by impact_score desc, num_mentions desc, num_articles desc
        limit %s
    """
    with conn.cursor() as cur:
        cur.execute(outer_sql, (post_start, post_end, *params, *relevance_params, MAX_REPORTS_PER_TURNING_POINT))
        return [dict(row) for row in cur.fetchall()]


def summarize_root_changes(rows: list[dict[str, object]], direction: str) -> list[str]:
    pre: dict[tuple[str, int | None], dict[str, float]] = {}
    post: dict[tuple[str, int | None], dict[str, float]] = {}

    for row in rows:
        key = (str(row["event_root_code"]), row["quad_class"])
        target = post if row["window_name"] == "post" else pre
        target[key] = {
            "count": float(row["event_count"]),
            "avg": float(row["avg_goldstein"]),
            "mentions": float(row["mentions"] or 0),
        }

    scored: list[tuple[float, str]] = []
    for key, post_item in post.items():
        pre_item = pre.get(key, {"count": 0, "avg": 0, "mentions": 0})
        root_code, quad_class = key
        count_delta = post_item["count"] - pre_item["count"]
        mentions_delta = post_item["mentions"] - pre_item["mentions"]
        directional_avg = post_item["avg"] if direction == "up" else -post_item["avg"]
        score = directional_avg * math.log1p(max(post_item["count"], 0)) + 0.08 * math.log1p(max(mentions_delta, 0))
        label = ROOT_LABELS.get(root_code, f"CAMEO {root_code}")
        quad = QUAD_LABELS.get(quad_class or 0, "未分类")
        sentence = (
            f"{label}（{quad}）在后窗有 {int(post_item['count'])} 条事件，"
            f"均值 {post_item['avg']:+.2f}，较前窗 {count_delta:+.0f} 条，提及量变化 {mentions_delta:+.0f}。"
        )
        scored.append((score, sentence))

    return [sentence for _score, sentence in sorted(scored, key=lambda item: item[0], reverse=True)[:3]]


def title_hint(url: str) -> str:
    parsed = urlparse(url)
    path_parts = [part for part in parsed.path.split("/") if part]
    if not path_parts:
        return parsed.netloc or url
    slug = unquote(path_parts[-1]).split("?")[0]
    slug = slug.rsplit(".", 1)[0]
    words = [word for word in slug.replace("_", "-").split("-") if word]
    if not words:
        return parsed.netloc or url
    return " ".join(words[:14])


def markdown_link(label: str, url: str) -> str:
    escaped_label = label.replace("[", "\\[").replace("]", "\\]")
    escaped_url = url.replace(")", "%29")
    return f"[{escaped_label}]({escaped_url})"


def render_report(turning_points: list[TurningPoint]) -> str:
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# 双边关系趋势转折点归因原型",
        "",
        f"生成时间：{generated_at}",
        "",
        "口径：从关系曲线的 7 日滚动 Goldstein 均值中寻找 7 日变化幅度最大的转折点；再对转折日前 7 天和后 7 天的 GDELT 事件构成做对比，并列出后窗中方向性最强、提及量较高的来源链接。",
        "",
        "注意：这是媒体事件信号归因，不是严格因果证明。解释层额外要求 actor/source URL 文本中出现相关国家关键词，以降低 GDELT 地名和实体误判噪音；重点报道进一步要求来源链接本身出现国家关键词。现有库没有新闻标题和正文摘要，重点报道使用 GDELT 事件来源 URL 与 URL slug 作为标题线索。",
        "",
    ]

    with connect() as conn:
        for series in SERIES_ORDER:
            series_turning_points = [point for point in turning_points if point.series == series]
            if not series_turning_points:
                continue
            lines.extend([f"## {series}", ""])
            for point in series_turning_points:
                pre_start, pre_end, post_start, post_end = explanation_windows(point)
                root_rows = load_root_breakdown(conn, point)
                reports = load_key_reports(conn, point)
                lines.extend(
                    [
                        (
                            f"### {point.event_date.isoformat()} {point.direction_label} "
                            f"({point.previous_score:+.2f} -> {point.score:+.2f}, 7日变化 {point.delta:+.2f})"
                        ),
                        "",
                        f"对比窗口：前窗 {pre_start.isoformat()} 至 {pre_end.isoformat()}；后窗 {post_start.isoformat()} 至 {post_end.isoformat()}。",
                        "",
                        "可能驱动事件类型：",
                        "",
                    ]
                )
                for sentence in summarize_root_changes(root_rows, point.direction):
                    lines.append(f"- {sentence}")
                if not root_rows:
                    lines.append("- 该窗口没有可归因事件。")
                lines.extend(["", "重点报道/来源链接：", ""])
                if reports:
                    lines.append("| 日期 | 来源 | 事件 | 方向分 | 提及 | 链接 |")
                    lines.append("|---|---|---|---:|---:|---|")
                    for report in reports:
                        root = str(report["event_root_code"] or "??")
                        root_label = ROOT_LABELS.get(root, f"CAMEO {root}")
                        actors = f"{report['actor1_name'] or report['actor1_country_code']} -> {report['actor2_name'] or report['actor2_country_code']}"
                        event_label = f"{root_label}; {actors}"
                        url = str(report["source_url"])
                        source = str(report["source_domain"] or urlparse(url).netloc or "source")
                        lines.append(
                            "| "
                            f"{report['event_date']} | "
                            f"{source} | "
                            f"{event_label} | "
                            f"{float(report['goldstein_scale']):+.1f} | "
                            f"{int(report['num_mentions'] or 0)} | "
                            f"{markdown_link(title_hint(url), url)} |"
                        )
                else:
                    lines.append("该窗口没有可展示的来源链接。")
                lines.append("")
    return "\n".join(lines)


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    points = load_daily_points()
    turning_points = detect_turning_points(points)
    REPORT_PATH.write_text(render_report(turning_points), encoding="utf-8")
    print(f"Wrote {REPORT_PATH}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
import os
import shutil
import subprocess
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import psycopg
from psycopg.rows import dict_row


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "artifacts"
CSV_PATH = OUTPUT_DIR / "bilateral_relationships_2026_daily.csv"
SVG_PATH = OUTPUT_DIR / "bilateral_relationships_2026.svg"
PNG_PATH = OUTPUT_DIR / "bilateral_relationships_2026.png"

SERIES_ORDER = [
    "China-USA",
    "China-Russia",
    "USA-Russia",
    "Overall with China",
    "Overall with USA",
]

SERIES_COLORS = {
    "China-USA": "#24327f",
    "China-Russia": "#b24d54",
    "USA-Russia": "#527a4e",
    "Overall with China": "#5a365f",
    "Overall with USA": "#d8bf5b",
}

SERIES_SQL = """
with series as (
  select event_date, 'China-USA' as series, goldstein_scale::float as score
  from gdelt_events_clean
  where goldstein_scale is not null
    and actor1_country_code is not null
    and actor2_country_code is not null
    and actor1_country_code <> actor2_country_code
    and (
      (actor1_country_code = 'CHN' and actor2_country_code = 'USA')
      or (actor1_country_code = 'USA' and actor2_country_code = 'CHN')
    )
  union all
  select event_date, 'China-Russia' as series, goldstein_scale::float as score
  from gdelt_events_clean
  where goldstein_scale is not null
    and actor1_country_code is not null
    and actor2_country_code is not null
    and actor1_country_code <> actor2_country_code
    and (
      (actor1_country_code = 'CHN' and actor2_country_code = 'RUS')
      or (actor1_country_code = 'RUS' and actor2_country_code = 'CHN')
    )
  union all
  select event_date, 'USA-Russia' as series, goldstein_scale::float as score
  from gdelt_events_clean
  where goldstein_scale is not null
    and actor1_country_code is not null
    and actor2_country_code is not null
    and actor1_country_code <> actor2_country_code
    and (
      (actor1_country_code = 'USA' and actor2_country_code = 'RUS')
      or (actor1_country_code = 'RUS' and actor2_country_code = 'USA')
    )
  union all
  select event_date, 'Overall with China' as series, goldstein_scale::float as score
  from gdelt_events_clean
  where goldstein_scale is not null
    and actor1_country_code is not null
    and actor2_country_code is not null
    and actor1_country_code <> actor2_country_code
    and (actor1_country_code = 'CHN' or actor2_country_code = 'CHN')
  union all
  select event_date, 'Overall with USA' as series, goldstein_scale::float as score
  from gdelt_events_clean
  where goldstein_scale is not null
    and actor1_country_code is not null
    and actor2_country_code is not null
    and actor1_country_code <> actor2_country_code
    and (actor1_country_code = 'USA' or actor2_country_code = 'USA')
)
select series, event_date, avg(score) as avg_goldstein, count(*) as event_count
from series
group by 1, 2
order by 1, 2;
"""


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
    return psycopg.connect(database_url())


@dataclass(frozen=True)
class DailyPoint:
    series: str
    event_date: date
    avg_goldstein: float
    event_count: int


def load_daily_points() -> list[DailyPoint]:
    with connect() as conn:
        conn.row_factory = dict_row
        with conn.cursor() as cur:
            cur.execute(SERIES_SQL)
            return [
                DailyPoint(
                    series=row["series"],
                    event_date=row["event_date"],
                    avg_goldstein=float(row["avg_goldstein"]),
                    event_count=int(row["event_count"]),
                )
                for row in cur.fetchall()
            ]


def rolling_average(points: list[DailyPoint], window: int = 7) -> dict[tuple[str, date], float]:
    by_series: dict[str, list[DailyPoint]] = {}
    for point in points:
        by_series.setdefault(point.series, []).append(point)

    rolled: dict[tuple[str, date], float] = {}
    for series_points in by_series.values():
        values: list[float] = []
        for point in series_points:
            values.append(point.avg_goldstein)
            window_values = values[-window:]
            rolled[(point.series, point.event_date)] = sum(window_values) / len(window_values)
    return rolled


def write_csv(points: list[DailyPoint], rolled: dict[tuple[str, date], float]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["series", "date", "avg_goldstein", "rolling_7d_goldstein", "event_count"])
        for point in points:
            writer.writerow(
                [
                    point.series,
                    point.event_date.isoformat(),
                    f"{point.avg_goldstein:.6f}",
                    f"{rolled[(point.series, point.event_date)]:.6f}",
                    point.event_count,
                ]
            )


def svg_escape(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def polyline(points: list[tuple[float, float]]) -> str:
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in points)


def render_svg(points: list[DailyPoint], rolled: dict[tuple[str, date], float]) -> None:
    width, height = 1280, 760
    left, right, top, bottom = 96, 270, 92, 116
    plot_w = width - left - right
    plot_h = height - top - bottom

    all_dates = sorted({point.event_date for point in points})
    if not all_dates:
        raise RuntimeError("No GDELT points found for the configured database.")
    min_date, max_date = all_dates[0], all_dates[-1]
    date_span = max((max_date - min_date).days, 1)

    plotted_values = [rolled[(point.series, point.event_date)] for point in points]
    y_min = min(plotted_values)
    y_max = max(plotted_values)
    y_pad = max((y_max - y_min) * 0.16, 0.25)
    y_min = round((y_min - y_pad) * 2) / 2
    y_max = round((y_max + y_pad) * 2) / 2
    if y_min == y_max:
        y_min -= 1
        y_max += 1

    def x_for(day: date) -> float:
        return left + ((day - min_date).days / date_span) * plot_w

    def y_for(value: float) -> float:
        return top + (y_max - value) / (y_max - y_min) * plot_h

    y_ticks: list[float] = []
    tick = y_min
    while tick <= y_max + 0.001:
        y_ticks.append(round(tick, 2))
        tick += 0.5

    month_ticks: list[date] = []
    seen_months: set[tuple[int, int]] = set()
    for day in all_dates:
        key = (day.year, day.month)
        if key not in seen_months:
            seen_months.add(key)
            month_ticks.append(day)

    by_series: dict[str, list[DailyPoint]] = {}
    for point in points:
        by_series.setdefault(point.series, []).append(point)

    lines: list[str] = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="760" viewBox="0 0 1280 760">',
        "<rect width=\"1280\" height=\"760\" fill=\"#fbfaf7\"/>",
        "<style>",
        "text{font-family:Inter,Arial,'Helvetica Neue',sans-serif;fill:#2b2b2b}",
        ".title{font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:700}",
        ".subtitle{font-size:16px;fill:#5f646b}",
        ".axis{stroke:#2b2b2b;stroke-width:1.2}",
        ".grid{stroke:#dedbd2;stroke-width:1}",
        ".tick{font-size:13px;fill:#555}",
        ".label{font-size:18px;font-weight:600}",
        ".note{font-size:13px;fill:#666}",
        "</style>",
        f"<text class=\"title\" x=\"{width / 2}\" y=\"48\" text-anchor=\"middle\">Bilateral Relationship Signals ({min_date.year})</text>",
        (
            f"<text class=\"subtitle\" x=\"{width / 2}\" y=\"75\" text-anchor=\"middle\">"
            f"GDELT Events in local MapNews database, {min_date.isoformat()} to {max_date.isoformat()}, 7-day rolling average of daily GoldsteinScale"
            "</text>"
        ),
    ]

    for value in y_ticks:
        y = y_for(value)
        lines.append(f"<line class=\"grid\" x1=\"{left}\" y1=\"{y:.1f}\" x2=\"{width - right}\" y2=\"{y:.1f}\"/>")
        lines.append(f"<text class=\"tick\" x=\"{left - 14}\" y=\"{y + 4:.1f}\" text-anchor=\"end\">{value:.1f}</text>")

    for day in month_ticks:
        x = x_for(day)
        lines.append(f"<line class=\"grid\" x1=\"{x:.1f}\" y1=\"{top}\" x2=\"{x:.1f}\" y2=\"{height - bottom}\"/>")
        lines.append(
            f"<text class=\"tick\" x=\"{x:.1f}\" y=\"{height - bottom + 28}\" text-anchor=\"middle\">"
            f"{day.strftime('%b %d')}"
            "</text>"
        )

    lines.append(f"<line class=\"axis\" x1=\"{left}\" y1=\"{height - bottom}\" x2=\"{width - right}\" y2=\"{height - bottom}\"/>")
    lines.append(f"<line class=\"axis\" x1=\"{left}\" y1=\"{top}\" x2=\"{left}\" y2=\"{height - bottom}\"/>")
    lines.append(
        f"<text class=\"label\" transform=\"translate(32,{top + plot_h / 2:.1f}) rotate(-90)\" text-anchor=\"middle\">"
        "Relationship Score"
        "</text>"
    )
    lines.append(f"<text class=\"label\" x=\"{left + plot_w / 2:.1f}\" y=\"{height - 36}\" text-anchor=\"middle\">Date</text>")

    label_entries: list[dict[str, float | int | str]] = []
    for series in SERIES_ORDER:
        series_points = by_series.get(series, [])
        if not series_points:
            continue
        line_points = [(x_for(point.event_date), y_for(rolled[(series, point.event_date)])) for point in series_points]
        color = SERIES_COLORS[series]
        lines.append(
            f"<polyline points=\"{polyline(line_points)}\" fill=\"none\" stroke=\"{color}\" "
            "stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
        )

        last = series_points[-1]
        last_x = x_for(last.event_date)
        last_y = y_for(rolled[(series, last.event_date)])
        total_events = sum(point.event_count for point in series_points)
        lines.append(f"<circle cx=\"{last_x:.1f}\" cy=\"{last_y:.1f}\" r=\"4\" fill=\"{color}\"/>")
        label_entries.append(
            {
                "series": series,
                "x": last_x,
                "y": last_y,
                "color": color,
                "total_events": total_events,
            }
        )

    label_entries.sort(key=lambda item: float(item["y"]))
    min_label_gap = 22
    min_label_y = top + 18
    max_label_y = height - bottom - 18
    for entry in label_entries:
        entry["label_y"] = float(entry["y"])
    for index in range(1, len(label_entries)):
        previous = float(label_entries[index - 1]["label_y"])
        current = float(label_entries[index]["label_y"])
        if current - previous < min_label_gap:
            label_entries[index]["label_y"] = previous + min_label_gap
    overflow = float(label_entries[-1]["label_y"]) - max_label_y if label_entries else 0
    if overflow > 0:
        for entry in label_entries:
            entry["label_y"] = float(entry["label_y"]) - overflow
    for index in range(len(label_entries) - 2, -1, -1):
        following = float(label_entries[index + 1]["label_y"])
        current = float(label_entries[index]["label_y"])
        if following - current < min_label_gap:
            label_entries[index]["label_y"] = following - min_label_gap
    if label_entries and float(label_entries[0]["label_y"]) < min_label_y:
        shift = min_label_y - float(label_entries[0]["label_y"])
        for entry in label_entries:
            entry["label_y"] = float(entry["label_y"]) + shift

    for entry in label_entries:
        series = str(entry["series"])
        color = str(entry["color"])
        point_x = float(entry["x"])
        point_y = float(entry["y"])
        label_y = float(entry["label_y"])
        label_x = point_x + 12
        total_events = int(entry["total_events"])
        if abs(label_y - point_y) > 1:
            lines.append(
                f"<line x1=\"{point_x + 6:.1f}\" y1=\"{point_y:.1f}\" "
                f"x2=\"{label_x - 4:.1f}\" y2=\"{label_y - 5:.1f}\" "
                f"stroke=\"{color}\" stroke-width=\"1.2\" opacity=\"0.55\"/>"
            )
        lines.append(
            f"<text x=\"{label_x:.1f}\" y=\"{label_y + 5:.1f}\" font-size=\"16\" fill=\"{color}\">"
            f"{svg_escape(series)} ({total_events:,})"
            "</text>"
        )

    legend_x, legend_y = left + 12, height - bottom - 92
    lines.append(
        f"<rect x=\"{legend_x}\" y=\"{legend_y}\" width=\"430\" height=\"74\" fill=\"#fbfaf7\" "
        "stroke=\"#d6d1c7\" stroke-width=\"1\"/>"
    )
    lines.append(
        f"<text class=\"note\" x=\"{legend_x + 14}\" y=\"{legend_y + 23}\">"
        "Score = daily average GoldsteinScale for cross-country dyadic GDELT events."
        "</text>"
    )
    lines.append(
        f"<text class=\"note\" x=\"{legend_x + 14}\" y=\"{legend_y + 45}\">"
        "Positive values lean cooperative; negative values lean conflictual."
        "</text>"
    )
    lines.append(
        f"<text class=\"note\" x=\"{legend_x + 14}\" y=\"{legend_y + 67}\">"
        "Clean table keeps geocoded events; this is a media-event signal, not a diplomatic index."
        "</text>"
    )

    lines.append("</svg>")
    SVG_PATH.write_text("\n".join(lines), encoding="utf-8")


def write_png_preview() -> None:
    sips = shutil.which("sips")
    if not sips:
        return
    subprocess.run(
        [sips, "-s", "format", "png", str(SVG_PATH), "--out", str(PNG_PATH)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    points = load_daily_points()
    rolled = rolling_average(points)
    write_csv(points, rolled)
    render_svg(points, rolled)
    write_png_preview()
    print(f"Wrote {CSV_PATH}")
    print(f"Wrote {SVG_PATH}")
    if PNG_PATH.exists():
        print(f"Wrote {PNG_PATH}")


if __name__ == "__main__":
    main()

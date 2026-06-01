from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Protocol

from relationship_temperature.config import CandidatePool, split_pair_id
from relationship_temperature.models import StandardizedEvent


class CursorContext(Protocol):
    def __enter__(self) -> Any: ...
    def __exit__(self, exc_type: object, exc: object, traceback: object) -> object: ...


class ConnectionLike(Protocol):
    def cursor(self) -> CursorContext: ...


@dataclass(frozen=True)
class PairQuery:
    sql: str
    params: tuple[object, ...]
    object_a: str
    object_b: str


def build_pair_query(pool: CandidatePool, pair_id: str, start_date: date, end_date: date) -> PairQuery:
    object_a, object_b = split_pair_id(pair_id)
    codes_a = pool.objects[object_a].gdelt_codes
    codes_b = pool.objects[object_b].gdelt_codes
    sql = """
    select
      event_date,
      actor1_country_code,
      actor2_country_code,
      goldstein_scale::float as goldstein_scale,
      greatest(coalesce(num_mentions, 0), 0) as num_mentions,
      greatest(coalesce(num_articles, 0), 0) as num_articles,
      event_code,
      event_root_code,
      quad_class,
      actor1_name,
      actor2_name,
      source_domain,
      source_url
    from gdelt_events_clean
    where event_date between %s and %s
      and goldstein_scale is not null
      and actor1_country_code is not null
      and actor2_country_code is not null
      and (
        (actor1_country_code = any(%s::text[]) and actor2_country_code = any(%s::text[]))
        or
        (actor1_country_code = any(%s::text[]) and actor2_country_code = any(%s::text[]))
      )
    order by event_date asc
    """
    return PairQuery(
        sql,
        (start_date, end_date, list(codes_a), list(codes_b), list(codes_b), list(codes_a)),
        object_a,
        object_b,
    )


def load_events(
    conn: ConnectionLike,
    pool: CandidatePool,
    pair_id: str,
    *,
    end_date: date | None = None,
    days: int = 90,
) -> list[StandardizedEvent]:
    actual_end = end_date or date.today()
    start_date = actual_end - timedelta(days=days - 1)
    query = build_pair_query(pool, pair_id, start_date, actual_end)
    with conn.cursor() as cur:
        cur.execute(query.sql, query.params)
        rows = cur.fetchall()
    return standardize_rows(rows, pair_id, query.object_a, query.object_b)


def load_events_for_all_pairs(
    conn: ConnectionLike,
    pool: CandidatePool,
    *,
    end_date: date | None = None,
    days: int = 90,
) -> dict[str, list[StandardizedEvent]]:
    actual_end = end_date or load_max_event_date(conn)
    start_date = actual_end - timedelta(days=days - 1)
    codes = sorted({code for candidate in pool.objects.values() for code in candidate.gdelt_codes})
    sql = """
    select
      event_date,
      actor1_country_code,
      actor2_country_code,
      goldstein_scale::float as goldstein_scale,
      greatest(coalesce(num_mentions, 0), 0) as num_mentions,
      greatest(coalesce(num_articles, 0), 0) as num_articles,
      event_code,
      event_root_code,
      quad_class,
      actor1_name,
      actor2_name,
      source_domain,
      source_url
    from gdelt_events_clean
    where event_date between %s and %s
      and goldstein_scale is not null
      and actor1_country_code = any(%s::text[])
      and actor2_country_code = any(%s::text[])
      and actor1_country_code <> actor2_country_code
    order by event_date asc
    """
    with conn.cursor() as cur:
        cur.execute(sql, (start_date, actual_end, codes, codes))
        rows = cur.fetchall()
    return standardize_rows_for_all_pairs(rows, pool)


def load_max_event_date(conn: ConnectionLike) -> date:
    with conn.cursor() as cur:
        cur.execute("select max(event_date) as max_date from gdelt_events_clean where event_date is not null")
        row = cur.fetchall()[0]
    value = row["max_date"]
    if value is None:
        raise RuntimeError("gdelt_events_clean has no event_date values.")
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def standardize_rows_for_all_pairs(
    rows: Sequence[Mapping[str, Any]],
    pool: CandidatePool,
) -> dict[str, list[StandardizedEvent]]:
    code_to_objects: dict[str, list[str]] = {}
    for object_id, candidate in pool.objects.items():
        for code in candidate.gdelt_codes:
            code_to_objects.setdefault(code, []).append(object_id)

    by_pair: dict[str, list[StandardizedEvent]] = {pair_id: [] for pair_id in pool.legal_pair_ids}
    for row in rows:
        actor1_code = str(row.get("actor1_country_code") or "")
        actor2_code = str(row.get("actor2_country_code") or "")
        for object_a in code_to_objects.get(actor1_code, []):
            for object_b in code_to_objects.get(actor2_code, []):
                if object_a == object_b:
                    continue
                pair_id = "_".join(sorted((object_a, object_b)))
                if pair_id not in by_pair:
                    continue
                event = standardize_row(row, pair_id, *split_pair_id(pair_id))
                if event is not None:
                    by_pair[pair_id].append(event)
    return by_pair


def standardize_rows(
    rows: Sequence[Mapping[str, Any]],
    pair_id: str,
    object_a: str,
    object_b: str,
) -> list[StandardizedEvent]:
    events: list[StandardizedEvent] = []
    for row in rows:
        event = standardize_row(row, pair_id, object_a, object_b)
        if event is not None:
            events.append(event)
    return events


def standardize_row(
    row: Mapping[str, Any],
    pair_id: str,
    object_a: str,
    object_b: str,
) -> StandardizedEvent | None:
    event_date = row.get("event_date")
    actor1_country_code = row.get("actor1_country_code")
    actor2_country_code = row.get("actor2_country_code")
    goldstein = row.get("goldstein_scale")
    if event_date is None or actor1_country_code is None or actor2_country_code is None or goldstein is None:
        return None
    if not isinstance(event_date, date):
        event_date = date.fromisoformat(str(event_date))

    return StandardizedEvent(
        event_date=event_date,
        pair_id=pair_id,
        object_a=object_a,
        object_b=object_b,
        actor1_country_code=str(actor1_country_code),
        actor2_country_code=str(actor2_country_code),
        goldstein_scale=float(goldstein),
        num_mentions=max(int(row.get("num_mentions") or 0), 0),
        num_articles=max(int(row.get("num_articles") or 0), 0),
        event_code=_optional_str(row.get("event_code")),
        event_root_code=_optional_str(row.get("event_root_code")),
        quad_class=_optional_int(row.get("quad_class")),
        actor1_name=_optional_str(row.get("actor1_name")),
        actor2_name=_optional_str(row.get("actor2_name")),
        source_domain=_optional_str(row.get("source_domain")),
        source_url=_optional_str(row.get("source_url")),
    )


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _optional_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float | str | bytes | bytearray):
        return int(value)
    raise TypeError(f"Cannot convert {type(value).__name__} to int")

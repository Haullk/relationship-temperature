from __future__ import annotations

import json
import os
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any, Protocol

from relationship_temperature.models import RelationshipResult

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = PROJECT_ROOT / "migrations"

REQUIRED_GDELT_FIELDS = frozenset(
    {
        "event_date",
        "actor1_country_code",
        "actor2_country_code",
        "goldstein_scale",
        "num_mentions",
        "num_articles",
        "event_code",
        "event_root_code",
        "quad_class",
        "actor1_name",
        "actor2_name",
        "source_domain",
        "source_url",
    }
)


class CursorLike(Protocol):
    def execute(self, query: str, params: object = ...) -> object: ...
    def fetchall(self) -> list[Mapping[str, Any]]: ...


class ConnectionLike(Protocol):
    def cursor(self) -> Any: ...
    def execute(self, query: str, params: object = ...) -> object: ...


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
        raise RuntimeError("Set GDELT_DATABASE_URL or DATABASE_URL before running database tasks.")
    return url


def connect() -> Any:
    import psycopg
    from psycopg.rows import dict_row

    return psycopg.connect(database_url(), row_factory=dict_row)


def schema_sql() -> str:
    return "\n\n".join(path.read_text(encoding="utf-8") for path in sorted(MIGRATIONS_DIR.glob("*.sql")))


def ensure_cache_schema(conn: ConnectionLike) -> None:
    conn.execute(schema_sql())


def inspect_gdelt_fields(conn: ConnectionLike, table_name: str = "gdelt_events_clean") -> set[str]:
    query = """
    select column_name
    from information_schema.columns
    where table_name = %s
    """
    with conn.cursor() as cur:
        cur.execute(query, (table_name,))
        return {str(row["column_name"]) for row in cur.fetchall()}


def missing_required_fields(fields: Iterable[str]) -> set[str]:
    return set(REQUIRED_GDELT_FIELDS).difference(fields)


def cache_row_for_result(result: RelationshipResult) -> dict[str, Any]:
    return {
        "pair_id": result.pair_id,
        "object_a": result.object_a,
        "object_b": result.object_b,
        "display_name": result.display_name,
        "data_start": result.data_start,
        "data_end": result.data_end,
        "generated_at": result.generated_at,
        "cache_status": "fresh",
        "payload": json.dumps(result.to_payload(), ensure_ascii=False),
    }


def write_cache_transaction(conn: ConnectionLike, results: Iterable[RelationshipResult]) -> None:
    rows = [cache_row_for_result(result) for result in results]
    with conn.cursor() as cur:
        cur.execute("delete from relationship_trend_cache")
        for row in rows:
            cur.execute(
                """
                insert into relationship_trend_cache (
                  pair_id,
                  object_a,
                  object_b,
                  display_name,
                  data_start,
                  data_end,
                  generated_at,
                  cache_status,
                  payload
                )
                values (
                  %(pair_id)s,
                  %(object_a)s,
                  %(object_b)s,
                  %(display_name)s,
                  %(data_start)s,
                  %(data_end)s,
                  %(generated_at)s,
                  %(cache_status)s,
                  %(payload)s::jsonb
                )
                """,
                row,
            )

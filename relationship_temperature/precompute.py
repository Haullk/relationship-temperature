from __future__ import annotations

from datetime import date

from relationship_temperature.config import load_candidate_pool
from relationship_temperature.db import connect, ensure_cache_schema, write_cache_transaction
from relationship_temperature.loader import load_events_for_all_pairs
from relationship_temperature.processing import process_relationship


def run_precompute(*, end_date: date | None = None, days: int = 90) -> int:
    pool = load_candidate_pool()
    results = []
    with connect() as conn:
        ensure_cache_schema(conn)
        events_by_pair = load_events_for_all_pairs(conn, pool, end_date=end_date, days=days)
        for pair_id in sorted(pool.legal_pair_ids):
            events = events_by_pair[pair_id]
            results.append(process_relationship(pair_id, events, pool))
        write_cache_transaction(conn, results)
    return len(results)


def main() -> None:
    count = run_precompute()
    print(f"precomputed {count} relationship pairs")


if __name__ == "__main__":
    main()

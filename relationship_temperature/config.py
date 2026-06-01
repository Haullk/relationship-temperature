from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from relationship_temperature.models import CandidateObject, FeaturedPair, PairResolution

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "candidate-pool.json"
DEFAULT_INVALID_PAIR_MESSAGE = "链接中的关系组合暂不可用，已切换到默认关系。"


@dataclass(frozen=True)
class CandidatePool:
    objects: dict[str, CandidateObject]
    default_pair: str
    excluded_pairs: frozenset[str]
    featured_pairs: tuple[FeaturedPair, ...]

    @property
    def legal_pair_ids(self) -> frozenset[str]:
        ids = sorted(self.objects)
        pairs: set[str] = set()
        for index, left in enumerate(ids):
            for right in ids[index + 1 :]:
                pair_id = canonical_pair_id(left, right)
                if pair_id not in self.excluded_pairs:
                    pairs.add(pair_id)
        return frozenset(pairs)

    def resolve_pair(self, requested_pair: str | None) -> PairResolution:
        if requested_pair is None or requested_pair.strip() == "":
            object_a, object_b = split_pair_id(self.default_pair)
            return PairResolution(None, self.default_pair, object_a, object_b, is_valid=True, used_default=True)

        parsed = parse_pair(requested_pair)
        if parsed is None:
            object_a, object_b = split_pair_id(self.default_pair)
            return PairResolution(
                requested_pair,
                self.default_pair,
                object_a,
                object_b,
                is_valid=False,
                used_default=True,
                message=DEFAULT_INVALID_PAIR_MESSAGE,
            )

        object_a, object_b = parsed
        pair_id = canonical_pair_id(object_a, object_b)
        if object_a == object_b or object_a not in self.objects or object_b not in self.objects:
            default_a, default_b = split_pair_id(self.default_pair)
            return PairResolution(
                requested_pair,
                self.default_pair,
                default_a,
                default_b,
                is_valid=False,
                used_default=True,
                message=DEFAULT_INVALID_PAIR_MESSAGE,
            )

        if pair_id not in self.legal_pair_ids:
            default_a, default_b = split_pair_id(self.default_pair)
            return PairResolution(
                requested_pair,
                self.default_pair,
                default_a,
                default_b,
                is_valid=False,
                used_default=True,
                message=DEFAULT_INVALID_PAIR_MESSAGE,
            )

        return PairResolution(requested_pair, pair_id, *split_pair_id(pair_id), is_valid=True, used_default=False)

    def display_name(self, pair_id: str) -> str:
        for featured_pair in self.featured_pairs:
            if featured_pair.pair_id == pair_id:
                return featured_pair.label
        object_a, object_b = split_pair_id(pair_id)
        return f"{self.objects[object_a].label} - {self.objects[object_b].label}"

    def keywords_for_pair(self, pair_id: str) -> tuple[tuple[str, ...], tuple[str, ...]]:
        object_a, object_b = split_pair_id(pair_id)
        return self.objects[object_a].keywords, self.objects[object_b].keywords


def load_candidate_pool(path: Path = DEFAULT_CONFIG_PATH) -> CandidatePool:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return candidate_pool_from_dict(raw)


def candidate_pool_from_dict(raw: dict[str, Any]) -> CandidatePool:
    objects: dict[str, CandidateObject] = {}
    for item in raw["objects"]:
        object_id = normalize_object_code(str(item["id"]))
        objects[object_id] = CandidateObject(
            id=object_id,
            label=str(item["label"]),
            gdelt_codes=tuple(str(code).upper() for code in item["gdelt_codes"]),
            keywords=tuple(str(keyword).lower() for keyword in item.get("keywords", ())),
        )

    excluded_pairs = frozenset(
        canonical_pair_id(str(left), str(right)) for left, right in raw.get("excluded_pairs", ())
    )
    default_pair = canonical_pair_id(*parse_pair_or_raise(str(raw["default_pair"])))

    featured: list[FeaturedPair] = []
    for item in raw.get("featured_pairs", ()):
        left, right = (normalize_object_code(str(code)) for code in item["objects"])
        pair_id = canonical_pair_id(left, right)
        featured.append(FeaturedPair(pair_id=pair_id, objects=(left, right), label=str(item["label"])))

    pool = CandidatePool(
        objects=objects,
        default_pair=default_pair,
        excluded_pairs=excluded_pairs,
        featured_pairs=tuple(featured),
    )
    if pool.default_pair not in pool.legal_pair_ids:
        raise ValueError(f"default_pair is not legal: {pool.default_pair}")
    return pool


def normalize_object_code(code: str) -> str:
    return code.strip().lower().replace("-", "_")


def canonical_pair_id(object_a: str, object_b: str) -> str:
    left = normalize_object_code(object_a)
    right = normalize_object_code(object_b)
    return "_".join(sorted((left, right)))


def split_pair_id(pair_id: str) -> tuple[str, str]:
    parsed = parse_pair(pair_id)
    if parsed is None:
        raise ValueError(f"Invalid pair id: {pair_id}")
    return parsed


def parse_pair(pair: str) -> tuple[str, str] | None:
    parts = [normalize_object_code(part) for part in pair.split("_")]
    if len(parts) != 2 or not all(parts):
        return None
    return parts[0], parts[1]


def parse_pair_or_raise(pair: str) -> tuple[str, str]:
    parsed = parse_pair(pair)
    if parsed is None:
        raise ValueError(f"Invalid pair id: {pair}")
    return parsed

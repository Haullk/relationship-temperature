import fs from "node:fs";
import path from "node:path";

import type { CandidateObject, CandidatePoolResponse, FeaturedPair } from "./types";

interface RawCandidateObject {
  id: string;
  label: string;
  gdelt_codes: string[];
  keywords: string[];
}

interface RawFeaturedPair {
  objects: [string, string];
  label: string;
}

interface RawCandidatePool {
  default_pair: string;
  objects: RawCandidateObject[];
  excluded_pairs: [string, string][];
  featured_pairs: RawFeaturedPair[];
}

export interface PairResolution {
  requestedPair: string | null;
  pairId: string;
  objectA: string;
  objectB: string;
  isValid: boolean;
  usedDefault: boolean;
  message: string | null;
}

export interface CandidatePool {
  objects: Map<string, CandidateObject>;
  defaultPair: string;
  excludedPairs: Set<string>;
  featuredPairs: FeaturedPair[];
  legalPairIds: Set<string>;
}

export const invalidPairMessage = "链接中的关系组合暂不可用，已切换到默认关系。";

export function loadCandidatePool(): CandidatePool {
  const configPath = path.join(process.cwd(), "config", "candidate-pool.json");
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as RawCandidatePool;
  return candidatePoolFromRaw(raw);
}

export function candidatePoolFromRaw(raw: RawCandidatePool): CandidatePool {
  const objects = new Map<string, CandidateObject>();
  for (const item of raw.objects) {
    objects.set(normalizeObjectCode(item.id), {
      id: normalizeObjectCode(item.id),
      label: item.label,
      gdelt_codes: item.gdelt_codes,
      keywords: item.keywords
    });
  }
  const excludedPairs = new Set(raw.excluded_pairs.map(([left, right]) => canonicalPairId(left, right)));
  const defaultPair = canonicalPairIdFromRaw(raw.default_pair);
  const legalPairIds = buildLegalPairIds([...objects.keys()], excludedPairs);
  const featuredPairs = raw.featured_pairs.map((item) => {
    const objectsTuple: [string, string] = [normalizeObjectCode(item.objects[0]), normalizeObjectCode(item.objects[1])];
    return {
      pairId: canonicalPairId(objectsTuple[0], objectsTuple[1]),
      objects: objectsTuple,
      label: item.label
    };
  });
  return { objects, defaultPair, excludedPairs, featuredPairs, legalPairIds };
}

export function resolvePair(pool: CandidatePool, requestedPair: string | null): PairResolution {
  if (requestedPair === null || requestedPair.trim() === "") {
    const [objectA, objectB] = splitPairId(pool.defaultPair);
    return { requestedPair, pairId: pool.defaultPair, objectA, objectB, isValid: true, usedDefault: true, message: null };
  }
  const parsed = parsePair(requestedPair);
  if (parsed === null) {
    return defaultResolution(pool, requestedPair);
  }
  const [left, right] = parsed;
  const pairId = canonicalPairId(left, right);
  if (left === right || !pool.objects.has(left) || !pool.objects.has(right) || !pool.legalPairIds.has(pairId)) {
    return defaultResolution(pool, requestedPair);
  }
  const [objectA, objectB] = splitPairId(pairId);
  return { requestedPair, pairId, objectA, objectB, isValid: true, usedDefault: false, message: null };
}

export function toCandidatePoolResponse(pool: CandidatePool): CandidatePoolResponse {
  return {
    objects: [...pool.objects.values()],
    featuredPairs: pool.featuredPairs,
    defaultPair: pool.defaultPair,
    legalPairIds: [...pool.legalPairIds].sort()
  };
}

export function canonicalPairId(left: string, right: string): string {
  return [normalizeObjectCode(left), normalizeObjectCode(right)].sort().join("_");
}

export function splitPairId(pairId: string): [string, string] {
  const parsed = parsePair(pairId);
  if (parsed === null) {
    throw new Error(`Invalid pair id: ${pairId}`);
  }
  return parsed;
}

function parsePair(pair: string): [string, string] | null {
  const parts = pair.split("_").map(normalizeObjectCode);
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    return null;
  }
  return [parts[0], parts[1]];
}

function canonicalPairIdFromRaw(pair: string): string {
  const parsed = parsePair(pair);
  if (parsed === null) {
    throw new Error(`Invalid pair id: ${pair}`);
  }
  return canonicalPairId(parsed[0], parsed[1]);
}

function buildLegalPairIds(ids: string[], excludedPairs: Set<string>): Set<string> {
  const legal = new Set<string>();
  const sorted = [...ids].sort();
  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
      const pairId = canonicalPairId(sorted[leftIndex], sorted[rightIndex]);
      if (!excludedPairs.has(pairId)) {
        legal.add(pairId);
      }
    }
  }
  return legal;
}

function defaultResolution(pool: CandidatePool, requestedPair: string): PairResolution {
  const [objectA, objectB] = splitPairId(pool.defaultPair);
  return {
    requestedPair,
    pairId: pool.defaultPair,
    objectA,
    objectB,
    isValid: false,
    usedDefault: true,
    message: invalidPairMessage
  };
}

function normalizeObjectCode(code: string): string {
  return code.trim().toLowerCase().replaceAll("-", "_");
}


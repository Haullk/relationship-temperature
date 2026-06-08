import type { RelationshipPayload } from "./types";

export const siteUrl = "https://www.geoprizm.com";

interface ObjectSeoProfile {
  slug: string;
  englishName: string;
  chineseName: string;
}

const objectSeoProfiles: Record<string, ObjectSeoProfile> = {
  chn: { slug: "china", englishName: "China", chineseName: "中国" },
  usa: { slug: "united-states", englishName: "United States", chineseName: "美国" },
  rus: { slug: "russia", englishName: "Russia", chineseName: "俄罗斯" },
  europe: { slug: "europe", englishName: "Europe", chineseName: "欧洲" },
  jpn: { slug: "japan", englishName: "Japan", chineseName: "日本" },
  ind: { slug: "india", englishName: "India", chineseName: "印度" },
  irn: { slug: "iran", englishName: "Iran", chineseName: "伊朗" },
  twn: { slug: "taiwan", englishName: "Taiwan", chineseName: "中国台湾" },
  ukr: { slug: "ukraine", englishName: "Ukraine", chineseName: "乌克兰" }
};

export interface PairSeoSummary {
  pairId: string;
  canonicalPath: string;
  canonicalUrl: string;
  slug: string;
  englishName: string;
  chineseName: string;
  title: string;
  description: string;
  brief: string;
  readingGuide: string;
  methodNote: string;
  currentTemperature: number | null;
  statusLabel: string | null;
  dataEnd: string | null;
  dataStart: string | null;
  generatedAt: string | null;
}

export function normalizeKnownPairId(pair: string | null | undefined): string | null {
  if (!pair) {
    return null;
  }
  const parts = pair
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .split("_")
    .filter(Boolean);
  if (parts.length !== 2 || parts[0] === parts[1]) {
    return null;
  }
  if (!objectSeoProfiles[parts[0]] || !objectSeoProfiles[parts[1]]) {
    return null;
  }
  return parts.sort().join("_");
}

export function pairIdFromSlug(slug: string): string | null {
  const normalizedSlug = slug.trim().toLowerCase();
  const objectIds = Object.keys(objectSeoProfiles);
  for (let leftIndex = 0; leftIndex < objectIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < objectIds.length; rightIndex += 1) {
      const pairId = [objectIds[leftIndex], objectIds[rightIndex]].sort().join("_");
      if (pairSlug(pairId) === normalizedSlug) {
        return pairId;
      }
    }
  }
  return null;
}

export function pairSlug(pairId: string): string {
  const [left, right] = splitKnownPairId(pairId);
  return [objectSeoProfiles[left].slug, objectSeoProfiles[right].slug].join("-");
}

export function pairCanonicalPath(pairId: string): string {
  return `/bilateral/${pairSlug(pairId)}`;
}

export function pairCanonicalUrl(pairId: string): string {
  return new URL(pairCanonicalPath(pairId), siteUrl).toString();
}

export function buildPairSeoSummary(pairId: string, relationship: RelationshipPayload | null = null): PairSeoSummary {
  const canonicalPairId = normalizeKnownPairId(pairId);
  if (canonicalPairId === null) {
    throw new Error(`Unknown relationship pair: ${pairId}`);
  }
  const englishName = pairEnglishName(canonicalPairId);
  const chineseName = pairChineseName(canonicalPairId);
  const currentTemperature = relationship?.current_temperature ?? null;
  const statusLabel = relationship?.card_status ?? relationship?.current_band ?? null;
  const dataStart = relationship?.data_start ?? null;
  const dataEnd = relationship?.data_end ?? null;
  const generatedAt = relationship?.generated_at ?? null;
  const scoreText = currentTemperature === null
    ? "The latest relationship score is pending cached data."
    : `Current score: ${currentTemperature.toFixed(1)}.`;
  const updateText = dataEnd ? ` Updated through ${dataEnd}.` : " Updated daily when new data is available.";
  const description = `Track ${englishName} bilateral relations with GeoPrizm. ${scoreText} Based on GDELT global news event data.${updateText}`;
  const chineseScoreText = currentTemperature === null
    ? "当前指数等待缓存数据。"
    : `当前指数为 ${currentTemperature.toFixed(1)}，状态为${statusLabel ?? "观察中"}。`;
  const brief = `${chineseName}关系指数基于 GDELT 全球新闻事件数据每日更新，用来观察双方关系在合作、摩擦和中性区间之间的变化。${chineseScoreText}${dataEnd ? ` 数据更新至 ${dataEnd}。` : ""}`;
  const readingGuide = `本页聚焦 ${chineseName} 双边关系的公开新闻信号，适合用来查看近期关系温度、趋势方向和主要转折点。指数越高代表报道中的合作信号越强，指数越低代表摩擦或冲突信号更突出。`;
  const methodNote = `GeoPrizm 将 GDELT 事件数据中的 CAMEO 事件类型、Goldstein 分值和报道热度汇总为每日关系指数，并用 14 天滚动平均降低单日新闻噪声。该指数反映媒体报道结构，不等同于官方外交判断。`;

  return {
    pairId: canonicalPairId,
    canonicalPath: pairCanonicalPath(canonicalPairId),
    canonicalUrl: pairCanonicalUrl(canonicalPairId),
    slug: pairSlug(canonicalPairId),
    englishName,
    chineseName,
    title: `${englishName} Relations Index 2026 | GeoPrizm`,
    description,
    brief,
    readingGuide,
    methodNote,
    currentTemperature,
    statusLabel,
    dataStart,
    dataEnd,
    generatedAt
  };
}

function pairEnglishName(pairId: string): string {
  const [left, right] = splitKnownPairId(pairId);
  return [objectSeoProfiles[left].englishName, objectSeoProfiles[right].englishName].join("-");
}

function pairChineseName(pairId: string): string {
  const [left, right] = splitKnownPairId(pairId);
  return [objectSeoProfiles[left].chineseName, objectSeoProfiles[right].chineseName].join("—");
}

function splitKnownPairId(pairId: string): [string, string] {
  const normalizedPairId = normalizeKnownPairId(pairId);
  if (normalizedPairId === null) {
    throw new Error(`Unknown relationship pair: ${pairId}`);
  }
  const [left, right] = normalizedPairId.split("_");
  return [left, right];
}

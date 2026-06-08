import type { RelationshipPayload } from "./types";
import {
  defaultLocale,
  languageAlternates,
  localizedPath,
  localizedUrl,
  pairLocalizedName,
  relationshipStatusLabel,
  siteUrl,
  type Locale
} from "./i18n";

export { siteUrl };

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
  locale: Locale;
  canonicalPath: string;
  canonicalUrl: string;
  slug: string;
  englishName: string;
  chineseName: string;
  localizedName: string;
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

export function localizedPairCanonicalPath(pairId: string, locale: Locale): string {
  return localizedPath(locale, pairCanonicalPath(pairId));
}

export function localizedPairCanonicalUrl(pairId: string, locale: Locale): string {
  return localizedUrl(locale, pairCanonicalPath(pairId));
}

export function pairLanguageAlternates(pairId: string): Record<string, string> {
  return languageAlternates(pairCanonicalPath(pairId));
}

export function buildPairSeoSummary(
  pairId: string,
  relationship: RelationshipPayload | null = null,
  locale: Locale = defaultLocale
): PairSeoSummary {
  const canonicalPairId = normalizeKnownPairId(pairId);
  if (canonicalPairId === null) {
    throw new Error(`Unknown relationship pair: ${pairId}`);
  }
  const englishName = pairEnglishName(canonicalPairId);
  const chineseName = pairChineseName(canonicalPairId);
  const localizedName = pairLocalizedName(locale, canonicalPairId);
  const currentTemperature = relationship?.current_temperature ?? null;
  const statusLabel = currentTemperature === null ? null : relationshipStatusLabel(locale, currentTemperature);
  const dataStart = relationship?.data_start ?? null;
  const dataEnd = relationship?.data_end ?? null;
  const generatedAt = relationship?.generated_at ?? null;
  const localizedCopy = pairSeoCopy(locale, {
    englishName,
    localizedName,
    currentTemperature,
    statusLabel,
    dataEnd
  });

  return {
    pairId: canonicalPairId,
    locale,
    canonicalPath: localizedPairCanonicalPath(canonicalPairId, locale),
    canonicalUrl: localizedPairCanonicalUrl(canonicalPairId, locale),
    slug: pairSlug(canonicalPairId),
    englishName,
    chineseName,
    localizedName,
    title: localizedCopy.title,
    description: localizedCopy.description,
    brief: localizedCopy.brief,
    readingGuide: localizedCopy.readingGuide,
    methodNote: localizedCopy.methodNote,
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

function pairSeoCopy(
  locale: Locale,
  context: {
    englishName: string;
    localizedName: string;
    currentTemperature: number | null;
    statusLabel: string | null;
    dataEnd: string | null;
  }
) {
  const score = context.currentTemperature?.toFixed(1) ?? null;
  const status = context.statusLabel ?? relationshipStatusLabel(locale, null);
  if (locale === "en") {
    const scoreText = score === null ? "The latest relationship index is waiting for cached data." : `Current index: ${score}.`;
    const updateText = context.dataEnd ? ` Updated through ${context.dataEnd}.` : " Updated daily when new data is available.";
    return {
      title: `${context.englishName} Relations Index 2026 | GeoPrizm`,
      description: `Track ${context.englishName} bilateral relations with GeoPrizm. ${scoreText} Based on GDELT global news event data.${updateText}`,
      brief: `${context.localizedName} relations index is updated from GDELT global news event data to show how cooperation, friction, and neutral signals move over time. ${scoreText}${context.dataEnd ? ` Data is updated through ${context.dataEnd}.` : ""}`,
      readingGuide: `This page focuses on public news signals for ${context.localizedName} relations. Use it to scan the current index, recent trend direction, and major turning points. A higher index means cooperation signals are stronger in the news data; a lower index means friction or conflict signals are more prominent.`,
      methodNote: "GeoPrizm aggregates CAMEO event types, Goldstein scores, and coverage intensity from GDELT event data into a daily relationship index, then applies a 14-day rolling average to reduce single-day news noise. The index reflects media event structure, not an official diplomatic judgment."
    };
  }
  if (locale === "ja") {
    const scoreText = score === null ? "現在の指数はキャッシュデータ待ちです。" : `現在の指数は ${score}、状態は「${status}」です。`;
    return {
      title: `${context.localizedName}関係指数 2026 | GeoPrizm`,
      description: `GeoPrizm で ${context.localizedName} の二国間関係を追跡。GDELT の世界ニュースイベントデータをもとに、0-100 の関係指数とトレンド区間を確認できます。`,
      brief: `${context.localizedName}関係指数は GDELT の世界ニュースイベントデータから毎日更新され、協力、摩擦、中立の信号がどう変化しているかを観察するためのものです。${scoreText}${context.dataEnd ? ` データは ${context.dataEnd} まで更新されています。` : ""}`,
      readingGuide: `このページは ${context.localizedName} 関係に関する公開ニュース信号に注目します。現在の指数、最近の方向感、主要な転換点をすばやく確認できます。指数が高いほど協力信号が強く、低いほど摩擦や対立の信号が目立ちます。`,
      methodNote: "GeoPrizm は GDELT イベントデータの CAMEO イベント種別、Goldstein スコア、報道量を日次の関係指数に集約し、14 日移動平均で単日のニュースノイズを抑えます。この指数はメディア報道構造を反映するもので、公式な外交判断ではありません。"
    };
  }
  if (locale === "zh-TW") {
    const scoreText = score === null ? "目前指數等待快取資料。" : `目前指數為 ${score}，狀態為${status}。`;
    return {
      title: `${context.localizedName}關係指數 2026 | GeoPrizm`,
      description: `用 GeoPrizm 追蹤 ${context.localizedName} 雙邊關係。基於 GDELT 全球新聞事件資料，查看 0-100 關係指數與趨勢區段。`,
      brief: `${context.localizedName}關係指數基於 GDELT 全球新聞事件資料每日更新，用來觀察雙方關係在合作、摩擦和中性區間之間的變化。${scoreText}${context.dataEnd ? ` 資料更新至 ${context.dataEnd}。` : ""}`,
      readingGuide: `本頁聚焦 ${context.localizedName} 雙邊關係的公開新聞信號，適合查看近期關係指數、趨勢方向和主要轉折點。指數越高代表報導中的合作信號越強，指數越低代表摩擦或衝突信號更突出。`,
      methodNote: "GeoPrizm 將 GDELT 事件資料中的 CAMEO 事件類型、Goldstein 分值和報導熱度彙整為每日關係指數，並用 14 天滾動平均降低單日新聞噪音。該指數反映媒體報導結構，不等同於官方外交判斷。"
    };
  }
  if (locale === "ko") {
    const scoreText = score === null ? "현재 지수는 캐시 데이터 대기 중입니다." : `현재 지수는 ${score}이며 상태는 ${status}입니다.`;
    return {
      title: `${context.localizedName} 관계 지수 2026 | GeoPrizm`,
      description: `GeoPrizm에서 ${context.localizedName} 양자 관계를 추적합니다. GDELT 글로벌 뉴스 이벤트 데이터를 바탕으로 0-100 관계 지수와 추세 구간을 확인하세요.`,
      brief: `${context.localizedName} 관계 지수는 GDELT 글로벌 뉴스 이벤트 데이터를 바탕으로 매일 업데이트되며, 협력, 마찰, 중립 신호가 시간에 따라 어떻게 움직이는지 보여줍니다. ${scoreText}${context.dataEnd ? ` 데이터는 ${context.dataEnd}까지 업데이트되었습니다.` : ""}`,
      readingGuide: `이 페이지는 ${context.localizedName} 관계의 공개 뉴스 신호에 집중합니다. 현재 지수, 최근 방향, 주요 전환점을 빠르게 확인할 수 있습니다. 지수가 높을수록 협력 신호가 강하고, 낮을수록 마찰 또는 충돌 신호가 두드러집니다.`,
      methodNote: "GeoPrizm은 GDELT 이벤트 데이터의 CAMEO 이벤트 유형, Goldstein 점수, 보도 강도를 일별 관계 지수로 집계하고 14일 이동평균으로 하루 단위 뉴스 노이즈를 줄입니다. 이 지수는 언론 보도 구조를 반영하며 공식 외교 판단이 아닙니다."
    };
  }
  const scoreText = score === null ? "当前指数等待缓存数据。" : `当前指数为 ${score}，状态为${status}。`;
  return {
    title: `${context.localizedName}关系指数 2026 | GeoPrizm`,
    description: `用 GeoPrizm 追踪 ${context.localizedName} 双边关系。基于 GDELT 全球新闻事件数据，查看 0-100 关系指数与趋势段。`,
    brief: `${context.localizedName}关系指数基于 GDELT 全球新闻事件数据每日更新，用来观察双方关系在合作、摩擦和中性区间之间的变化。${scoreText}${context.dataEnd ? ` 数据更新至 ${context.dataEnd}。` : ""}`,
    readingGuide: `本页聚焦 ${context.localizedName} 双边关系的公开新闻信号，适合用来查看近期关系指数、趋势方向和主要转折点。指数越高代表报道中的合作信号越强，指数越低代表摩擦或冲突信号更突出。`,
    methodNote: "GeoPrizm 将 GDELT 事件数据中的 CAMEO 事件类型、Goldstein 分值和报道热度汇总为每日关系指数，并用 14 天滚动平均降低单日新闻噪声。该指数反映媒体报道结构，不等同于官方外交判断。"
  };
}

function splitKnownPairId(pairId: string): [string, string] {
  const normalizedPairId = normalizeKnownPairId(pairId);
  if (normalizedPairId === null) {
    throw new Error(`Unknown relationship pair: ${pairId}`);
  }
  const [left, right] = normalizedPairId.split("_");
  return [left, right];
}

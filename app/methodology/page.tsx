import type { Metadata } from "next";
import Link from "next/link";

import SiteHeader from "@/components/SiteHeader";
import {
  getDashboardCopy,
  localeFromPathname,
  localeMeta,
  localizedSwitchPath,
  siteUrl,
  supportedLocales,
  type Locale
} from "@/lib/i18n";
import { latestFeaturedDataEnd } from "@/lib/latestData";

const githubUrl = "https://github.com/Haullk/relationship-temperature";
const gdeltUrl = "https://www.gdeltproject.org/";
const gdeltDataUrl = "https://www.gdeltproject.org/data.html";
const gdeltCodebookUrl = "https://data.gdeltproject.org/documentation/GDELT-Event_Codebook-V2.0.pdf";
const cameoUrl = "https://eventdata.parusanalytics.com/data.dir/cameo.html";
const goldsteinUrl = "https://web.pdx.edu/~kinsella/jgscale.html";

const methodologyUrl = new URL("/methodology", siteUrl).toString();

type MethodologyPageProps = {
  searchParams: Promise<{ from?: string | string[] }>;
};

const methodologyMetadata = {
  "zh-CN": {
    title: "GeoPrizm Methodology | GDELT 双边关系指数计算方法",
    description: "了解 GeoPrizm 如何使用 GDELT、CAMEO、GoldsteinScale、报道热度加权和 14 日滚动平均计算 0-100 双边关系指数。"
  },
  en: {
    title: "GeoPrizm Methodology",
    description: "How GeoPrizm calculates a 0-100 bilateral relations index with GDELT, CAMEO, GoldsteinScale, coverage weighting, and 14-day rolling averages."
  },
  ja: {
    title: "GeoPrizm Methodology | GDELT 二国間関係指数の計算方法",
    description: "GeoPrizm が GDELT、CAMEO、GoldsteinScale、報道重み、14 日ローリング平均を使って 0-100 の二国間関係指数を計算する方法。"
  },
  "zh-TW": {
    title: "GeoPrizm Methodology | GDELT 雙邊關係指數計算方法",
    description: "了解 GeoPrizm 如何使用 GDELT、CAMEO、GoldsteinScale、報導熱度加權和 14 日滾動平均計算 0-100 雙邊關係指數。"
  },
  ko: {
    title: "GeoPrizm Methodology | GDELT 양자 관계 지수 계산 방법",
    description: "GeoPrizm이 GDELT, CAMEO, GoldsteinScale, 보도 가중치, 14일 이동 평균으로 0-100 양자 관계 지수를 계산하는 방법."
  }
} satisfies Record<Locale, Pick<Metadata, "title" | "description">>;

const methodologyKeywords = [
  "GeoPrizm methodology",
  "GDELT bilateral relations methodology",
  "how to measure geopolitical relations index",
  "GoldsteinScale calculation explained",
  "bilateral relations index",
  "CAMEO event data",
  "地缘政治关系指数",
  "双边关系指数计算方法"
];

export async function generateMetadata({ searchParams }: MethodologyPageProps): Promise<Metadata> {
  const returnHref = safeReturnHref((await searchParams).from);
  const locale = localeFromPathname(returnHref);
  const meta = methodologyMetadata[locale];

  return {
    title: meta.title,
    description: meta.description ?? "",
    keywords: methodologyKeywords,
    alternates: {
      canonical: "/methodology"
    },
    openGraph: {
      title: String(meta.title),
      description: meta.description ?? "",
      url: methodologyUrl,
      siteName: "GeoPrizm",
      type: "article",
      locale: localeMeta[locale].openGraphLocale
    },
    twitter: {
    card: "summary",
      title: String(meta.title),
      description: meta.description ?? ""
    }
  };
}

interface MethodologyCopy {
  tocLabel: string;
  tocItems: Array<{ href: string; label: string }>;
  index: {
    title: string;
    summary: string;
    scaleAria: string;
    scale: Array<{ range: string; body: string }>;
    body: string;
  };
  data: {
    title: string;
    summary: string;
    body: string;
    sources: Array<{ title: string; href: string; body: string }>;
  };
  calculation: {
    title: string;
    summary: string;
    steps: Array<{ title: string; body: string }>;
    formulaAria: string;
    dailySignalTitle: string;
    indexFormulaTitle: string;
    body: string;
  };
  ai: {
    title: string;
    summary: string;
    doesTitle: string;
    does: string[];
    notTitle: string;
    not: string[];
  };
  limits: {
    title: string;
    summary: string;
    items: string[];
    calloutTitle: string;
    calloutBody: string;
  };
  citation: {
    title: string;
    summary: string;
    localHeading: string;
    localTextBeforeUrl: string;
    localTextAfterUrl: string;
    englishHeading: string;
    englishTextBeforeUrl: string;
    englishTextAfterUrl: string;
    returnLabel: string;
    githubLabel: string;
  };
}

const commonTocItems = {
  "zh-CN": [
    { href: "#index", label: "关系指数是什么" },
    { href: "#data", label: "数据来源" },
    { href: "#calculation", label: "计算方法" },
    { href: "#ai", label: "AI 解读层" },
    { href: "#limits", label: "局限性声明" },
    { href: "#citation", label: "引用格式" }
  ],
  en: [
    { href: "#index", label: "What the index means" },
    { href: "#data", label: "Data source" },
    { href: "#calculation", label: "Calculation method" },
    { href: "#ai", label: "AI interpretation layer" },
    { href: "#limits", label: "Known limits" },
    { href: "#citation", label: "Citation" }
  ],
  ja: [
    { href: "#index", label: "関係指数とは" },
    { href: "#data", label: "データソース" },
    { href: "#calculation", label: "計算方法" },
    { href: "#ai", label: "AI 解説レイヤー" },
    { href: "#limits", label: "制約と注意点" },
    { href: "#citation", label: "引用形式" }
  ],
  "zh-TW": [
    { href: "#index", label: "關係指數是什麼" },
    { href: "#data", label: "資料來源" },
    { href: "#calculation", label: "計算方法" },
    { href: "#ai", label: "AI 解讀層" },
    { href: "#limits", label: "限制聲明" },
    { href: "#citation", label: "引用格式" }
  ],
  ko: [
    { href: "#index", label: "관계 지수란" },
    { href: "#data", label: "데이터 출처" },
    { href: "#calculation", label: "계산 방법" },
    { href: "#ai", label: "AI 해석 계층" },
    { href: "#limits", label: "한계 고지" },
    { href: "#citation", label: "인용 형식" }
  ]
} satisfies Record<Locale, MethodologyCopy["tocItems"]>;

const methodologyCopies: Record<Locale, MethodologyCopy> = {
  "zh-CN": {
    tocLabel: "页面目录",
    tocItems: commonTocItems["zh-CN"],
    index: {
      title: "关系指数是什么",
      summary: "一个把新闻事件信号映射到共同标尺上的观察指标。",
      scaleAria: "关系指数区间说明",
      scale: [
        { range: "0-45", body: "偏紧张，冲突、批评、威胁或军事相关信号更突出。" },
        { range: "45-55", body: "接近中性，合作和摩擦信号相对平衡，或近期信号较弱。" },
        { range: "55-100", body: "偏友好，磋商、合作、援助、积极声明等信号更突出。" }
      ],
      body: "指数的中心点是 50。它不是“关系好坏”的官方结论，而是一个方便比较的媒体事件信号标尺。读图时应同时看当前值、最近变化、趋势段解释和新闻证据。"
    },
    data: {
      title: "数据来源：GDELT",
      summary: "GeoPrizm 使用公开新闻事件数据，而不是自行采集外交文件或社交媒体舆情。",
      body: "GDELT 是 Global Database of Events, Language and Tone 的缩写。它持续监测全球新闻媒体，并把非结构化新闻报道转换为包含参与方、事件类别、地点、时间和多个强度字段的结构化记录。GeoPrizm 当前使用 GDELT 事件数据中适合双边关系观察的字段，包括国家参与方、事件日期、CAMEO 事件类别、GoldsteinScale、报道次数和文章来源。",
      sources: [
        { title: "GDELT Project", href: gdeltUrl, body: "官方项目入口，用于了解 GDELT 如何从全球新闻媒体中抽取事件、主题、地点和语调信号。" },
        { title: "GDELT Data", href: gdeltDataUrl, body: "数据下载和文档入口，包含 GDELT 2.0 Event Database、GKG、BigQuery 和原始文件说明。" },
        { title: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, body: "字段级说明。GeoPrizm 使用其中的国家参与方、事件日期、GoldsteinScale 和报道热度字段。" },
        { title: "CAMEO Codebook", href: cameoUrl, body: "事件分类体系。它把声明、磋商、合作、抗议、威胁、冲突等行为编码为可计算类别。" }
      ]
    },
    calculation: {
      title: "计算方法",
      summary: "从事件记录到日度指数，核心是方向、热度和平滑。",
      steps: [
        { title: "筛选双边事件", body: "读取候选国家对在最近 90 天内的 GDELT 事件，只保留两方国家代码同时出现且 GoldsteinScale 可用的记录。" },
        { title: "计算每日信号", body: "每条事件按报道热度加权。当前权重使用 log1p(max(num_mentions, num_articles, 1))，避免单个高曝光事件完全压过其他信号。" },
        { title: "平滑单日波动", body: "把每日加权 GoldsteinScale 放入 14 日滚动窗口，只对窗口内有事件的日期求平均。没有有效事件时回到中性基准。" },
        { title: "映射到 0-100", body: "滚动后的合作或冲突信号会映射为关系指数。50 是中性线，高于 50 偏友好，低于 50 偏紧张。" }
      ],
      formulaAria: "指数计算公式",
      dailySignalTitle: "每日加权信号",
      indexFormulaTitle: "关系指数",
      body: "GoldsteinScale 的正负方向来自事件行为本身：合作、援助、会谈等通常为正，抗议、威胁、冲突等通常为负。GeoPrizm 使用 14 日滚动平均，是为了降低单日新闻集中报道带来的噪声，同时保留近期趋势变化。"
    },
    ai: {
      title: "AI 解读层",
      summary: "AI 负责把证据线索讲清楚，不负责生成底层指数。",
      doesTitle: "AI 做了什么",
      does: ["整理趋势段附近的新闻标题、摘要和来源线索。", "把英文或多语种新闻线索转写成中文解释。", "用谨慎语气说明可能相关的新闻背景。"],
      notTitle: "AI 没做什么",
      not: ["不修改 GoldsteinScale、事件权重或 0-100 指数。", "不读取无法访问的付费全文或内部外交材料。", "不判断真实因果，也不替代外交、法律、投资或安全分析。"]
    },
    limits: {
      title: "数据局限性声明",
      summary: "透明的限制说明是这个页面最重要的部分之一。",
      items: [
        "媒体事件信号不等于官方外交现实。指数反映公开新闻报道里出现了什么，不代表两国政府的真实立场或完整互动。",
        "新闻覆盖存在地区、语言、媒体议程和突发事件偏差。高报道热度可能让短期事件在指数上显得更突出。",
        "GoldsteinScale 主要依据事件行为类别评分，同类事件在不同语境中的真实影响可能不同。",
        "AI 解读依赖标题、摘要和可访问的新闻元数据。它帮助整理线索，不判断因果，也不替代研究者阅读原始材料。"
      ],
      calloutTitle: "使用前请记住：",
      calloutBody: "GeoPrizm 适合观察公开报道结构和近期变化方向，不适合作为单一事实来源。重要判断应回到原始新闻、官方文件和专业研究。"
    },
    citation: {
      title: "引用格式",
      summary: "如果你在文章、研究笔记或课堂材料中使用 GeoPrizm，可以按下面格式引用。",
      localHeading: "中文引用",
      localTextBeforeUrl: "Haullk. GeoPrizm 双边关系指数方法说明。GeoPrizm, 2026. 访问地址：",
      localTextAfterUrl: "",
      englishHeading: "English citation",
      englishTextBeforeUrl: "Haullk. GeoPrizm methodology: GDELT bilateral relations index. GeoPrizm, 2026. Available at ",
      englishTextAfterUrl: ".",
      returnLabel: "回到刚才的看板",
      githubLabel: "查看 GitHub 项目"
    }
  },
  en: {
    tocLabel: "On this page",
    tocItems: commonTocItems.en,
    index: {
      title: "What The Relationship Index Means",
      summary: "A comparable indicator that maps public news event signals onto a shared 0-100 scale.",
      scaleAria: "Relationship index ranges",
      scale: [
        { range: "0-45", body: "More tense. Conflict, criticism, threats, or military related signals are more visible." },
        { range: "45-55", body: "Near neutral. Cooperative and friction signals are relatively balanced, or recent signals are weak." },
        { range: "55-100", body: "More favorable. Consultations, cooperation, aid, or positive statements are more visible." }
      ],
      body: "The midpoint is 50. It is not an official judgment about whether a relationship is good or bad. It is a practical media event signal scale. When reading the chart, use the current value together with the recent change, trend explanation, and news evidence."
    },
    data: {
      title: "Data Source: GDELT",
      summary: "GeoPrizm uses public news event data, not private diplomatic cables or social media sentiment scraping.",
      body: "GDELT stands for Global Database of Events, Language and Tone. It monitors global news coverage and converts unstructured reporting into structured event records with actors, event categories, locations, dates, and intensity fields. GeoPrizm uses fields that are useful for bilateral relations analysis, including country actors, event dates, CAMEO event categories, GoldsteinScale, mention counts, article counts, and sources.",
      sources: [
        { title: "GDELT Project", href: gdeltUrl, body: "The official project entry point for understanding how GDELT extracts event, theme, location, and tone signals from global news." },
        { title: "GDELT Data", href: gdeltDataUrl, body: "Data and documentation entry point for GDELT 2.0 Event Database, GKG, BigQuery access, and raw file notes." },
        { title: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, body: "Field level documentation. GeoPrizm uses country actors, event dates, GoldsteinScale, and coverage intensity fields." },
        { title: "CAMEO Codebook", href: cameoUrl, body: "The event taxonomy that classifies statements, consultations, cooperation, protests, threats, and conflict behavior into computable categories." }
      ]
    },
    calculation: {
      title: "Calculation Method",
      summary: "From event records to a daily index, the core ingredients are direction, coverage weight, and smoothing.",
      steps: [
        { title: "Filter bilateral events", body: "Read GDELT events for a country pair in the latest 90 day window, keeping records where both country codes appear and GoldsteinScale is available." },
        { title: "Calculate daily signal", body: "Each event is weighted by coverage intensity. The current weight uses log1p(max(num_mentions, num_articles, 1)) so a single highly covered event does not overwhelm all other signals." },
        { title: "Smooth short term noise", body: "Daily weighted GoldsteinScale values are placed in a 14 day rolling window. Only dates with valid events are averaged. Missing signal falls back toward the neutral baseline." },
        { title: "Map to 0-100", body: "The smoothed cooperation or conflict signal is mapped to the relationship index. 50 is neutral, above 50 is more favorable, and below 50 is more tense." }
      ],
      formulaAria: "Index calculation formula",
      dailySignalTitle: "Daily weighted signal",
      indexFormulaTitle: "Relationship index",
      body: "The direction of GoldsteinScale comes from the event behavior itself. Cooperation, aid, and talks are usually positive. Protests, threats, and conflict are usually negative. GeoPrizm uses a 14 day rolling average to reduce single day news spikes while preserving recent trend changes."
    },
    ai: {
      title: "AI Interpretation Layer",
      summary: "AI explains the evidence trail. It does not generate the underlying index.",
      doesTitle: "What AI does",
      does: ["Organizes news titles, summaries, and source clues around trend segments.", "Turns English or multilingual news clues into readable explanations.", "Uses cautious wording to describe potentially relevant news context."],
      notTitle: "What AI does not do",
      not: ["It does not change GoldsteinScale, event weights, or the 0-100 index.", "It does not read inaccessible paywalled articles or internal diplomatic material.", "It does not determine real causality or replace diplomatic, legal, investment, or security analysis."]
    },
    limits: {
      title: "Known Data Limits",
      summary: "A transparent limitations section is central to using the index responsibly.",
      items: [
        "Media event signals are not the same as diplomatic reality. The index reflects what appears in public news coverage, not the full position or behavior of governments.",
        "News coverage has regional, language, media agenda, and breaking news bias. Heavy coverage can make short term events look more prominent in the index.",
        "GoldsteinScale is based mainly on event behavior categories. The same category can have different real world impact in different contexts.",
        "AI interpretation depends on available titles, summaries, and news metadata. It helps organize clues, but it does not decide causality or replace source reading."
      ],
      calloutTitle: "Before using the index:",
      calloutBody: "GeoPrizm is useful for observing public reporting patterns and recent direction. It should not be used as a single source of truth. Important judgments should return to original news, official documents, and specialist research."
    },
    citation: {
      title: "Citation",
      summary: "If you use GeoPrizm in an article, research note, or class material, you can cite it as follows.",
      localHeading: "English citation",
      localTextBeforeUrl: "Haullk. GeoPrizm methodology: GDELT bilateral relations index. GeoPrizm, 2026. Available at ",
      localTextAfterUrl: ".",
      englishHeading: "Short citation",
      englishTextBeforeUrl: "GeoPrizm Methodology, ",
      englishTextAfterUrl: ".",
      returnLabel: "Back to the dashboard",
      githubLabel: "View GitHub project"
    }
  },
  ja: {
    tocLabel: "ページ目次",
    tocItems: commonTocItems.ja,
    index: {
      title: "関係指数とは",
      summary: "公開ニュースイベントの信号を共通の 0-100 スケールに写像した観察指標です。",
      scaleAria: "関係指数のレンジ説明",
      scale: [
        { range: "0-45", body: "緊張寄り。対立、批判、威嚇、軍事関連の信号が目立つ状態です。" },
        { range: "45-55", body: "中立に近い状態。協力と摩擦の信号が比較的均衡しているか、直近の信号が弱い状態です。" },
        { range: "55-100", body: "友好寄り。協議、協力、支援、前向きな声明などの信号が目立つ状態です。" }
      ],
      body: "中心点は 50 です。これは関係の良し悪しを公式に判断するものではなく、メディアイベント信号を比較しやすくするための尺度です。読むときは現在値、直近変化、トレンド区間の解説、ニュース根拠を合わせて確認します。"
    },
    data: {
      title: "データソース：GDELT",
      summary: "GeoPrizm は公開ニュースイベントデータを使い、外交文書やソーシャルメディア感情を独自収集しているわけではありません。",
      body: "GDELT は Global Database of Events, Language and Tone の略です。世界中のニュース報道を監視し、非構造化の記事を、主体、イベント分類、場所、日付、複数の強度フィールドを持つ構造化イベント記録に変換します。GeoPrizm は二国間関係の観察に使える国コード、イベント日、CAMEO イベント分類、GoldsteinScale、言及数、記事数、情報源を利用します。",
      sources: [
        { title: "GDELT Project", href: gdeltUrl, body: "GDELT が世界のニュースからイベント、テーマ、場所、トーン信号を抽出する仕組みを確認する公式入口です。" },
        { title: "GDELT Data", href: gdeltDataUrl, body: "GDELT 2.0 Event Database、GKG、BigQuery、元データファイルの説明を含むデータと文書の入口です。" },
        { title: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, body: "フィールド単位の説明です。GeoPrizm は国の主体、イベント日、GoldsteinScale、報道強度フィールドを使用します。" },
        { title: "CAMEO Codebook", href: cameoUrl, body: "声明、協議、協力、抗議、威嚇、衝突などの行動を計算可能なカテゴリに分類するイベント分類体系です。" }
      ]
    },
    calculation: {
      title: "計算方法",
      summary: "イベント記録から日次指数へ変換する中心は、方向、報道重み、平滑化です。",
      steps: [
        { title: "二国間イベントを抽出", body: "直近 90 日の GDELT イベントから対象国ペアを読み込み、両方の国コードが出現し、GoldsteinScale が利用できる記録だけを残します。" },
        { title: "日次信号を計算", body: "各イベントを報道強度で重み付けします。現在の重みは log1p(max(num_mentions, num_articles, 1)) で、単一の高露出イベントが他の信号を完全に押し流さないようにします。" },
        { title: "短期ノイズを平滑化", body: "日次の加重 GoldsteinScale を 14 日ローリング窓に入れ、有効イベントがある日のみ平均します。信号がない場合は中立基準に戻します。" },
        { title: "0-100 に写像", body: "平滑化された協力または対立信号を関係指数に変換します。50 が中立、50 より上が友好寄り、50 より下が緊張寄りです。" }
      ],
      formulaAria: "指数計算式",
      dailySignalTitle: "日次加重信号",
      indexFormulaTitle: "関係指数",
      body: "GoldsteinScale の正負方向はイベント行動そのものから来ます。協力、支援、会談は通常プラスで、抗議、威嚇、衝突は通常マイナスです。GeoPrizm は単日の報道集中によるノイズを抑えつつ、直近のトレンド変化を残すために 14 日ローリング平均を使います。"
    },
    ai: {
      title: "AI 解説レイヤー",
      summary: "AI は根拠の手がかりを読みやすく整理します。基礎指数は生成しません。",
      doesTitle: "AI が行うこと",
      does: ["トレンド区間付近のニュースタイトル、要約、情報源の手がかりを整理します。", "英語または多言語のニュース手がかりを読みやすい説明にします。", "関連し得るニュース背景を慎重な表現で説明します。"],
      notTitle: "AI が行わないこと",
      not: ["GoldsteinScale、イベント重み、0-100 指数は変更しません。", "アクセスできない有料記事全文や内部外交資料は読みません。", "実際の因果を判断せず、外交、法律、投資、安全保障分析の代替にもなりません。"]
    },
    limits: {
      title: "制約と注意点",
      summary: "責任を持って指数を使うために、制約を明示することが重要です。",
      items: [
        "メディアイベント信号は外交の現実そのものではありません。指数は公開ニュース報道に何が現れたかを示すもので、政府の立場や行動の全体像ではありません。",
        "ニュース報道には地域、言語、媒体の議題、速報性の偏りがあります。報道量が大きい短期イベントは指数上で目立ちやすくなります。",
        "GoldsteinScale は主にイベント行動カテゴリに基づきます。同じカテゴリでも文脈によって実際の影響は異なります。",
        "AI 解説は利用可能なタイトル、要約、ニュースメタデータに依存します。手がかりを整理しますが、因果判断や原文確認の代替ではありません。"
      ],
      calloutTitle: "使う前に：",
      calloutBody: "GeoPrizm は公開報道の構造と直近方向を観察するためのツールです。唯一の事実源として使うべきではありません。重要な判断は原報道、公式文書、専門研究に戻って確認してください。"
    },
    citation: {
      title: "引用形式",
      summary: "記事、研究メモ、授業資料で GeoPrizm を使う場合は、次の形式で引用できます。",
      localHeading: "日本語引用",
      localTextBeforeUrl: "Haullk. GeoPrizm 二国間関係指数の方法説明。GeoPrizm, 2026. URL：",
      localTextAfterUrl: "",
      englishHeading: "English citation",
      englishTextBeforeUrl: "Haullk. GeoPrizm methodology: GDELT bilateral relations index. GeoPrizm, 2026. Available at ",
      englishTextAfterUrl: ".",
      returnLabel: "直前のダッシュボードへ戻る",
      githubLabel: "GitHub プロジェクトを見る"
    }
  },
  "zh-TW": {
    tocLabel: "頁面目錄",
    tocItems: commonTocItems["zh-TW"],
    index: {
      title: "關係指數是什麼",
      summary: "把新聞事件信號映射到共同 0-100 標尺上的觀察指標。",
      scaleAria: "關係指數區間說明",
      scale: [
        { range: "0-45", body: "偏緊張，衝突、批評、威脅或軍事相關信號更突出。" },
        { range: "45-55", body: "接近中性，合作和摩擦信號相對平衡，或近期信號較弱。" },
        { range: "55-100", body: "偏友好，磋商、合作、援助、積極聲明等信號更突出。" }
      ],
      body: "指數的中心點是 50。它不是「關係好壞」的官方結論，而是方便比較的媒體事件信號標尺。讀圖時應同時看目前值、近期變化、趨勢區段解讀與新聞證據。"
    },
    data: {
      title: "資料來源：GDELT",
      summary: "GeoPrizm 使用公開新聞事件資料，而不是自行蒐集外交文件或社群媒體情緒。",
      body: "GDELT 是 Global Database of Events, Language and Tone 的縮寫。它持續監測全球新聞媒體，並把非結構化報導轉換為包含參與方、事件類別、地點、時間和多個強度欄位的結構化記錄。GeoPrizm 目前使用 GDELT 事件資料中適合雙邊關係觀察的欄位，包括國家參與方、事件日期、CAMEO 事件類別、GoldsteinScale、報導次數和文章來源。",
      sources: [
        { title: "GDELT Project", href: gdeltUrl, body: "官方專案入口，用於了解 GDELT 如何從全球新聞媒體中抽取事件、主題、地點和語調信號。" },
        { title: "GDELT Data", href: gdeltDataUrl, body: "資料下載和文件入口，包含 GDELT 2.0 Event Database、GKG、BigQuery 和原始檔案說明。" },
        { title: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, body: "欄位級說明。GeoPrizm 使用其中的國家參與方、事件日期、GoldsteinScale 和報導熱度欄位。" },
        { title: "CAMEO Codebook", href: cameoUrl, body: "事件分類體系。它把聲明、磋商、合作、抗議、威脅、衝突等行為編碼為可計算類別。" }
      ]
    },
    calculation: {
      title: "計算方法",
      summary: "從事件記錄到日度指數，核心是方向、熱度和平滑。",
      steps: [
        { title: "篩選雙邊事件", body: "讀取候選國家對在最近 90 天內的 GDELT 事件，只保留兩方國家代碼同時出現且 GoldsteinScale 可用的記錄。" },
        { title: "計算每日信號", body: "每條事件按報導熱度加權。目前權重使用 log1p(max(num_mentions, num_articles, 1))，避免單個高曝光事件完全壓過其他信號。" },
        { title: "平滑短期波動", body: "把每日加權 GoldsteinScale 放入 14 日滾動視窗，只對視窗內有事件的日期求平均。沒有有效事件時回到中性基準。" },
        { title: "映射到 0-100", body: "滾動後的合作或衝突信號會映射為關係指數。50 是中性線，高於 50 偏友好，低於 50 偏緊張。" }
      ],
      formulaAria: "指數計算公式",
      dailySignalTitle: "每日加權信號",
      indexFormulaTitle: "關係指數",
      body: "GoldsteinScale 的正負方向來自事件行為本身：合作、援助、會談等通常為正，抗議、威脅、衝突等通常為負。GeoPrizm 使用 14 日滾動平均，是為了降低單日新聞集中報導帶來的雜訊，同時保留近期趨勢變化。"
    },
    ai: {
      title: "AI 解讀層",
      summary: "AI 負責把證據線索講清楚，不負責生成底層指數。",
      doesTitle: "AI 做了什麼",
      does: ["整理趨勢區段附近的新聞標題、摘要和來源線索。", "把英文或多語種新聞線索轉寫成可讀的解釋。", "用謹慎語氣說明可能相關的新聞背景。"],
      notTitle: "AI 沒做什麼",
      not: ["不修改 GoldsteinScale、事件權重或 0-100 指數。", "不讀取無法存取的付費全文或內部外交材料。", "不判斷真實因果，也不替代外交、法律、投資或安全分析。"]
    },
    limits: {
      title: "資料限制聲明",
      summary: "透明的限制說明是負責任使用這個指數的關鍵。",
      items: [
        "媒體事件信號不等於官方外交現實。指數反映公開新聞報導裡出現了什麼，不代表兩國政府的真實立場或完整互動。",
        "新聞覆蓋存在地區、語言、媒體議程和突發事件偏差。高報導熱度可能讓短期事件在指數上顯得更突出。",
        "GoldsteinScale 主要依據事件行為類別評分，同類事件在不同語境中的真實影響可能不同。",
        "AI 解讀依賴標題、摘要和可存取的新聞元資料。它幫助整理線索，不判斷因果，也不替代研究者閱讀原始材料。"
      ],
      calloutTitle: "使用前請記住：",
      calloutBody: "GeoPrizm 適合觀察公開報導結構和近期變化方向，不適合作為單一事實來源。重要判斷應回到原始新聞、官方文件和專業研究。"
    },
    citation: {
      title: "引用格式",
      summary: "如果你在文章、研究筆記或課堂材料中使用 GeoPrizm，可以按下面格式引用。",
      localHeading: "中文引用",
      localTextBeforeUrl: "Haullk. GeoPrizm 雙邊關係指數方法說明。GeoPrizm, 2026. 取自：",
      localTextAfterUrl: "",
      englishHeading: "English citation",
      englishTextBeforeUrl: "Haullk. GeoPrizm methodology: GDELT bilateral relations index. GeoPrizm, 2026. Available at ",
      englishTextAfterUrl: ".",
      returnLabel: "回到剛才的看板",
      githubLabel: "查看 GitHub 專案"
    }
  },
  ko: {
    tocLabel: "페이지 목차",
    tocItems: commonTocItems.ko,
    index: {
      title: "관계 지수란",
      summary: "공개 뉴스 이벤트 신호를 공통 0-100 척도로 옮긴 관찰 지표입니다.",
      scaleAria: "관계 지수 구간 설명",
      scale: [
        { range: "0-45", body: "긴장에 가깝습니다. 충돌, 비판, 위협, 군사 관련 신호가 더 두드러집니다." },
        { range: "45-55", body: "중립에 가깝습니다. 협력과 마찰 신호가 비교적 균형을 이루거나 최근 신호가 약합니다." },
        { range: "55-100", body: "우호에 가깝습니다. 협의, 협력, 지원, 긍정적 발언 신호가 더 두드러집니다." }
      ],
      body: "중심점은 50입니다. 이는 관계가 좋은지 나쁜지에 대한 공식 판단이 아니라, 미디어 이벤트 신호를 비교하기 쉽게 만든 척도입니다. 차트를 볼 때는 현재 값, 최근 변화, 추세 구간 해석, 뉴스 근거를 함께 확인해야 합니다."
    },
    data: {
      title: "데이터 출처: GDELT",
      summary: "GeoPrizm은 공개 뉴스 이벤트 데이터를 사용하며, 외교 문서나 소셜미디어 감성을 직접 수집하지 않습니다.",
      body: "GDELT는 Global Database of Events, Language and Tone의 약자입니다. 전 세계 뉴스 보도를 지속적으로 모니터링하고, 비정형 기사를 행위자, 이벤트 분류, 장소, 날짜, 여러 강도 필드를 가진 구조화 이벤트 기록으로 변환합니다. GeoPrizm은 양자 관계 관찰에 적합한 국가 행위자, 이벤트 날짜, CAMEO 이벤트 분류, GoldsteinScale, 언급 수, 기사 수, 출처 필드를 사용합니다.",
      sources: [
        { title: "GDELT Project", href: gdeltUrl, body: "GDELT가 전 세계 뉴스에서 이벤트, 주제, 장소, 톤 신호를 추출하는 방식을 확인하는 공식 진입점입니다." },
        { title: "GDELT Data", href: gdeltDataUrl, body: "GDELT 2.0 Event Database, GKG, BigQuery, 원본 파일 설명을 포함한 데이터와 문서 진입점입니다." },
        { title: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, body: "필드 단위 문서입니다. GeoPrizm은 국가 행위자, 이벤트 날짜, GoldsteinScale, 보도 강도 필드를 사용합니다." },
        { title: "CAMEO Codebook", href: cameoUrl, body: "발언, 협의, 협력, 항의, 위협, 충돌 행동을 계산 가능한 범주로 분류하는 이벤트 분류 체계입니다." }
      ]
    },
    calculation: {
      title: "계산 방법",
      summary: "이벤트 기록에서 일간 지수로 변환할 때 핵심은 방향, 보도 가중치, 평활화입니다.",
      steps: [
        { title: "양자 이벤트 필터링", body: "최근 90일 동안의 GDELT 이벤트에서 대상 국가 쌍을 읽고, 두 국가 코드가 모두 나타나며 GoldsteinScale을 사용할 수 있는 기록만 남깁니다." },
        { title: "일간 신호 계산", body: "각 이벤트는 보도 강도에 따라 가중됩니다. 현재 가중치는 log1p(max(num_mentions, num_articles, 1))을 사용해 단일 고노출 이벤트가 다른 신호를 완전히 압도하지 않도록 합니다." },
        { title: "단기 노이즈 평활화", body: "일간 가중 GoldsteinScale 값을 14일 이동 창에 넣고, 유효 이벤트가 있는 날짜만 평균합니다. 유효 신호가 없으면 중립 기준으로 돌아갑니다." },
        { title: "0-100으로 매핑", body: "평활화된 협력 또는 충돌 신호를 관계 지수로 변환합니다. 50은 중립, 50보다 높으면 우호, 50보다 낮으면 긴장에 가깝습니다." }
      ],
      formulaAria: "지수 계산 공식",
      dailySignalTitle: "일간 가중 신호",
      indexFormulaTitle: "관계 지수",
      body: "GoldsteinScale의 양수와 음수 방향은 이벤트 행동 자체에서 나옵니다. 협력, 지원, 회담은 보통 양수이고 항의, 위협, 충돌은 보통 음수입니다. GeoPrizm은 단일 날짜의 뉴스 집중으로 생기는 노이즈를 줄이면서 최근 추세 변화를 유지하기 위해 14일 이동 평균을 사용합니다."
    },
    ai: {
      title: "AI 해석 계층",
      summary: "AI는 근거 단서를 읽기 쉽게 정리합니다. 기초 지수를 생성하지는 않습니다.",
      doesTitle: "AI가 하는 일",
      does: ["추세 구간 주변의 뉴스 제목, 요약, 출처 단서를 정리합니다.", "영어 또는 다국어 뉴스 단서를 읽기 쉬운 설명으로 바꿉니다.", "관련 가능성이 있는 뉴스 배경을 신중한 표현으로 설명합니다."],
      notTitle: "AI가 하지 않는 일",
      not: ["GoldsteinScale, 이벤트 가중치, 0-100 지수를 변경하지 않습니다.", "접근할 수 없는 유료 기사 전문이나 내부 외교 자료를 읽지 않습니다.", "실제 인과관계를 판단하지 않으며 외교, 법률, 투자, 안보 분석을 대체하지 않습니다."]
    },
    limits: {
      title: "데이터 한계 고지",
      summary: "투명한 한계 설명은 이 지수를 책임 있게 사용하는 데 중요합니다.",
      items: [
        "미디어 이벤트 신호는 외교 현실 그 자체가 아닙니다. 지수는 공개 뉴스 보도에 무엇이 나타났는지를 반영하며, 정부 입장이나 행동의 전체를 의미하지 않습니다.",
        "뉴스 보도에는 지역, 언어, 매체 의제, 속보 편향이 있습니다. 보도량이 큰 단기 이벤트는 지수에서 더 크게 보일 수 있습니다.",
        "GoldsteinScale은 주로 이벤트 행동 범주에 기반합니다. 같은 범주라도 맥락에 따라 실제 영향은 달라질 수 있습니다.",
        "AI 해석은 사용 가능한 제목, 요약, 뉴스 메타데이터에 의존합니다. 단서를 정리하지만 인과를 판단하거나 원문 읽기를 대체하지 않습니다."
      ],
      calloutTitle: "사용 전 기억할 점:",
      calloutBody: "GeoPrizm은 공개 보도 구조와 최근 방향을 관찰하는 데 적합합니다. 단일 사실 출처로 사용해서는 안 됩니다. 중요한 판단은 원문 뉴스, 공식 문서, 전문 연구로 돌아가 확인해야 합니다."
    },
    citation: {
      title: "인용 형식",
      summary: "기사, 연구 노트, 수업 자료에서 GeoPrizm을 사용할 때는 다음 형식으로 인용할 수 있습니다.",
      localHeading: "한국어 인용",
      localTextBeforeUrl: "Haullk. GeoPrizm 양자 관계 지수 방법론. GeoPrizm, 2026. URL: ",
      localTextAfterUrl: "",
      englishHeading: "English citation",
      englishTextBeforeUrl: "Haullk. GeoPrizm methodology: GDELT bilateral relations index. GeoPrizm, 2026. Available at ",
      englishTextAfterUrl: ".",
      returnLabel: "이전 대시보드로 돌아가기",
      githubLabel: "GitHub 프로젝트 보기"
    }
  }
};

const methodologyJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "GeoPrizm methodology: GDELT bilateral relations index",
  description:
    "A transparent methodology page explaining how GeoPrizm calculates a 0-100 bilateral relations index from GDELT event data, CAMEO categories, GoldsteinScale values, coverage weighting, and 14-day rolling averages.",
  inLanguage: "zh-CN",
  url: methodologyUrl,
  author: {
    "@type": "Person",
    name: "Haullk",
    url: "https://github.com/Haullk"
  },
  publisher: {
    "@id": "https://www.geoprizm.com/#organization"
  },
  isPartOf: {
    "@id": "https://www.geoprizm.com/#website"
  },
  about: ["GDELT", "CAMEO event data", "GoldsteinScale", "bilateral relations index", "geopolitical news signals"],
  citation: [gdeltUrl, gdeltCodebookUrl, cameoUrl, goldsteinUrl],
  codeRepository: githubUrl
};

function methodologyJsonLdForLocale(locale: Locale, copy: MethodologyCopy) {
  return {
    ...methodologyJsonLd,
    inLanguage: locale,
    description: copy.index.summary
  };
}

export default async function MethodologyPage({ searchParams }: MethodologyPageProps) {
  const returnHref = safeReturnHref((await searchParams).from);
  const locale = localeFromPathname(returnHref);
  const copy = getDashboardCopy(locale);
  const methodologyCopy = methodologyCopies[locale];
  const latestData = await latestFeaturedDataEnd();
  const methodologyHref = `/methodology?from=${encodeURIComponent(returnHref)}`;
  const languageOptions = supportedLocales.map((targetLocale) => ({
    locale: targetLocale,
    href: `/methodology?from=${encodeURIComponent(localizedSwitchPath(targetLocale, "/"))}`
  }));

  return (
    <main className="methodology-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(methodologyJsonLdForLocale(locale, methodologyCopy)) }}
      />
      <SiteHeader
        activeTab="methodology"
        aboutHref="/about"
        copy={{ topbar: copy.topbar, nav: copy.nav }}
        dashboardHref={returnHref}
        languageOptions={languageOptions}
        latestData={latestData}
        locale={locale}
        methodologyHref={methodologyHref}
      />

      <div className="methodology-layout">
        <aside className="methodology-toc" aria-label={methodologyCopy.tocLabel}>
          <span>{methodologyCopy.tocLabel}</span>
          <nav>
            {methodologyCopy.tocItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="methodology-article">
          <section className="methodology-section" id="index">
            <div className="methodology-section-heading">
              <h2>{methodologyCopy.index.title}</h2>
              <p>{methodologyCopy.index.summary}</p>
            </div>
            <div className="index-scale" aria-label={methodologyCopy.index.scaleAria}>
              {methodologyCopy.index.scale.map((item) => (
                <div key={item.range}>
                  <strong>{item.range}</strong>
                  <span>{item.body}</span>
                </div>
              ))}
            </div>
            <p>{methodologyCopy.index.body}</p>
          </section>

          <section className="methodology-section" id="data">
            <div className="methodology-section-heading">
              <h2>{methodologyCopy.data.title}</h2>
              <p>{methodologyCopy.data.summary}</p>
            </div>
            <p>{methodologyCopy.data.body}</p>
            <div className="methodology-source-grid">
              {methodologyCopy.data.sources.map((source) => (
                <a className="methodology-source-card" href={source.href} key={source.href} rel="noreferrer" target="_blank">
                  <strong>{source.title}</strong>
                  <span>{source.body}</span>
                </a>
              ))}
            </div>
          </section>

          <section className="methodology-section" id="calculation">
            <div className="methodology-section-heading">
              <h2>{methodologyCopy.calculation.title}</h2>
              <p>{methodologyCopy.calculation.summary}</p>
            </div>
            <ol className="methodology-steps">
              {methodologyCopy.calculation.steps.map((step, index) => (
                <li key={step.title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="formula-panel" aria-label={methodologyCopy.calculation.formulaAria}>
              <div>
                <h3>{methodologyCopy.calculation.dailySignalTitle}</h3>
                <pre>
                  <code>
                    daily_signal = sum(GoldsteinScale * weight) / sum(weight)
                    {"\n"}weight = log1p(max(num_mentions, num_articles, 1))
                  </code>
                </pre>
              </div>
              <div>
                <h3>{methodologyCopy.calculation.indexFormulaTitle}</h3>
                <pre>
                  <code>
                    rolling_signal = 14_day_average(daily_signal)
                    {"\n"}index = clamp(50 + rolling_signal * 12, 0, 100)
                  </code>
                </pre>
              </div>
            </div>
            <p>{methodologyCopy.calculation.body}</p>
          </section>

          <section className="methodology-section" id="ai">
            <div className="methodology-section-heading">
              <h2>{methodologyCopy.ai.title}</h2>
              <p>{methodologyCopy.ai.summary}</p>
            </div>
            <div className="ai-boundary-grid">
              <section>
                <h3>{methodologyCopy.ai.doesTitle}</h3>
                <ul>
                  {methodologyCopy.ai.does.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>{methodologyCopy.ai.notTitle}</h3>
                <ul>
                  {methodologyCopy.ai.not.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </section>

          <section className="methodology-section" id="limits">
            <div className="methodology-section-heading">
              <h2>{methodologyCopy.limits.title}</h2>
              <p>{methodologyCopy.limits.summary}</p>
            </div>
            <ul className="limitation-list">
              {methodologyCopy.limits.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="methodology-callout">
              <strong>{methodologyCopy.limits.calloutTitle}</strong>
              <span>{methodologyCopy.limits.calloutBody}</span>
            </div>
          </section>

          <section className="methodology-section" id="citation">
            <div className="methodology-section-heading">
              <h2>{methodologyCopy.citation.title}</h2>
              <p>{methodologyCopy.citation.summary}</p>
            </div>
            <div className="citation-panel">
              <h3>{methodologyCopy.citation.localHeading}</h3>
              <p>
                {methodologyCopy.citation.localTextBeforeUrl}
                <a href={methodologyUrl}>{methodologyUrl}</a>
                {methodologyCopy.citation.localTextAfterUrl}
              </p>
              <h3>{methodologyCopy.citation.englishHeading}</h3>
              <p>
                {methodologyCopy.citation.englishTextBeforeUrl}
                <a href={methodologyUrl}>{methodologyUrl}</a>
                {methodologyCopy.citation.englishTextAfterUrl}
              </p>
            </div>
            <div className="methodology-footer-actions">
              <Link href={returnHref}>{methodologyCopy.citation.returnLabel}</Link>
              <a href={githubUrl} rel="noreferrer" target="_blank">
                {methodologyCopy.citation.githubLabel}
              </a>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}

function safeReturnHref(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) {
    return "/";
  }

  const href = rawValue.trim();
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/methodology")) {
    return "/";
  }
  if (/[\r\n]/.test(href)) {
    return "/";
  }
  return href;
}

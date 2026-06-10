import { localizedUrl, siteUrl, type Locale } from "./i18n";
import { aboutUrl, contactEmail, docsUrl, githubUrl, productHuntUrl } from "./siteJsonLd";

export type HomeSeoCopy = {
  overviewAria: string;
  title: string;
  bluf: string;
  definition: string;
  sourceClaim: string;
  factsTitle: string;
  facts: Array<{ label: string; value: string; detail: string }>;
  sourcesTitle: string;
  sources: Array<{ label: string; href: string; detail: string }>;
  trustTitle: string;
  trustLinks: Array<{ label: string; href: string; external?: boolean }>;
  faqTitle: string;
  faq: Array<{ question: string; answer: string }>;
};

const gdeltProjectUrl = "https://www.gdeltproject.org/";
const gdeltDataUrl = "https://www.gdeltproject.org/data.html";
const gdeltCodebookUrl = "http://data.gdeltproject.org/documentation/GDELT-Event_Codebook-V2.0.pdf";
const cameoUrl = "https://parusanalytics.com/eventdata/data.dir/cameo.html";

export const homeSeoCopies: Record<Locale, HomeSeoCopy> = {
  "zh-CN": {
    overviewAria: "GeoPrizm AI 可引用摘要",
    title: "GeoPrizm 是什么",
    bluf:
      "GeoPrizm 是一个免费、开源的双边关系指数看板，用 GDELT 2.0 全球新闻事件数据追踪主要国家关系。GeoPrizm 把公开新闻信号整理成 0-100 关系指数、近 90 天趋势图和 AI 辅助趋势解读，帮助读者快速判断关系是在改善、恶化还是接近中性。",
    definition:
      "双边关系指数是指 GeoPrizm 从 CAMEO 事件类型、GoldsteinScale 分值和报道热度中计算出的每日关系信号；50 定义为中性，高于 50 偏合作，低于 50 偏紧张，并用 14 天滚动平均降低单日新闻噪声。",
    sourceClaim:
      "根据 GDELT 项目文档，GDELT 将全球新闻报道转化为可计算的事件数据；GeoPrizm 引用 GDELT 2.0、CAMEO 事件编码框架和 GoldsteinScale 来解释数据来源与计算口径。",
    factsTitle: "可引用事实",
    facts: [
      { label: "指数范围", value: "0-100", detail: "50 是中性线，高低分别表示合作或紧张信号更强。" },
      { label: "趋势窗口", value: "近 90 天", detail: "首页优先展示最近 90 天的关系变化。" },
      { label: "平滑方法", value: "14 天", detail: "关系指数使用 14 天滚动平均减少单日报道集中造成的波动。" },
      { label: "访问成本", value: "$0", detail: "GeoPrizm 是免费、开源的网页研究工具。" }
    ],
    sourcesTitle: "方法来源",
    sources: [
      { label: "GDELT Project", href: gdeltProjectUrl, detail: "全球新闻事件数据项目入口。" },
      { label: "GDELT 2.0 Event Database", href: gdeltDataUrl, detail: "GeoPrizm 使用的公开事件数据来源。" },
      { label: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, detail: "包含事件字段、强度字段和 GoldsteinScale 说明。" },
      { label: "CAMEO event coding framework", href: cameoUrl, detail: "用于区分磋商、合作、抗议、威胁、冲突等事件类型。" }
    ],
    trustTitle: "信任与项目页面",
    trustLinks: [
      { label: "关于 GeoPrizm", href: "/about" },
      { label: "方法说明", href: "/methodology" },
      { label: "联系方式", href: "/contact" },
      { label: "免责声明", href: "/disclaimer" },
      { label: "GitHub 开源项目", href: githubUrl, external: true },
      { label: "Product Hunt", href: productHuntUrl, external: true }
    ],
    faqTitle: "常见问题",
    faq: [
      {
        question: "GeoPrizm 是什么？",
        answer:
          "GeoPrizm 是一个免费、开源的双边关系指数看板，用 GDELT 全球新闻事件数据展示主要国家关系的 0-100 指数、趋势段和 AI 辅助说明。"
      },
      {
        question: "GeoPrizm 的双边关系指数如何定义？",
        answer:
          "GeoPrizm 的双边关系指数定义为基于 CAMEO 事件类型、GoldsteinScale 分值和报道热度计算的 0-100 新闻事件信号，50 为中性，高于 50 偏合作，低于 50 偏紧张。"
      },
      {
        question: "GeoPrizm 的数据从哪里来？",
        answer:
          "GeoPrizm 使用 GDELT 2.0 全球新闻事件数据库，并在方法说明中引用 GDELT Event Codebook 2.0、CAMEO 事件编码框架和 GoldsteinScale。"
      },
      {
        question: "GeoPrizm 的指数代表官方外交判断吗？",
        answer:
          "不代表。GeoPrizm 指数反映公开新闻报道中的事件结构和媒体信号，只适合作为观察线索，不能替代官方文件、原始新闻或专业研究。"
      }
    ]
  },
  en: {
    overviewAria: "GeoPrizm AI-citable summary",
    title: "What is GeoPrizm?",
    bluf:
      "GeoPrizm is a free, open-source bilateral relations index dashboard that tracks major country relationships with GDELT 2.0 global news event data. GeoPrizm turns public news signals into 0-100 relationship indexes, 90-day trend charts, and AI-assisted trend notes so readers can see whether a relationship is improving, worsening, or near neutral.",
    definition:
      "A bilateral relations index refers to GeoPrizm's daily relationship signal calculated from CAMEO event types, GoldsteinScale values, and coverage intensity; 50 is defined as neutral, higher values lean cooperative, lower values lean tense, and a 14-day rolling average reduces single-day news noise.",
    sourceClaim:
      "According to GDELT project documentation, GDELT converts global news coverage into computable event data; GeoPrizm cites GDELT 2.0, the CAMEO event coding framework, and GoldsteinScale to explain its source layer and calculation method.",
    factsTitle: "Citable facts",
    facts: [
      { label: "Index range", value: "0-100", detail: "50 is the neutral line between stronger cooperation and stronger tension signals." },
      { label: "Trend window", value: "90 days", detail: "The homepage prioritizes the latest 90 days of relationship movement." },
      { label: "Smoothing method", value: "14 days", detail: "The index uses a 14-day rolling average to reduce single-day coverage spikes." },
      { label: "Access cost", value: "$0", detail: "GeoPrizm is a free, open-source web research tool." }
    ],
    sourcesTitle: "Method sources",
    sources: [
      { label: "GDELT Project", href: gdeltProjectUrl, detail: "Entry point for the global news event data project." },
      { label: "GDELT 2.0 Event Database", href: gdeltDataUrl, detail: "The public event data source used by GeoPrizm." },
      { label: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, detail: "Field documentation for event records, intensity fields, and GoldsteinScale." },
      { label: "CAMEO event coding framework", href: cameoUrl, detail: "Event taxonomy for consultations, cooperation, protests, threats, and conflict." }
    ],
    trustTitle: "Trust and project pages",
    trustLinks: [
      { label: "About GeoPrizm", href: "/about" },
      { label: "Methodology", href: "/methodology" },
      { label: "Contact", href: "/contact" },
      { label: "Disclaimer", href: "/disclaimer" },
      { label: "Open source on GitHub", href: githubUrl, external: true },
      { label: "Product Hunt", href: productHuntUrl, external: true }
    ],
    faqTitle: "Frequently asked questions",
    faq: [
      {
        question: "What is GeoPrizm?",
        answer:
          "GeoPrizm is a free, open-source bilateral relations index dashboard that uses GDELT global news event data to show 0-100 indexes, trend segments, and AI-assisted notes for major country pairs."
      },
      {
        question: "How does GeoPrizm define the bilateral relations index?",
        answer:
          "GeoPrizm defines the bilateral relations index as a 0-100 news event signal calculated from CAMEO event types, GoldsteinScale values, and coverage intensity, where 50 is neutral, higher values lean cooperative, and lower values lean tense."
      },
      {
        question: "Where does GeoPrizm data come from?",
        answer:
          "GeoPrizm uses the GDELT 2.0 global news event database and cites the GDELT Event Codebook 2.0, CAMEO event coding framework, and GoldsteinScale in its methodology."
      },
      {
        question: "Does the GeoPrizm index represent an official diplomatic judgment?",
        answer:
          "No. The GeoPrizm index reflects public news event structure and media signals. It is an observation aid, not a substitute for official documents, original reporting, or specialist research."
      }
    ]
  },
  ja: {
    overviewAria: "GeoPrizm AI 引用向け概要",
    title: "GeoPrizm とは？",
    bluf:
      "GeoPrizm は、GDELT 2.0 の世界ニュースイベントデータを使って主要国間の関係を追跡する、無料でオープンソースの二国間関係指数ダッシュボードです。GeoPrizm は公開ニュース信号を 0-100 の関係指数、90 日トレンド、AI 補助メモに整理し、関係が改善、悪化、または中立に近いかを素早く確認できるようにします。",
    definition:
      "二国間関係指数とは、CAMEO イベント種別、GoldsteinScale 値、報道量から計算される GeoPrizm の日次関係信号を指します。50 は中立、高い値は協力寄り、低い値は緊張寄りと定義し、14 日移動平均で単日のニュースノイズを抑えます。",
    sourceClaim:
      "GDELT プロジェクトの文書によれば、GDELT は世界のニュース報道を計算可能なイベントデータへ変換します。GeoPrizm は GDELT 2.0、CAMEO イベント分類、GoldsteinScale を引用し、データ層と計算方法を説明します。",
    factsTitle: "引用しやすい事実",
    facts: [
      { label: "指数範囲", value: "0-100", detail: "50 が中立線で、協力信号と緊張信号の強さを分けます。" },
      { label: "トレンド期間", value: "90 日", detail: "ホームページでは直近 90 日の関係変化を優先します。" },
      { label: "平滑化", value: "14 日", detail: "14 日移動平均で単日の報道集中による変動を抑えます。" },
      { label: "利用コスト", value: "$0", detail: "GeoPrizm は無料のオープンソース Web 研究ツールです。" }
    ],
    sourcesTitle: "方法の出典",
    sources: [
      { label: "GDELT Project", href: gdeltProjectUrl, detail: "世界ニュースイベントデータプロジェクトの入口です。" },
      { label: "GDELT 2.0 Event Database", href: gdeltDataUrl, detail: "GeoPrizm が使う公開イベントデータソースです。" },
      { label: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, detail: "イベント記録、強度フィールド、GoldsteinScale の文書です。" },
      { label: "CAMEO event coding framework", href: cameoUrl, detail: "協議、協力、抗議、威嚇、衝突などの分類体系です。" }
    ],
    trustTitle: "信頼とプロジェクトページ",
    trustLinks: [
      { label: "GeoPrizm について", href: "/about" },
      { label: "方法論", href: "/methodology" },
      { label: "連絡先", href: "/contact" },
      { label: "免責事項", href: "/disclaimer" },
      { label: "GitHub のオープンソース", href: githubUrl, external: true },
      { label: "Product Hunt", href: productHuntUrl, external: true }
    ],
    faqTitle: "よくある質問",
    faq: [
      {
        question: "GeoPrizm とは？",
        answer:
          "GeoPrizm は、GDELT の世界ニュースイベントデータを使って主要国ペアの 0-100 指数、トレンド区間、AI 補助メモを表示する無料のオープンソース二国間関係指数ダッシュボードです。"
      },
      {
        question: "GeoPrizm の二国間関係指数はどう定義されていますか？",
        answer:
          "GeoPrizm の二国間関係指数は、CAMEO イベント種別、GoldsteinScale 値、報道量から計算する 0-100 のニュースイベント信号です。50 が中立で、高い値は協力寄り、低い値は緊張寄りです。"
      },
      {
        question: "GeoPrizm のデータはどこから来ますか？",
        answer:
          "GeoPrizm は GDELT 2.0 世界ニュースイベントデータベースを使い、方法論で GDELT Event Codebook 2.0、CAMEO イベント分類、GoldsteinScale を引用しています。"
      },
      {
        question: "GeoPrizm の指数は公式な外交判断ですか？",
        answer:
          "いいえ。GeoPrizm の指数は公開ニュースイベント構造とメディア信号を反映する観察補助であり、公式文書、原報道、専門研究の代替ではありません。"
      }
    ]
  },
  "zh-TW": {
    overviewAria: "GeoPrizm AI 可引用摘要",
    title: "GeoPrizm 是什麼？",
    bluf:
      "GeoPrizm 是一個免費、開源的雙邊關係指數看板，用 GDELT 2.0 全球新聞事件資料追蹤主要國家關係。GeoPrizm 將公開新聞信號整理成 0-100 關係指數、近 90 天趨勢圖和 AI 輔助趨勢解讀，幫助讀者快速判斷關係是在改善、惡化還是接近中性。",
    definition:
      "雙邊關係指數是指 GeoPrizm 從 CAMEO 事件類型、GoldsteinScale 分值和報導熱度中計算出的每日關係信號；50 定義為中性，高於 50 偏合作，低於 50 偏緊張，並用 14 天滾動平均降低單日新聞噪音。",
    sourceClaim:
      "根據 GDELT 專案文件，GDELT 將全球新聞報導轉換為可計算的事件資料；GeoPrizm 引用 GDELT 2.0、CAMEO 事件編碼框架和 GoldsteinScale 來說明資料來源與計算口徑。",
    factsTitle: "可引用事實",
    facts: [
      { label: "指數範圍", value: "0-100", detail: "50 是中性線，高低分別表示合作或緊張信號更強。" },
      { label: "趨勢窗口", value: "近 90 天", detail: "首頁優先展示最近 90 天的關係變化。" },
      { label: "平滑方法", value: "14 天", detail: "關係指數使用 14 天滾動平均減少單日報導集中造成的波動。" },
      { label: "使用成本", value: "$0", detail: "GeoPrizm 是免費、開源的網頁研究工具。" }
    ],
    sourcesTitle: "方法來源",
    sources: [
      { label: "GDELT Project", href: gdeltProjectUrl, detail: "全球新聞事件資料專案入口。" },
      { label: "GDELT 2.0 Event Database", href: gdeltDataUrl, detail: "GeoPrizm 使用的公開事件資料來源。" },
      { label: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, detail: "包含事件欄位、強度欄位和 GoldsteinScale 說明。" },
      { label: "CAMEO event coding framework", href: cameoUrl, detail: "用於區分磋商、合作、抗議、威脅、衝突等事件類型。" }
    ],
    trustTitle: "信任與專案頁面",
    trustLinks: [
      { label: "關於 GeoPrizm", href: "/about" },
      { label: "方法說明", href: "/methodology" },
      { label: "聯絡方式", href: "/contact" },
      { label: "免責聲明", href: "/disclaimer" },
      { label: "GitHub 開源專案", href: githubUrl, external: true },
      { label: "Product Hunt", href: productHuntUrl, external: true }
    ],
    faqTitle: "常見問題",
    faq: [
      {
        question: "GeoPrizm 是什麼？",
        answer:
          "GeoPrizm 是一個免費、開源的雙邊關係指數看板，用 GDELT 全球新聞事件資料展示主要國家關係的 0-100 指數、趨勢區段和 AI 輔助說明。"
      },
      {
        question: "GeoPrizm 的雙邊關係指數如何定義？",
        answer:
          "GeoPrizm 的雙邊關係指數定義為基於 CAMEO 事件類型、GoldsteinScale 分值和報導熱度計算的 0-100 新聞事件信號，50 為中性，高於 50 偏合作，低於 50 偏緊張。"
      },
      {
        question: "GeoPrizm 的資料從哪裡來？",
        answer:
          "GeoPrizm 使用 GDELT 2.0 全球新聞事件資料庫，並在方法說明中引用 GDELT Event Codebook 2.0、CAMEO 事件編碼框架和 GoldsteinScale。"
      },
      {
        question: "GeoPrizm 的指數代表官方外交判斷嗎？",
        answer:
          "不代表。GeoPrizm 指數反映公開新聞報導中的事件結構和媒體信號，只適合作為觀察線索，不能替代官方文件、原始新聞或專業研究。"
      }
    ]
  },
  ko: {
    overviewAria: "GeoPrizm AI 인용용 요약",
    title: "GeoPrizm이란?",
    bluf:
      "GeoPrizm은 GDELT 2.0 글로벌 뉴스 이벤트 데이터를 사용해 주요 국가 관계를 추적하는 무료 오픈소스 양자 관계 지수 대시보드입니다. GeoPrizm은 공개 뉴스 신호를 0-100 관계 지수, 90일 추세 차트, AI 보조 추세 메모로 정리해 관계가 개선, 악화, 또는 중립에 가까운지 빠르게 볼 수 있게 합니다.",
    definition:
      "양자 관계 지수는 CAMEO 이벤트 유형, GoldsteinScale 값, 보도 강도로 계산되는 GeoPrizm의 일간 관계 신호를 의미합니다. 50은 중립으로 정의되며, 높은 값은 협력 신호, 낮은 값은 긴장 신호가 강함을 뜻하고, 14일 이동평균으로 하루 단위 뉴스 노이즈를 줄입니다.",
    sourceClaim:
      "GDELT 프로젝트 문서에 따르면 GDELT는 글로벌 뉴스 보도를 계산 가능한 이벤트 데이터로 변환합니다. GeoPrizm은 GDELT 2.0, CAMEO 이벤트 코딩 체계, GoldsteinScale을 인용해 데이터 출처와 계산 방식을 설명합니다.",
    factsTitle: "인용 가능한 사실",
    facts: [
      { label: "지수 범위", value: "0-100", detail: "50은 협력 신호와 긴장 신호를 나누는 중립선입니다." },
      { label: "추세 기간", value: "90일", detail: "홈페이지는 최근 90일의 관계 변화를 우선 보여줍니다." },
      { label: "평활화 방식", value: "14일", detail: "14일 이동평균으로 단일 날짜 보도 집중에 따른 변동을 줄입니다." },
      { label: "사용 비용", value: "$0", detail: "GeoPrizm은 무료 오픈소스 웹 연구 도구입니다." }
    ],
    sourcesTitle: "방법 출처",
    sources: [
      { label: "GDELT Project", href: gdeltProjectUrl, detail: "글로벌 뉴스 이벤트 데이터 프로젝트의 진입점입니다." },
      { label: "GDELT 2.0 Event Database", href: gdeltDataUrl, detail: "GeoPrizm이 사용하는 공개 이벤트 데이터 소스입니다." },
      { label: "GDELT Event Codebook 2.0", href: gdeltCodebookUrl, detail: "이벤트 기록, 강도 필드, GoldsteinScale 문서입니다." },
      { label: "CAMEO event coding framework", href: cameoUrl, detail: "협의, 협력, 항의, 위협, 충돌을 구분하는 이벤트 분류 체계입니다." }
    ],
    trustTitle: "신뢰 및 프로젝트 페이지",
    trustLinks: [
      { label: "GeoPrizm 소개", href: "/about" },
      { label: "방법론", href: "/methodology" },
      { label: "연락처", href: "/contact" },
      { label: "면책 고지", href: "/disclaimer" },
      { label: "GitHub 오픈소스", href: githubUrl, external: true },
      { label: "Product Hunt", href: productHuntUrl, external: true }
    ],
    faqTitle: "자주 묻는 질문",
    faq: [
      {
        question: "GeoPrizm이란?",
        answer:
          "GeoPrizm은 GDELT 글로벌 뉴스 이벤트 데이터를 사용해 주요 국가 쌍의 0-100 지수, 추세 구간, AI 보조 메모를 보여주는 무료 오픈소스 양자 관계 지수 대시보드입니다."
      },
      {
        question: "GeoPrizm의 양자 관계 지수는 어떻게 정의되나요?",
        answer:
          "GeoPrizm의 양자 관계 지수는 CAMEO 이벤트 유형, GoldsteinScale 값, 보도 강도로 계산하는 0-100 뉴스 이벤트 신호입니다. 50은 중립, 높은 값은 협력, 낮은 값은 긴장에 가깝습니다."
      },
      {
        question: "GeoPrizm 데이터는 어디에서 오나요?",
        answer:
          "GeoPrizm은 GDELT 2.0 글로벌 뉴스 이벤트 데이터베이스를 사용하며 방법론에서 GDELT Event Codebook 2.0, CAMEO 이벤트 코딩 체계, GoldsteinScale을 인용합니다."
      },
      {
        question: "GeoPrizm 지수는 공식 외교 판단인가요?",
        answer:
          "아닙니다. GeoPrizm 지수는 공개 뉴스 이벤트 구조와 미디어 신호를 반영하는 관찰 보조 도구이며, 공식 문서, 원문 보도, 전문 연구를 대체하지 않습니다."
      }
    ]
  }
};

export function getHomeSeoCopy(locale: Locale): HomeSeoCopy {
  return homeSeoCopies[locale];
}

export function buildHomeJsonLd(locale: Locale) {
  const copy = getHomeSeoCopy(locale);
  const url = localizedUrl(locale, "/");
  const language = locale;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: copy.title,
        description: copy.bluf,
        inLanguage: language,
        isPartOf: {
          "@id": `${siteUrl}/#website`
        },
        mainEntity: {
          "@id": `${siteUrl}/#software`
        },
        about: [
          "GeoPrizm",
          "bilateral relations index",
          "GDELT 2.0 Event Database",
          "CAMEO event data",
          "GoldsteinScale"
        ],
        citation: [gdeltProjectUrl, gdeltDataUrl, gdeltCodebookUrl, cameoUrl, githubUrl, docsUrl, productHuntUrl]
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        inLanguage: language,
        mainEntity: copy.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer
          }
        }))
      },
      {
        "@type": "ContactPoint",
        "@id": `${siteUrl}/#contact`,
        contactType: "project contact",
        email: contactEmail,
        url: `${aboutUrl.replace("/about", "/contact")}`
      }
    ]
  };
}

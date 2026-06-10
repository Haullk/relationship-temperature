export const siteUrl = "https://www.geoprizm.com";

export const defaultLocale = "zh-CN";
export const supportedLocales = ["zh-CN", "en", "ja", "zh-TW", "ko"] as const;
export const routedLocales = ["en", "ja", "zh-TW", "ko"] as const;

export type Locale = (typeof supportedLocales)[number];

type TranslationMap = Record<Locale, string>;

export const localeMeta: Record<Locale, {
  htmlLang: string;
  label: string;
  openGraphLocale: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  socialAlt: string;
}> = {
  "zh-CN": {
    htmlLang: "zh-CN",
    label: "简体中文",
    openGraphLocale: "zh_CN",
    title: "GeoPrizm | 双边关系看板",
    description: "基于 GDELT 结构化新闻事件数据，追踪主要国家双边关系指数，并用 AI 辅助解释趋势变化线索。",
    ogTitle: "GeoPrizm 双边关系看板",
    ogDescription: "从全球新闻信号追踪双边关系趋势，查看 0-100 关系指数、趋势段和中文 AI 解读。",
    socialAlt: "GeoPrizm 双边关系趋势看板"
  },
  en: {
    htmlLang: "en",
    label: "English",
    openGraphLocale: "en_US",
    title: "GeoPrizm | Bilateral Relations Dashboard",
    description: "Track bilateral relationship indexes for major countries with GDELT global news event signals and AI-assisted trend notes.",
    ogTitle: "GeoPrizm Bilateral Relations Dashboard",
    ogDescription: "Track 0-100 relationship indexes, trend segments, and evidence from global news signals.",
    socialAlt: "GeoPrizm bilateral relations trend dashboard"
  },
  ja: {
    htmlLang: "ja",
    label: "日本語",
    openGraphLocale: "ja_JP",
    title: "GeoPrizm | 二国間関係ダッシュボード",
    description: "GDELT の世界ニュースイベント信号をもとに、主要国の二国間関係指数とトレンドの変化を追跡します。",
    ogTitle: "GeoPrizm 二国間関係ダッシュボード",
    ogDescription: "0-100 の関係指数、トレンド区間、ニュース上の根拠をまとめて確認できます。",
    socialAlt: "GeoPrizm 二国間関係トレンドダッシュボード"
  },
  "zh-TW": {
    htmlLang: "zh-TW",
    label: "繁體中文",
    openGraphLocale: "zh_TW",
    title: "GeoPrizm | 雙邊關係看板",
    description: "基於 GDELT 結構化新聞事件資料，追蹤主要國家的雙邊關係指數，並用 AI 輔助整理趨勢變化線索。",
    ogTitle: "GeoPrizm 雙邊關係看板",
    ogDescription: "從全球新聞信號追蹤雙邊關係趨勢，查看 0-100 關係指數、趨勢區段與 AI 解讀。",
    socialAlt: "GeoPrizm 雙邊關係趨勢看板"
  },
  ko: {
    htmlLang: "ko",
    label: "한국어",
    openGraphLocale: "ko_KR",
    title: "GeoPrizm | 양자 관계 대시보드",
    description: "GDELT 글로벌 뉴스 이벤트 신호를 바탕으로 주요 국가의 양자 관계 지수와 추세 변화를 추적합니다.",
    ogTitle: "GeoPrizm 양자 관계 대시보드",
    ogDescription: "0-100 관계 지수, 추세 구간, 글로벌 뉴스 근거를 함께 확인합니다.",
    socialAlt: "GeoPrizm 양자 관계 추세 대시보드"
  }
};

const objectNames: Record<string, TranslationMap> = {
  chn: { "zh-CN": "中国", en: "China", ja: "中国", "zh-TW": "中國", ko: "중국" },
  usa: { "zh-CN": "美国", en: "United States", ja: "米国", "zh-TW": "美國", ko: "미국" },
  rus: { "zh-CN": "俄罗斯", en: "Russia", ja: "ロシア", "zh-TW": "俄羅斯", ko: "러시아" },
  europe: { "zh-CN": "欧洲", en: "Europe", ja: "欧州", "zh-TW": "歐洲", ko: "유럽" },
  jpn: { "zh-CN": "日本", en: "Japan", ja: "日本", "zh-TW": "日本", ko: "일본" },
  ind: { "zh-CN": "印度", en: "India", ja: "インド", "zh-TW": "印度", ko: "인도" },
  irn: { "zh-CN": "伊朗", en: "Iran", ja: "イラン", "zh-TW": "伊朗", ko: "이란" },
  twn: { "zh-CN": "中国台湾", en: "Taiwan", ja: "台湾", "zh-TW": "台灣", ko: "대만" },
  ukr: { "zh-CN": "乌克兰", en: "Ukraine", ja: "ウクライナ", "zh-TW": "烏克蘭", ko: "우크라이나" }
};

export function isLocale(value: string | null | undefined): value is Locale {
  return supportedLocales.includes(value as Locale);
}

export function localeFromSegment(value: string | null | undefined): Locale | null {
  if (!value) {
    return null;
  }
  const decoded = decodeURIComponent(value);
  return isLocale(decoded) ? decoded : null;
}

export function localeFromPathname(pathname: string): Locale {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return localeFromSegment(firstSegment) ?? defaultLocale;
}

export function localePrefix(locale: Locale): string {
  return locale === defaultLocale ? "" : `/${locale}`;
}

export function localizedPath(locale: Locale, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath === "/") {
    return localePrefix(locale) || "/";
  }
  return `${localePrefix(locale)}${normalizedPath}`;
}

export function localizedUrl(locale: Locale, path: string): string {
  return new URL(localizedPath(locale, path), siteUrl).toString();
}

export function languageAlternates(path: string): Record<string, string> {
  return {
    "zh-CN": localizedUrl("zh-CN", path),
    en: localizedUrl("en", path),
    ja: localizedUrl("ja", path),
    "zh-TW": localizedUrl("zh-TW", path),
    ko: localizedUrl("ko", path),
    "x-default": localizedUrl("zh-CN", path)
  };
}

export function getObjectName(locale: Locale, objectId: string): string {
  return objectNames[objectId]?.[locale] ?? objectId.toUpperCase();
}

export function pairLocalizedName(locale: Locale, pairId: string): string {
  const [left, right] = pairId.split("_");
  const separator = locale === "en" ? "-" : locale === "ko" ? " / " : " / ";
  return [getObjectName(locale, left), getObjectName(locale, right)].join(separator);
}

export function relationshipStatusLabel(locale: Locale, value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return getDashboardCopy(locale).status.waitingData;
  }
  const labels = getDashboardCopy(locale).status;
  if (value >= 70) {
    return labels.strongFriendly;
  }
  if (value >= 55) {
    return labels.friendly;
  }
  if (value > 45) {
    return labels.neutral;
  }
  if (value >= 35) {
    return labels.tense;
  }
  return labels.strongTense;
}

export function changeDirectionLabel(locale: Locale, direction: string): string {
  const copy = getDashboardCopy(locale).change;
  if (direction === "改善") {
    return copy.improve;
  }
  if (direction === "恶化") {
    return copy.worsen;
  }
  return copy.stable;
}

export function getDashboardCopy(locale: Locale) {
  return dashboardCopies[locale];
}

export type DashboardCopy = (typeof dashboardCopies)[Locale];

const dashboardCopies = {
  "zh-CN": {
    status: {
      waitingData: "等待数据",
      strongFriendly: "明显偏友好",
      friendly: "偏友好",
      neutral: "接近中性",
      tense: "偏紧张",
      strongTense: "明显偏紧张",
      observing: "观察中"
    },
    change: { improve: "改善", worsen: "恶化", stable: "平稳" },
    topbar: {
      subtitleStrong: "双边关系看板",
      subtitleRest: "基于全球新闻信号，追踪主要国家双边关系动态",
      signalsLabel: "产品信号",
      dataSignal: "GDELT / CAMEO 新闻信号",
      aiSignal: "中文 AI 趋势解读",
      collapseActions: "收起联系入口",
      expandActions: "展开联系入口",
      projectLinks: "项目链接",
      githubAria: "在 GitHub 查看项目",
      emailAria: "发送邮件到 helioshulk@gmail.com",
      wechatAria: "打开微信公众号二维码",
      wechat: "微信",
      languageSelector: "选择语言",
      languageCurrent: "当前",
      statusAria: "项目状态摘要",
      latestData: "最新数据：",
      waitingCache: "等待缓存数据",
      wechatTitle: "微信公众号",
      wechatDescription: "扫码关注项目更新",
      closeWechat: "关闭微信公众号二维码",
      qrAlt: "微信公众号二维码"
    },
    notices: {
      slow: "数据加载较慢，请稍后或重试。",
      apiFailed: (error: string) => `API 加载失败：${error}`,
      stale: "数据可能不是最新。",
      configInsufficient: "候选对象配置不足，暂时无法选择关系组合。",
      noData: "当前组合暂无足够事件数据。",
      insufficient: "数据积累不足，趋势仅供参考。",
      noTurningPoints: "近 90 天未检测到明显趋势段。",
      retry: "重试"
    },
    featuredAria: "重点关系",
    method: {
      title: "数据来源与方法说明",
      lead: "关系指数基于全球新闻报道计算，反映媒体对两国关系的信号，不代表官方外交立场。",
      indexTitle: "指数是怎么来的",
      indexBody: "每天从全球新闻数据库中抓取涉及两国的报道，识别其中的合作或冲突信号，按报道热度加权后映射为 0-100 的指数。50 为中性，高于 50 偏友好，低于 50 偏紧张。用 14 天滚动平均展示，以平滑单日波动。",
      aiTitle: "AI 做了什么",
      aiBody: "AI 根据新闻标题和摘要，自动生成关系变化的中文解读，帮你快速理解指数背后发生了什么。它只负责总结，不判断事件的确切因果，也不读取新闻全文。",
      noteTitle: "使用前须知",
      notePrefix: "指数反映的是“媒体在重点报道什么”，不等于两国关系的实际状态。重大事件密集报道时，指数可能出现短期大幅波动。数据方法参考",
      and: "与",
      cameoLink: "CAMEO 事件编码框架",
      noteSuffix: "。"
    },
    footer: {
      aria: "站点导航",
      product: "GeoPrizm 是一个基于公开新闻事件数据的双边关系指数看板。",
      home: "首页",
      about: "关于",
      methodology: "方法说明",
      privacy: "隐私政策",
      contact: "联系方式",
      disclaimer: "免责声明",
      github: "GitHub 开源项目"
    },
    seoBrief: {
      aria: (name: string) => `${name}关系摘要`,
      kicker: (englishName: string) => `${englishName} Relations Index`,
      title: (name: string) => `${name}关系摘要`,
      currentIndex: "当前指数",
      updated: "更新日期",
      open: "查看摘要",
      close: "收起摘要",
      indexTitle: (name: string) => `${name}关系指数`,
      status: "状态",
      dataRange: "数据区间",
      days90: "近 90 天",
      range: (start: string, end: string) => `${start} 至 ${end}`,
      waiting: "等待数据"
    },
    card: {
      index: "指数",
      view: "查看",
      sparklineAria: "迷你趋势线",
      aria: (pairName: string, temperature: string, status: string, delta: string) =>
        `${pairName}，指数 ${temperature}，${status}，${delta}，查看分析`
    },
    chart: {
      panelAria: "关系指数趋势图",
      selectorAria: "国家对选择器",
      rangeAria: "图表范围",
      rangeDays: (days: number) => `${days}日`,
      noDataTitle: "暂无数据",
      trendContext: "关系指数趋势",
      waitingCache: "等待缓存数据",
      scoreDate: (date: string | null) => date ? `${date}日指数` : "等待数据",
      sideLabels: { high: "友好", middle: "中性", low: "对立" },
      legendAria: "图表颜色说明",
      legendImprove: "红色：改善或偏友好",
      legendNeutral: "50：中性线",
      legendWorsen: "蓝色：恶化或偏紧张",
      readingNote: "点高亮段查看解释，指数反映媒体报道信号。",
      copied: "已复制",
      copyFailed: "复制失败",
      share: "分享",
      currentSegment: "当前趋势段",
      viewExplanation: "查看解释",
      indexTooltip: (value: string) => `指数 ${value}`
    },
    explanation: {
      title: "趋势段解释",
      noData: "当前组合暂无足够事件数据。",
      clickSegment: "点击趋势线上的高亮线段查看趋势解释。",
      noTurningPoints: "近 90 天未检测到明显趋势段。",
      directionTitle: (direction: string) => direction === "改善" ? "关系改善" : "关系恶化",
      mainLine: "主线",
      tabsAria: "解释器内容",
      analysis: "趋势解读",
      reports: "相关报道",
      generating: "解读生成中，当前先显示规则版解释。",
      evidence: "证据线索",
      evidenceAria: "证据线索",
      retry: "重试",
      generate: "生成",
      aiMissingKey: "AI 服务暂未配置，当前先显示规则版解释。",
      aiError: "AI 解读生成失败，当前先显示规则版解释。",
      aiNotReady: "AI 解读尚未生成，当前先显示规则版解释。",
      aiRequestFailed: "解读生成失败，已保留规则版解释。",
      loading: "加载中..."
    },
    dailyDelta: {
      empty: "较昨日 --",
      flat: "较昨日 持平",
      prefix: "较昨日 "
    },
    dates: {
      range: (startDate: string, endDate: string) => {
        const [startYear] = startDate.split("-");
        const [endYear, endMonth, endDay] = endDate.split("-");
        if (startYear === endYear && endMonth && endDay) {
          return `${startDate} 至 ${endMonth}-${endDay}`;
        }
        return `${startDate} 至 ${endDate}`;
      }
    },
    report: {
      fallbackTitle: (domain: string) => `${domain} 相关报道`,
      sourceFallback: "来源网站"
    },
    seo: {
      homePath: "/"
    }
  },
  en: {
    status: {
      waitingData: "Waiting for data",
      strongFriendly: "Clearly friendly",
      friendly: "Leaning friendly",
      neutral: "Near neutral",
      tense: "Leaning tense",
      strongTense: "Clearly tense",
      observing: "Monitoring"
    },
    change: { improve: "Improvement", worsen: "Deterioration", stable: "Stable" },
    topbar: {
      subtitleStrong: "Bilateral relations dashboard",
      subtitleRest: "Track major country relationships through global news signals",
      signalsLabel: "Product signals",
      dataSignal: "GDELT / CAMEO news signals",
      aiSignal: "AI trend notes",
      collapseActions: "Collapse contact links",
      expandActions: "Expand contact links",
      projectLinks: "Project links",
      githubAria: "View the project on GitHub",
      emailAria: "Send email to helioshulk@gmail.com",
      wechatAria: "Open WeChat QR code",
      wechat: "WeChat",
      languageSelector: "Choose language",
      languageCurrent: "Current",
      statusAria: "Project status summary",
      latestData: "Latest data:",
      waitingCache: "Waiting for cached data",
      wechatTitle: "WeChat",
      wechatDescription: "Scan to follow project updates",
      closeWechat: "Close WeChat QR code",
      qrAlt: "WeChat QR code"
    },
    notices: {
      slow: "Data is taking longer than usual. Please wait or retry.",
      apiFailed: (error: string) => `API request failed: ${error}`,
      stale: "Data may not be the latest version.",
      configInsufficient: "Not enough candidate objects are configured to select a relationship pair.",
      noData: "There is not enough event data for this pair yet.",
      insufficient: "The data window is still thin, so treat this trend as directional.",
      noTurningPoints: "No significant trend segment was detected in the last 90 days.",
      retry: "Retry"
    },
    featuredAria: "Featured relationships",
    method: {
      title: "Data Source and Method",
      lead: "The relationship index is calculated from global news reports. It reflects media event signals, not an official diplomatic position.",
      indexTitle: "How the index is built",
      indexBody: "Each day GeoPrizm reads global news event data for the selected pair, identifies cooperation or conflict signals, weights them by coverage intensity, and maps them to a 0-100 index. 50 is neutral; higher values lean friendly, lower values lean tense. A 14-day rolling average reduces single-day noise.",
      aiTitle: "What AI does",
      aiBody: "AI summarizes news titles and snippets to explain what may be behind a relationship change. It helps you read the trend faster, but it does not decide causality or replace diplomatic analysis.",
      noteTitle: "Before you use it",
      notePrefix: "The index reflects what global media is reporting, not the full state of bilateral relations. Heavy coverage around major events can cause short-term swings. The method references",
      and: "and",
      cameoLink: "the CAMEO event coding framework",
      noteSuffix: "."
    },
    footer: {
      aria: "Site navigation",
      product: "GeoPrizm is a bilateral relations index dashboard built from public news event data.",
      home: "Home",
      about: "About",
      methodology: "Methodology",
      privacy: "Privacy",
      contact: "Contact",
      disclaimer: "Disclaimer",
      github: "Open source on GitHub"
    },
    seoBrief: {
      aria: (name: string) => `${name} relations summary`,
      kicker: (englishName: string) => `${englishName} Relations Index`,
      title: (name: string) => `${name} relations summary`,
      currentIndex: "Current index",
      updated: "Updated",
      open: "View summary",
      close: "Hide summary",
      indexTitle: (name: string) => `${name} relations index`,
      status: "Status",
      dataRange: "Data range",
      days90: "Last 90 days",
      range: (start: string, end: string) => `${start} to ${end}`,
      waiting: "Waiting for data"
    },
    card: {
      index: "Index",
      view: "View",
      sparklineAria: "Mini trend line",
      aria: (pairName: string, temperature: string, status: string, delta: string) =>
        `${pairName}, index ${temperature}, ${status}, ${delta}, view analysis`
    },
    chart: {
      panelAria: "Relationship index trend chart",
      selectorAria: "Country pair selector",
      rangeAria: "Chart range",
      rangeDays: (days: number) => `${days}d`,
      noDataTitle: "No data",
      trendContext: "relationship index trend",
      waitingCache: "Waiting for cached data",
      scoreDate: (date: string | null) => date ? `Index on ${date}` : "Waiting for data",
      sideLabels: { high: "Friendly", middle: "Neutral", low: "Adversarial" },
      legendAria: "Chart color guide",
      legendImprove: "Red: improving or friendly",
      legendNeutral: "50: neutral line",
      legendWorsen: "Blue: worsening or tense",
      readingNote: "Select a highlighted segment for the explanation. The index reflects media signals.",
      copied: "Copied",
      copyFailed: "Copy failed",
      share: "Share",
      currentSegment: "Current segment",
      viewExplanation: "View explanation",
      indexTooltip: (value: string) => `Index ${value}`
    },
    explanation: {
      title: "Trend segment explanation",
      noData: "There is not enough event data for this pair yet.",
      clickSegment: "Select a highlighted segment on the trend line to read the explanation.",
      noTurningPoints: "No significant trend segment was detected in the last 90 days.",
      directionTitle: (direction: string) => direction === "改善" ? "Relationship improved" : "Relationship worsened",
      mainLine: "Main thread",
      tabsAria: "Explanation content",
      analysis: "Trend note",
      reports: "Related reports",
      generating: "Generating the note. Showing the rule-based explanation for now.",
      evidence: "Evidence signals",
      evidenceAria: "Evidence signals",
      retry: "Retry",
      generate: "Generate",
      aiMissingKey: "AI is not configured yet. Showing the rule-based explanation for now.",
      aiError: "AI generation failed. Showing the rule-based explanation for now.",
      aiNotReady: "AI explanation is not ready yet. Showing the rule-based explanation for now.",
      aiRequestFailed: "Explanation generation failed. The rule-based version is still shown.",
      loading: "Loading..."
    },
    dailyDelta: {
      empty: "vs yesterday --",
      flat: "vs yesterday flat",
      prefix: "vs yesterday "
    },
    dates: {
      range: (startDate: string, endDate: string) => `${startDate} to ${endDate}`
    },
    report: {
      fallbackTitle: (domain: string) => `Related report from ${domain}`,
      sourceFallback: "source"
    },
    seo: {
      homePath: "/en"
    }
  },
  ja: {
    status: {
      waitingData: "データ待ち",
      strongFriendly: "明確に友好的",
      friendly: "やや友好的",
      neutral: "中立に近い",
      tense: "やや緊張",
      strongTense: "明確に緊張",
      observing: "観測中"
    },
    change: { improve: "改善", worsen: "悪化", stable: "横ばい" },
    topbar: {
      subtitleStrong: "二国間関係ダッシュボード",
      subtitleRest: "世界のニュース信号から主要国間の関係変化を追跡",
      signalsLabel: "プロダクト信号",
      dataSignal: "GDELT / CAMEO ニュース信号",
      aiSignal: "AI トレンド解説",
      collapseActions: "連絡先を閉じる",
      expandActions: "連絡先を開く",
      projectLinks: "プロジェクトリンク",
      githubAria: "GitHub でプロジェクトを見る",
      emailAria: "helioshulk@gmail.com にメールを送る",
      wechatAria: "WeChat QR コードを開く",
      wechat: "WeChat",
      languageSelector: "言語を選択",
      languageCurrent: "現在",
      statusAria: "プロジェクト状態",
      latestData: "最新データ:",
      waitingCache: "キャッシュデータ待ち",
      wechatTitle: "WeChat",
      wechatDescription: "スキャンして更新をフォロー",
      closeWechat: "WeChat QR コードを閉じる",
      qrAlt: "WeChat QR コード"
    },
    notices: {
      slow: "データ読み込みに時間がかかっています。少し待つか再試行してください。",
      apiFailed: (error: string) => `API 読み込み失敗: ${error}`,
      stale: "データが最新ではない可能性があります。",
      configInsufficient: "候補オブジェクトが不足しているため、関係ペアを選択できません。",
      noData: "この組み合わせには十分なイベントデータがまだありません。",
      insufficient: "データ量が少ないため、トレンドは参考値として見てください。",
      noTurningPoints: "過去 90 日に明確なトレンド区間は検出されませんでした。",
      retry: "再試行"
    },
    featuredAria: "注目の関係",
    method: {
      title: "データソースと方法",
      lead: "関係指数は世界のニュース報道から計算されます。メディア上のイベント信号を示すもので、公式な外交立場ではありません。",
      indexTitle: "指数の作り方",
      indexBody: "GeoPrizm は毎日、選択した二国間に関する世界のニュースイベントデータを読み取り、協力または対立の信号を抽出し、報道量で重み付けして 0-100 の指数に変換します。50 が中立で、高いほど友好的、低いほど緊張を示します。14 日移動平均で単日のノイズを抑えます。",
      aiTitle: "AI の役割",
      aiBody: "AI はニュースのタイトルと概要をもとに、関係変化の背景を短く整理します。トレンドを早く読むための補助であり、因果関係を断定したり外交判断を代替したりするものではありません。",
      noteTitle: "利用前の注意",
      notePrefix: "指数は世界のメディアが何を重点的に報じているかを反映します。二国間関係の全体像そのものではありません。大きな事件が集中して報じられると短期的な変動が大きくなる場合があります。方法は",
      and: "と",
      cameoLink: "CAMEO イベントコード体系",
      noteSuffix: "を参照しています。"
    },
    footer: {
      aria: "サイトナビゲーション",
      product: "GeoPrizm は公開ニュースイベントデータをもとにした二国間関係指数ダッシュボードです。",
      home: "ホーム",
      about: "概要",
      methodology: "方法",
      privacy: "プライバシー",
      contact: "連絡先",
      disclaimer: "免責事項",
      github: "GitHub オープンソース"
    },
    seoBrief: {
      aria: (name: string) => `${name}関係サマリー`,
      kicker: (englishName: string) => `${englishName} Relations Index`,
      title: (name: string) => `${name}関係サマリー`,
      currentIndex: "現在の指数",
      updated: "更新日",
      open: "サマリーを見る",
      close: "サマリーを閉じる",
      indexTitle: (name: string) => `${name}関係指数`,
      status: "状態",
      dataRange: "データ範囲",
      days90: "過去 90 日",
      range: (start: string, end: string) => `${start} から ${end}`,
      waiting: "データ待ち"
    },
    card: {
      index: "指数",
      view: "見る",
      sparklineAria: "ミニトレンド線",
      aria: (pairName: string, temperature: string, status: string, delta: string) =>
        `${pairName}、指数 ${temperature}、${status}、${delta}、分析を見る`
    },
    chart: {
      panelAria: "関係指数トレンド図",
      selectorAria: "国・地域ペア選択",
      rangeAria: "表示期間",
      rangeDays: (days: number) => `${days}日`,
      noDataTitle: "データなし",
      trendContext: "関係指数トレンド",
      waitingCache: "キャッシュデータ待ち",
      scoreDate: (date: string | null) => date ? `${date} の指数` : "データ待ち",
      sideLabels: { high: "友好", middle: "中立", low: "対立" },
      legendAria: "色の説明",
      legendImprove: "赤: 改善または友好的",
      legendNeutral: "50: 中立線",
      legendWorsen: "青: 悪化または緊張",
      readingNote: "ハイライト区間を選ぶと説明を表示します。指数はメディア報道信号を反映します。",
      copied: "コピー済み",
      copyFailed: "コピー失敗",
      share: "共有",
      currentSegment: "現在の区間",
      viewExplanation: "説明を見る",
      indexTooltip: (value: string) => `指数 ${value}`
    },
    explanation: {
      title: "トレンド区間の説明",
      noData: "この組み合わせには十分なイベントデータがまだありません。",
      clickSegment: "トレンド線のハイライト区間を選ぶと説明を表示します。",
      noTurningPoints: "過去 90 日に明確なトレンド区間は検出されませんでした。",
      directionTitle: (direction: string) => direction === "改善" ? "関係改善" : "関係悪化",
      mainLine: "主線",
      tabsAria: "説明内容",
      analysis: "トレンド解説",
      reports: "関連報道",
      generating: "解説を生成中です。現在はルールベースの説明を表示しています。",
      evidence: "根拠となる信号",
      evidenceAria: "根拠となる信号",
      retry: "再試行",
      generate: "生成",
      aiMissingKey: "AI はまだ設定されていません。現在はルールベースの説明を表示しています。",
      aiError: "AI 解説の生成に失敗しました。現在はルールベースの説明を表示しています。",
      aiNotReady: "AI 解説はまだ生成されていません。現在はルールベースの説明を表示しています。",
      aiRequestFailed: "解説生成に失敗しました。ルールベースの説明を表示しています。",
      loading: "読み込み中..."
    },
    dailyDelta: {
      empty: "前日比 --",
      flat: "前日比 横ばい",
      prefix: "前日比 "
    },
    dates: {
      range: (startDate: string, endDate: string) => `${startDate} から ${endDate}`
    },
    report: {
      fallbackTitle: (domain: string) => `${domain} の関連報道`,
      sourceFallback: "情報源"
    },
    seo: {
      homePath: "/ja"
    }
  },
  "zh-TW": {
    status: {
      waitingData: "等待資料",
      strongFriendly: "明顯偏友好",
      friendly: "偏友好",
      neutral: "接近中性",
      tense: "偏緊張",
      strongTense: "明顯偏緊張",
      observing: "觀察中"
    },
    change: { improve: "改善", worsen: "惡化", stable: "平穩" },
    topbar: {
      subtitleStrong: "雙邊關係看板",
      subtitleRest: "基於全球新聞信號，追蹤主要國家雙邊關係動態",
      signalsLabel: "產品信號",
      dataSignal: "GDELT / CAMEO 新聞信號",
      aiSignal: "中文 AI 趨勢解讀",
      collapseActions: "收起聯絡入口",
      expandActions: "展開聯絡入口",
      projectLinks: "專案連結",
      githubAria: "在 GitHub 查看專案",
      emailAria: "寄信到 helioshulk@gmail.com",
      wechatAria: "打開微信公眾號 QR Code",
      wechat: "微信",
      languageSelector: "選擇語言",
      languageCurrent: "目前",
      statusAria: "專案狀態摘要",
      latestData: "最新資料：",
      waitingCache: "等待快取資料",
      wechatTitle: "微信公眾號",
      wechatDescription: "掃碼關注專案更新",
      closeWechat: "關閉微信公眾號 QR Code",
      qrAlt: "微信公眾號 QR Code"
    },
    notices: {
      slow: "資料載入較慢，請稍後或重試。",
      apiFailed: (error: string) => `API 載入失敗：${error}`,
      stale: "資料可能不是最新。",
      configInsufficient: "候選對象設定不足，暫時無法選擇關係組合。",
      noData: "目前組合暫無足夠事件資料。",
      insufficient: "資料累積不足，趨勢僅供參考。",
      noTurningPoints: "近 90 天未偵測到明顯趨勢區段。",
      retry: "重試"
    },
    featuredAria: "重點關係",
    method: {
      title: "資料來源與方法說明",
      lead: "關係指數基於全球新聞報導計算，反映媒體對兩國關係的信號，不代表官方外交立場。",
      indexTitle: "指數是怎麼來的",
      indexBody: "每天從全球新聞資料庫中擷取涉及兩國的報導，辨識其中的合作或衝突信號，按報導熱度加權後映射為 0-100 的指數。50 為中性，高於 50 偏友好，低於 50 偏緊張。用 14 天滾動平均展示，以平滑單日波動。",
      aiTitle: "AI 做了什麼",
      aiBody: "AI 根據新聞標題和摘要，自動生成關係變化的中文解讀，幫你快速理解指數背後發生了什麼。它只負責總結，不判斷事件的確切因果，也不讀取新聞全文。",
      noteTitle: "使用前須知",
      notePrefix: "指數反映的是「媒體在重點報導什麼」，不等於兩國關係的實際狀態。重大事件密集報導時，指數可能出現短期大幅波動。資料方法參考",
      and: "與",
      cameoLink: "CAMEO 事件編碼框架",
      noteSuffix: "。"
    },
    footer: {
      aria: "站點導覽",
      product: "GeoPrizm 是基於公開新聞事件資料的雙邊關係指數看板。",
      home: "首頁",
      about: "關於",
      methodology: "方法說明",
      privacy: "隱私政策",
      contact: "聯絡方式",
      disclaimer: "免責聲明",
      github: "GitHub 開源專案"
    },
    seoBrief: {
      aria: (name: string) => `${name}關係摘要`,
      kicker: (englishName: string) => `${englishName} Relations Index`,
      title: (name: string) => `${name}關係摘要`,
      currentIndex: "目前指數",
      updated: "更新日期",
      open: "查看摘要",
      close: "收起摘要",
      indexTitle: (name: string) => `${name}關係指數`,
      status: "狀態",
      dataRange: "資料區間",
      days90: "近 90 天",
      range: (start: string, end: string) => `${start} 至 ${end}`,
      waiting: "等待資料"
    },
    card: {
      index: "指數",
      view: "查看",
      sparklineAria: "迷你趨勢線",
      aria: (pairName: string, temperature: string, status: string, delta: string) =>
        `${pairName}，指數 ${temperature}，${status}，${delta}，查看分析`
    },
    chart: {
      panelAria: "關係指數趨勢圖",
      selectorAria: "國家對選擇器",
      rangeAria: "圖表範圍",
      rangeDays: (days: number) => `${days}日`,
      noDataTitle: "暫無資料",
      trendContext: "關係指數趨勢",
      waitingCache: "等待快取資料",
      scoreDate: (date: string | null) => date ? `${date}日指數` : "等待資料",
      sideLabels: { high: "友好", middle: "中性", low: "對立" },
      legendAria: "圖表顏色說明",
      legendImprove: "紅色：改善或偏友好",
      legendNeutral: "50：中性線",
      legendWorsen: "藍色：惡化或偏緊張",
      readingNote: "點選高亮區段查看解釋，指數反映媒體報導信號。",
      copied: "已複製",
      copyFailed: "複製失敗",
      share: "分享",
      currentSegment: "目前趨勢區段",
      viewExplanation: "查看解釋",
      indexTooltip: (value: string) => `指數 ${value}`
    },
    explanation: {
      title: "趨勢區段解釋",
      noData: "目前組合暫無足夠事件資料。",
      clickSegment: "點選趨勢線上的高亮線段查看趨勢解釋。",
      noTurningPoints: "近 90 天未偵測到明顯趨勢區段。",
      directionTitle: (direction: string) => direction === "改善" ? "關係改善" : "關係惡化",
      mainLine: "主線",
      tabsAria: "解釋器內容",
      analysis: "趨勢解讀",
      reports: "相關報導",
      generating: "解讀生成中，目前先顯示規則版解釋。",
      evidence: "證據線索",
      evidenceAria: "證據線索",
      retry: "重試",
      generate: "生成",
      aiMissingKey: "AI 服務尚未設定，目前先顯示規則版解釋。",
      aiError: "AI 解讀生成失敗，目前先顯示規則版解釋。",
      aiNotReady: "AI 解讀尚未生成，目前先顯示規則版解釋。",
      aiRequestFailed: "解讀生成失敗，已保留規則版解釋。",
      loading: "載入中..."
    },
    dailyDelta: {
      empty: "較昨日 --",
      flat: "較昨日 持平",
      prefix: "較昨日 "
    },
    dates: {
      range: (startDate: string, endDate: string) => {
        const [startYear] = startDate.split("-");
        const [endYear, endMonth, endDay] = endDate.split("-");
        if (startYear === endYear && endMonth && endDay) {
          return `${startDate} 至 ${endMonth}-${endDay}`;
        }
        return `${startDate} 至 ${endDate}`;
      }
    },
    report: {
      fallbackTitle: (domain: string) => `${domain} 相關報導`,
      sourceFallback: "來源網站"
    },
    seo: {
      homePath: "/zh-TW"
    }
  },
  ko: {
    status: {
      waitingData: "데이터 대기 중",
      strongFriendly: "뚜렷한 우호",
      friendly: "우호 쪽",
      neutral: "중립에 가까움",
      tense: "긴장 쪽",
      strongTense: "뚜렷한 긴장",
      observing: "관찰 중"
    },
    change: { improve: "개선", worsen: "악화", stable: "안정" },
    topbar: {
      subtitleStrong: "양자 관계 대시보드",
      subtitleRest: "글로벌 뉴스 신호로 주요 국가 관계의 변화를 추적",
      signalsLabel: "제품 신호",
      dataSignal: "GDELT / CAMEO 뉴스 신호",
      aiSignal: "AI 추세 해설",
      collapseActions: "연락처 접기",
      expandActions: "연락처 펼치기",
      projectLinks: "프로젝트 링크",
      githubAria: "GitHub에서 프로젝트 보기",
      emailAria: "helioshulk@gmail.com으로 이메일 보내기",
      wechatAria: "WeChat QR 코드 열기",
      wechat: "WeChat",
      languageSelector: "언어 선택",
      languageCurrent: "현재",
      statusAria: "프로젝트 상태 요약",
      latestData: "최신 데이터:",
      waitingCache: "캐시 데이터 대기 중",
      wechatTitle: "WeChat",
      wechatDescription: "스캔하여 프로젝트 업데이트 팔로우",
      closeWechat: "WeChat QR 코드 닫기",
      qrAlt: "WeChat QR 코드"
    },
    notices: {
      slow: "데이터 로딩이 조금 오래 걸립니다. 잠시 기다리거나 다시 시도하세요.",
      apiFailed: (error: string) => `API 로딩 실패: ${error}`,
      stale: "데이터가 최신이 아닐 수 있습니다.",
      configInsufficient: "후보 객체 설정이 부족해 관계 조합을 선택할 수 없습니다.",
      noData: "현재 조합에는 충분한 이벤트 데이터가 아직 없습니다.",
      insufficient: "데이터가 충분히 쌓이지 않아 추세는 참고용입니다.",
      noTurningPoints: "최근 90일 동안 뚜렷한 추세 구간이 감지되지 않았습니다.",
      retry: "다시 시도"
    },
    featuredAria: "주요 관계",
    method: {
      title: "데이터 출처와 방법",
      lead: "관계 지수는 글로벌 뉴스 보도를 바탕으로 계산됩니다. 이는 언론 이벤트 신호를 반영하며 공식 외교 입장을 뜻하지 않습니다.",
      indexTitle: "지수 산출 방식",
      indexBody: "GeoPrizm은 매일 선택한 두 국가와 관련된 글로벌 뉴스 이벤트 데이터를 읽고, 협력 또는 충돌 신호를 식별한 뒤 보도 강도로 가중해 0-100 지수로 변환합니다. 50은 중립이며, 높을수록 우호 쪽, 낮을수록 긴장 쪽입니다. 14일 이동평균으로 하루 단위 노이즈를 줄입니다.",
      aiTitle: "AI가 하는 일",
      aiBody: "AI는 뉴스 제목과 요약을 바탕으로 관계 변화의 배경을 짧게 정리합니다. 추세를 빠르게 읽기 위한 보조 기능이며, 인과관계를 단정하거나 외교 판단을 대체하지 않습니다.",
      noteTitle: "사용 전 참고",
      notePrefix: "이 지수는 글로벌 언론이 무엇을 집중적으로 보도하는지를 반영합니다. 양자 관계의 전체 실제 상태와 같지는 않습니다. 주요 사건 보도가 집중되면 단기 변동이 커질 수 있습니다. 방법은",
      and: "및",
      cameoLink: "CAMEO 이벤트 코딩 프레임워크",
      noteSuffix: "를 참고합니다."
    },
    footer: {
      aria: "사이트 탐색",
      product: "GeoPrizm은 공개 뉴스 이벤트 데이터를 기반으로 한 양자 관계 지수 대시보드입니다.",
      home: "홈",
      about: "소개",
      methodology: "방법론",
      privacy: "개인정보처리방침",
      contact: "연락처",
      disclaimer: "면책 조항",
      github: "GitHub 오픈소스"
    },
    seoBrief: {
      aria: (name: string) => `${name} 관계 요약`,
      kicker: (englishName: string) => `${englishName} Relations Index`,
      title: (name: string) => `${name} 관계 요약`,
      currentIndex: "현재 지수",
      updated: "업데이트",
      open: "요약 보기",
      close: "요약 접기",
      indexTitle: (name: string) => `${name} 관계 지수`,
      status: "상태",
      dataRange: "데이터 범위",
      days90: "최근 90일",
      range: (start: string, end: string) => `${start} ~ ${end}`,
      waiting: "데이터 대기 중"
    },
    card: {
      index: "지수",
      view: "보기",
      sparklineAria: "미니 추세선",
      aria: (pairName: string, temperature: string, status: string, delta: string) =>
        `${pairName}, 지수 ${temperature}, ${status}, ${delta}, 분석 보기`
    },
    chart: {
      panelAria: "관계 지수 추세 차트",
      selectorAria: "국가 조합 선택",
      rangeAria: "차트 기간",
      rangeDays: (days: number) => `${days}일`,
      noDataTitle: "데이터 없음",
      trendContext: "관계 지수 추세",
      waitingCache: "캐시 데이터 대기 중",
      scoreDate: (date: string | null) => date ? `${date} 지수` : "데이터 대기 중",
      sideLabels: { high: "우호", middle: "중립", low: "대립" },
      legendAria: "차트 색상 안내",
      legendImprove: "빨강: 개선 또는 우호",
      legendNeutral: "50: 중립선",
      legendWorsen: "파랑: 악화 또는 긴장",
      readingNote: "강조된 구간을 선택하면 설명을 볼 수 있습니다. 지수는 언론 보도 신호를 반영합니다.",
      copied: "복사됨",
      copyFailed: "복사 실패",
      share: "공유",
      currentSegment: "현재 추세 구간",
      viewExplanation: "설명 보기",
      indexTooltip: (value: string) => `지수 ${value}`
    },
    explanation: {
      title: "추세 구간 설명",
      noData: "현재 조합에는 충분한 이벤트 데이터가 아직 없습니다.",
      clickSegment: "추세선의 강조 구간을 선택하면 설명을 볼 수 있습니다.",
      noTurningPoints: "최근 90일 동안 뚜렷한 추세 구간이 감지되지 않았습니다.",
      directionTitle: (direction: string) => direction === "改善" ? "관계 개선" : "관계 악화",
      mainLine: "핵심 흐름",
      tabsAria: "설명 콘텐츠",
      analysis: "추세 해설",
      reports: "관련 보도",
      generating: "해설을 생성 중입니다. 현재는 규칙 기반 설명을 표시합니다.",
      evidence: "근거 신호",
      evidenceAria: "근거 신호",
      retry: "다시 시도",
      generate: "생성",
      aiMissingKey: "AI가 아직 설정되지 않았습니다. 현재는 규칙 기반 설명을 표시합니다.",
      aiError: "AI 해설 생성에 실패했습니다. 현재는 규칙 기반 설명을 표시합니다.",
      aiNotReady: "AI 해설이 아직 생성되지 않았습니다. 현재는 규칙 기반 설명을 표시합니다.",
      aiRequestFailed: "해설 생성에 실패했습니다. 규칙 기반 설명을 계속 표시합니다.",
      loading: "로딩 중..."
    },
    dailyDelta: {
      empty: "전일 대비 --",
      flat: "전일 대비 보합",
      prefix: "전일 대비 "
    },
    dates: {
      range: (startDate: string, endDate: string) => `${startDate} ~ ${endDate}`
    },
    report: {
      fallbackTitle: (domain: string) => `${domain} 관련 보도`,
      sourceFallback: "출처"
    },
    seo: {
      homePath: "/ko"
    }
  }
} as const;

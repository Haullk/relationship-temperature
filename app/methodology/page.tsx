import type { Metadata } from "next";
import Link from "next/link";

import SiteHeader from "@/components/SiteHeader";
import { readManyRelationshipCaches } from "@/lib/cache";
import { loadCandidatePool } from "@/lib/candidatePool";
import {
  getDashboardCopy,
  localeFromPathname,
  localizedSwitchPath,
  siteUrl,
  supportedLocales
} from "@/lib/i18n";

const githubUrl = "https://github.com/Haullk/relationship-temperature";
const gdeltUrl = "https://www.gdeltproject.org/";
const gdeltDataUrl = "https://www.gdeltproject.org/data.html";
const gdeltCodebookUrl = "https://data.gdeltproject.org/documentation/GDELT-Event_Codebook-V2.0.pdf";
const cameoUrl = "https://eventdata.parusanalytics.com/data.dir/cameo.html";
const goldsteinUrl = "https://web.pdx.edu/~kinsella/jgscale.html";

const methodologyUrl = new URL("/methodology", siteUrl).toString();

export const metadata: Metadata = {
  title: "GeoPrizm Methodology | GDELT 双边关系指数计算方法",
  description:
    "了解 GeoPrizm 如何使用 GDELT Event Database、CAMEO 事件类型、GoldsteinScale、报道热度加权和 14 日滚动平均计算 0-100 双边关系指数。",
  keywords: [
    "GeoPrizm methodology",
    "GDELT bilateral relations methodology",
    "bilateral relations index",
    "GoldsteinScale calculation",
    "CAMEO event data",
    "地缘政治关系指数",
    "双边关系指数计算方法"
  ],
  alternates: {
    canonical: "/methodology"
  },
  openGraph: {
    title: "GeoPrizm Methodology",
    description: "GeoPrizm 双边关系指数的数据来源、计算方法、AI 解读边界和使用限制。",
    url: methodologyUrl,
    siteName: "GeoPrizm",
    type: "article",
    locale: "zh_CN"
  },
  twitter: {
    card: "summary",
    title: "GeoPrizm Methodology",
    description: "了解 GeoPrizm 如何把 GDELT 新闻事件信号转换为 0-100 双边关系指数。"
  }
};

const tocItems = [
  { href: "#index", label: "关系指数是什么" },
  { href: "#data", label: "数据来源" },
  { href: "#calculation", label: "计算方法" },
  { href: "#ai", label: "AI 解读层" },
  { href: "#limits", label: "局限性声明" },
  { href: "#citation", label: "引用格式" }
];

const sourceLinks = [
  {
    title: "GDELT Project",
    href: gdeltUrl,
    body: "官方项目入口，用于了解 GDELT 如何从全球新闻媒体中抽取事件、主题、地点和语调信号。"
  },
  {
    title: "GDELT Data",
    href: gdeltDataUrl,
    body: "数据下载和文档入口，包含 GDELT 2.0 Event Database、GKG、BigQuery 和原始文件说明。"
  },
  {
    title: "GDELT Event Codebook 2.0",
    href: gdeltCodebookUrl,
    body: "字段级说明。GeoPrizm 使用其中的国家参与方、事件日期、GoldsteinScale 和报道热度字段。"
  },
  {
    title: "CAMEO Codebook",
    href: cameoUrl,
    body: "事件分类体系。它把声明、磋商、合作、抗议、威胁、冲突等行为编码为可计算类别。"
  }
];

const calculationSteps = [
  {
    title: "筛选双边事件",
    body: "读取候选国家对在最近 90 天内的 GDELT 事件，只保留两方国家代码同时出现且 GoldsteinScale 可用的记录。"
  },
  {
    title: "计算每日信号",
    body: "每条事件按报道热度加权。当前权重使用 log1p(max(num_mentions, num_articles, 1))，避免单个高曝光事件完全压过其他信号。"
  },
  {
    title: "平滑单日波动",
    body: "把每日加权 GoldsteinScale 放入 14 日滚动窗口，只对窗口内有事件的日期求平均。没有有效事件时回到中性基准。"
  },
  {
    title: "映射到 0-100",
    body: "滚动后的合作或冲突信号会映射为关系指数。50 是中性线，高于 50 偏友好，低于 50 偏紧张。"
  }
];

const limitations = [
  "媒体事件信号不等于官方外交现实。指数反映公开新闻报道里出现了什么，不代表两国政府的真实立场或完整互动。",
  "新闻覆盖存在地区、语言、媒体议程和突发事件偏差。高报道热度可能让短期事件在指数上显得更突出。",
  "GoldsteinScale 主要依据事件行为类别评分，同类事件在不同语境中的真实影响可能不同。",
  "AI 解读依赖标题、摘要和可访问的新闻元数据。它帮助整理线索，不判断因果，也不替代研究者阅读原始材料。"
];

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

type MethodologyPageProps = {
  searchParams: Promise<{ from?: string | string[] }>;
};

export default async function MethodologyPage({ searchParams }: MethodologyPageProps) {
  const returnHref = safeReturnHref((await searchParams).from);
  const locale = localeFromPathname(returnHref);
  const copy = getDashboardCopy(locale);
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(methodologyJsonLd) }}
      />
      <SiteHeader
        activeTab="methodology"
        copy={{ topbar: copy.topbar, nav: copy.nav }}
        dashboardHref={returnHref}
        languageOptions={languageOptions}
        latestData={latestData}
        locale={locale}
        methodologyHref={methodologyHref}
      />

      <div className="methodology-layout">
        <aside className="methodology-toc" aria-label="方法目录">
          <span>页面目录</span>
          <nav>
            {tocItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="methodology-article">
          <section className="methodology-section" id="index">
            <div className="methodology-section-heading">
              <h2>关系指数是什么</h2>
              <p>一个把新闻事件信号映射到共同标尺上的观察指标。</p>
            </div>
            <div className="index-scale" aria-label="关系指数区间说明">
              <div>
                <strong>0-45</strong>
                <span>偏紧张，冲突、批评、威胁或军事相关信号更突出。</span>
              </div>
              <div>
                <strong>45-55</strong>
                <span>接近中性，合作和摩擦信号相对平衡，或近期信号较弱。</span>
              </div>
              <div>
                <strong>55-100</strong>
                <span>偏友好，磋商、合作、援助、积极声明等信号更突出。</span>
              </div>
            </div>
            <p>
              指数的中心点是 50。它不是“关系好坏”的官方结论，而是一个方便比较的媒体事件信号标尺。读图时应同时看当前值、最近变化、趋势段解释和新闻证据。
            </p>
          </section>

          <section className="methodology-section" id="data">
            <div className="methodology-section-heading">
              <h2>数据来源：GDELT</h2>
              <p>GeoPrizm 使用公开新闻事件数据，而不是自行采集外交文件或社交媒体舆情。</p>
            </div>
            <p>
              GDELT 是 Global Database of Events, Language and Tone 的缩写。它持续监测全球新闻媒体，并把非结构化新闻报道转换为包含参与方、事件类别、地点、时间和多个强度字段的结构化记录。GeoPrizm
              当前使用 GDELT 事件数据中适合双边关系观察的字段，包括国家参与方、事件日期、CAMEO 事件类别、GoldsteinScale、报道次数和文章来源。
            </p>
            <div className="methodology-source-grid">
              {sourceLinks.map((source) => (
                <a className="methodology-source-card" href={source.href} key={source.href} rel="noreferrer" target="_blank">
                  <strong>{source.title}</strong>
                  <span>{source.body}</span>
                </a>
              ))}
            </div>
          </section>

          <section className="methodology-section" id="calculation">
            <div className="methodology-section-heading">
              <h2>计算方法</h2>
              <p>从事件记录到日度指数，核心是方向、热度和平滑。</p>
            </div>
            <ol className="methodology-steps">
              {calculationSteps.map((step, index) => (
                <li key={step.title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="formula-panel" aria-label="指数计算公式">
              <div>
                <h3>每日加权信号</h3>
                <pre>
                  <code>
                    daily_signal = sum(GoldsteinScale * weight) / sum(weight)
                    {"\n"}weight = log1p(max(num_mentions, num_articles, 1))
                  </code>
                </pre>
              </div>
              <div>
                <h3>关系指数</h3>
                <pre>
                  <code>
                    rolling_signal = 14_day_average(daily_signal)
                    {"\n"}index = clamp(50 + rolling_signal * 12, 0, 100)
                  </code>
                </pre>
              </div>
            </div>
            <p>
              GoldsteinScale 的正负方向来自事件行为本身：合作、援助、会谈等通常为正，抗议、威胁、冲突等通常为负。GeoPrizm
              使用 14 日滚动平均，是为了降低单日新闻集中报道带来的噪声，同时保留近期趋势变化。
            </p>
          </section>

          <section className="methodology-section" id="ai">
            <div className="methodology-section-heading">
              <h2>AI 解读层</h2>
              <p>AI 负责把证据线索讲清楚，不负责生成底层指数。</p>
            </div>
            <div className="ai-boundary-grid">
              <section>
                <h3>AI 做了什么</h3>
                <ul>
                  <li>整理趋势段附近的新闻标题、摘要和来源线索。</li>
                  <li>把英文或多语种新闻线索转写成中文解释。</li>
                  <li>用谨慎语气说明可能相关的新闻背景。</li>
                </ul>
              </section>
              <section>
                <h3>AI 没做什么</h3>
                <ul>
                  <li>不修改 GoldsteinScale、事件权重或 0-100 指数。</li>
                  <li>不读取无法访问的付费全文或内部外交材料。</li>
                  <li>不判断真实因果，也不替代外交、法律、投资或安全分析。</li>
                </ul>
              </section>
            </div>
          </section>

          <section className="methodology-section" id="limits">
            <div className="methodology-section-heading">
              <h2>数据局限性声明</h2>
              <p>透明的限制说明是这个页面最重要的部分之一。</p>
            </div>
            <ul className="limitation-list">
              {limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="methodology-callout">
              <strong>使用前请记住：</strong>
              <span>
                GeoPrizm 适合观察公开报道结构和近期变化方向，不适合作为单一事实来源。重要判断应回到原始新闻、官方文件和专业研究。
              </span>
            </div>
          </section>

          <section className="methodology-section" id="citation">
            <div className="methodology-section-heading">
              <h2>引用格式</h2>
              <p>如果你在文章、研究笔记或课堂材料中使用 GeoPrizm，可以按下面格式引用。</p>
            </div>
            <div className="citation-panel">
              <h3>中文引用</h3>
              <p>
                Haullk. GeoPrizm 双边关系指数方法说明。GeoPrizm, 2026. 访问地址：
                <a href={methodologyUrl}>{methodologyUrl}</a>
              </p>
              <h3>English citation</h3>
              <p>
                Haullk. GeoPrizm methodology: GDELT bilateral relations index. GeoPrizm, 2026. Available at{" "}
                <a href={methodologyUrl}>{methodologyUrl}</a>.
              </p>
            </div>
            <div className="methodology-footer-actions">
              <Link href={returnHref}>回到刚才的看板</Link>
              <a href={githubUrl} rel="noreferrer" target="_blank">
                查看 GitHub 项目
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

async function latestFeaturedDataEnd(): Promise<string | null> {
  const pool = loadCandidatePool();
  const pairIds = pool.featuredPairs.map((pair) => pair.pairId);
  const cache = await readManyRelationshipCaches(pairIds).catch(() => null);
  if (cache === null) {
    return null;
  }
  const dataEnds = Array.from(cache.values())
    .map((payload) => payload.data_end)
    .filter((value): value is string => Boolean(value));
  if (dataEnds.length === 0) {
    return null;
  }
  return dataEnds.sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
}

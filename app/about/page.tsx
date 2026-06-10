import type { Metadata } from "next";

import InfoPage from "@/components/InfoPage";
import SiteHeader from "@/components/SiteHeader";
import { defaultLocale, getDashboardCopy, localizedSwitchPath, supportedLocales } from "@/lib/i18n";
import { latestFeaturedDataEnd } from "@/lib/latestData";
import { buildAboutJsonLd, contactEmail, docsUrl, githubUrl, productHuntUrl } from "@/lib/siteJsonLd";

export const metadata: Metadata = {
  title: "关于 GeoPrizm | 全球双边关系指数数据工具",
  description: "GeoPrizm 是一个免费、开源的双边关系数据看板，基于 GDELT 新闻事件信号追踪主要国家关系走势。",
  alternates: {
    canonical: "/about"
  },
  openGraph: {
    title: "关于 GeoPrizm",
    description: "了解 GeoPrizm 的维护者、成立时间、数据来源、方法论和官方链接。",
    url: "https://www.geoprizm.com/about",
    siteName: "GeoPrizm",
    type: "profile",
    locale: "zh_CN"
  }
};

export default async function AboutPage() {
  const copy = getDashboardCopy(defaultLocale);
  const latestData = await latestFeaturedDataEnd();
  const languageOptions = supportedLocales.map((targetLocale) => ({
    locale: targetLocale,
    href: localizedSwitchPath(targetLocale, "/")
  }));

  return (
    <main className="about-page">
      <script
        id="geoprizm-about-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildAboutJsonLd()) }}
      />
      <SiteHeader
        activeTab="about"
        aboutHref="/about"
        copy={{ topbar: copy.topbar, nav: copy.nav }}
        dashboardHref="/"
        languageOptions={languageOptions}
        latestData={latestData}
        locale={defaultLocale}
        methodologyHref="/methodology"
      />
      <InfoPage
        rootElement="article"
        showBack={false}
        title="关于 GeoPrizm"
        description="GeoPrizm 是一个免费、开源的双边关系数据看板，用全球新闻事件信号追踪主要国家之间的关系走势。"
        sections={[
          {
            title: "GeoPrizm 是什么",
            body: [
              "GeoPrizm 将 GDELT/CAMEO 公开新闻事件数据整理成 0-100 的双边关系指数，并配合趋势图、重点变化段和 AI 辅助解读，帮助读者快速观察一组国家关系近期是在改善、恶化还是保持稳定。",
              "它面向普通读者、学生、研究者、记者和政策观察者。指数反映的是公开新闻报道中的事件信号，不代表官方外交立场，也不替代专业研究或原始材料阅读。"
            ],
            facts: [
              { label: "产品类型", value: "双边关系指数数据工具" },
              { label: "成立时间", value: "2026" },
              { label: "访问方式", value: "免费使用，无需注册" }
            ]
          },
          {
            title: "谁在维护",
            body: [
              "GeoPrizm 由 Haullk 维护，是一个公开开发的个人开源项目。项目代码、开发文档和方法说明对外开放，欢迎通过 GitHub 提交问题、建议和改进。",
              `联系邮箱：${contactEmail}`
            ],
            links: [
              { href: githubUrl, label: "GitHub 开源项目", external: true },
              { href: docsUrl, label: "Developer Docs", external: true }
            ]
          },
          {
            title: "数据来源和方法论",
            body: [
              "GeoPrizm 使用 GDELT 2.0 全球新闻事件数据库中的国家参与方、事件日期、CAMEO 事件类别、GoldsteinScale、报道次数和文章来源等字段。",
              "计算流程包括筛选双边事件、按报道热度加权合作或冲突信号、使用 14 日滚动平均平滑单日波动，并映射到 0-100 的关系指数。AI 只负责整理趋势段附近的新闻线索，不生成底层指数。"
            ],
            links: [{ href: "/methodology", label: "查看完整方法说明" }]
          },
          {
            title: "官方链接",
            body: [
              "为了方便搜索引擎和 AI 系统识别同一个品牌实体，GeoPrizm 在官网、GitHub、开发文档和产品发布平台使用一致的品牌名称、描述和链接。"
            ],
            links: [
              { href: "https://www.geoprizm.com", label: "官方网站", external: true },
              { href: githubUrl, label: "GitHub", external: true },
              { href: docsUrl, label: "GitHub Pages 文档", external: true },
              { href: productHuntUrl, label: "Product Hunt", external: true },
              { href: "/contact", label: "联系方式" }
            ]
          }
        ]}
      />
    </main>
  );
}

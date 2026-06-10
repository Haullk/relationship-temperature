import type { Metadata } from "next";

import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "关于 GeoPrizm | 双边关系指数看板",
  description: "了解 GeoPrizm 如何基于公开新闻事件数据追踪主要国家双边关系趋势。",
  alternates: {
    canonical: "/about"
  }
};

export default function AboutPage() {
  return (
    <InfoPage
      title="关于 GeoPrizm"
      description="GeoPrizm 是一个追踪全球双边关系走势的数据工具。"
      sections={[
        {
          title: "我们做什么",
          body: [
            "GeoPrizm 将公开新闻事件数据整理成 0-100 的关系指数，帮助用户观察主要国家关系的趋势变化。",
            "它面向想快速理解国际关系动态的普通读者、研究者、开发者和媒体工作者。"
          ]
        },
        {
          title: "我们的原则",
          body: [
            "GeoPrizm 关注新闻报道里的合作、冲突、会谈、制裁等信号，不替用户判断谁对谁错。",
            "指数和解读用于观察公开报道结构，不代表任何政府、机构或官方外交立场。"
          ]
        },
        {
          title: "开源项目",
          body: [
            "GeoPrizm 是开源项目，代码和方法说明可在 GitHub 查看。欢迎提交问题、建议和改进。"
          ]
        }
      ]}
    />
  );
}

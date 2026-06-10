import type { Metadata } from "next";

import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "免责声明 | GeoPrizm",
  description: "GeoPrizm 指数和 AI 解读的使用限制与免责声明。",
  alternates: {
    canonical: "/disclaimer"
  }
};

export default function DisclaimerPage() {
  return (
    <InfoPage
      title="免责声明"
      description="GeoPrizm 提供的是公开新闻信号和数据观察，不是官方判断。"
      sections={[
        {
          title: "不是官方立场",
          body: [
            "GeoPrizm 的关系指数反映公开新闻报道中的事件信号，不代表任何政府、国际组织、媒体机构或项目作者的外交立场。"
          ]
        },
        {
          title: "不是专业建议",
          body: [
            "GeoPrizm 内容不构成法律、投资、安全、外交或政策建议。用户应结合其他来源和专业判断使用。"
          ]
        },
        {
          title: "数据限制",
          body: [
            "新闻覆盖、数据抽取和事件编码都可能存在延迟、遗漏或偏差。重大事件集中报道时，指数可能出现短期波动。"
          ]
        }
      ]}
    />
  );
}

import type { Metadata } from "next";

import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "方法说明 | GeoPrizm",
  description: "了解 GeoPrizm 双边关系指数的数据来源、计算方式和使用限制。",
  alternates: {
    canonical: "/methodology"
  }
};

export default function MethodologyPage() {
  return (
    <InfoPage
      title="数据来源与方法"
      description="GeoPrizm 使用公开新闻事件数据计算关系指数，并用中文解释趋势变化。"
      sections={[
        {
          title: "数据来源",
          body: [
            "底层数据来自 GDELT 全球事件数据库。GDELT 从全球新闻报道中抽取涉及国家、组织和事件类型的结构化信号。",
            "GeoPrizm 当前聚焦主要国家对，按日汇总新闻事件信号和报道热度。"
          ]
        },
        {
          title: "指数计算",
          body: [
            "指数会综合 CAMEO 事件类型、Goldstein 分值和报道热度，将合作或冲突信号映射为 0-100 的关系指数。",
            "50 代表中性基准，高于 50 偏友好，低于 50 偏紧张。页面展示 14 日滚动平均，以减少单日新闻波动。"
          ]
        },
        {
          title: "AI 解读",
          body: [
            "AI 只负责把趋势变化背后的新闻标题、摘要和证据线索整理成易读中文。",
            "AI 不生成底层指数，不读取付费全文，也不替代外交、法律、投资或安全判断。"
          ]
        }
      ]}
    />
  );
}

import type { Metadata } from "next";

import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "联系方式 | GeoPrizm",
  description: "联系 GeoPrizm 项目，反馈问题、合作建议或数据方法问题。",
  alternates: {
    canonical: "/contact"
  }
};

export default function ContactPage() {
  return (
    <InfoPage
      title="联系方式"
      description="欢迎反馈问题、提出建议或讨论数据合作。"
      sections={[
        {
          title: "邮箱",
          body: ["你可以通过 helioshulk@gmail.com 联系 GeoPrizm 项目。"]
        },
        {
          title: "GitHub",
          body: [
            "项目代码托管在 GitHub。你可以提交 issue、star 项目，或查看方法实现。"
          ]
        },
        {
          title: "适合联系的事项",
          body: [
            "包括数据问题、页面错误、国家对建议、开源贡献、媒体引用和商业合作。"
          ]
        }
      ]}
    />
  );
}

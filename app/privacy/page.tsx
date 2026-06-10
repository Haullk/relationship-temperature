import type { Metadata } from "next";

import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "隐私政策 | GeoPrizm",
  description: "了解 GeoPrizm 如何处理访问数据、第三方服务和广告相关 Cookie。",
  alternates: {
    canonical: "/privacy"
  }
};

export default function PrivacyPage() {
  return (
    <InfoPage
      title="隐私政策"
      description="GeoPrizm 尽量保持简单、透明，不要求用户注册账号。"
      sections={[
        {
          title: "我们收集什么",
          body: [
            "GeoPrizm 当前不要求注册账号，也不要求用户提交个人资料。",
            "服务器和托管服务可能记录基础访问日志，例如访问时间、请求路径、浏览器类型和 IP 地址，用于安全、调试和服务稳定性。"
          ]
        },
        {
          title: "第三方服务",
          body: [
            "GeoPrizm 可能使用 Google AdSense 展示广告。Google 和第三方广告合作伙伴可能使用 Cookie 或类似技术来投放、衡量和改进广告。",
            "用户可以通过浏览器设置或 Google 的广告设置管理个性化广告偏好。"
          ]
        },
        {
          title: "联系方式",
          body: [
            "如果你对隐私政策或数据处理有问题，可以通过 helioshulk@gmail.com 联系我们。"
          ]
        }
      ]}
    />
  );
}

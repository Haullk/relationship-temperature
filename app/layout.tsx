import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.geoprizm.com"),
  title: "GeoPrizm | 双边关系看板",
  description: "基于 GDELT 结构化新闻事件数据，追踪主要国家双边关系指数，并用 AI 辅助解释趋势变化线索。",
  icons: {
    icon: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg?v=2", type: "image/svg+xml" }]
  },
  openGraph: {
    title: "GeoPrizm 双边关系看板",
    description: "从全球新闻信号追踪双边关系趋势，查看 0-100 关系指数、趋势段和中文 AI 解读。",
    url: "https://www.geoprizm.com",
    siteName: "GeoPrizm",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: "/social-preview.png",
        width: 1280,
        height: 640,
        alt: "GeoPrizm 双边关系趋势看板"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "GeoPrizm 双边关系看板",
    description: "基于 GDELT 新闻事件数据，追踪主要国家双边关系趋势。",
    images: ["/social-preview.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "关系温度计",
  description: "查看候选国家与地区关系温度趋势，并解释关键趋势段。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "关系指数",
  description: "查看候选国家与地区关系指数趋势，并解释关键趋势段。",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

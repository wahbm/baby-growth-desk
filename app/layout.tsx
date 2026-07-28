import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "糖糖的小小工作台",
  description: "记录糖糖的学习计划与健康情况。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "糖糖的小小工作台",
  description: "记录糖糖的学习计划与健康情况。",
  metadataBase: new URL("https://tangtang-study-health-desk.anhuibengbuhy.chatgpt.site"),
  openGraph: {
    title: "糖糖的小小工作台",
    description: "记录糖糖的学习计划与健康情况。",
    images: ["/og.png"],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><head><meta name="theme-color" content="#ef8268" /></head><body>{children}</body></html>;
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { basePath, withBasePath } from "./lib/base-path";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}${basePath || "/"}`);
  return {
    metadataBase,
    title: "糖糖成长工作台",
    description: "安全记录糖糖的学习安排、作业和健康情况。",
    manifest: withBasePath("/manifest.webmanifest"),
    icons: { icon: withBasePath("/tangtang-avatar.png"), apple: withBasePath("/tangtang-avatar.png") },
    openGraph: { title: "糖糖成长工作台", description: "学习有计划，健康有记录。登录后跨设备同步。", images: [{ url: withBasePath("/og.png"), width: 1696, height: 932 }] },
    twitter: { card: "summary_large_image", title: "糖糖成长工作台", description: "学习有计划，健康有记录。", images: [withBasePath("/og.png")] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><head><meta name="theme-color" content="#dc7650" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-status-bar-style" content="default" /></head><body>{children}</body></html>;
}

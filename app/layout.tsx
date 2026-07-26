import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: {
      default: "申论镜｜手写申论 OCR 与循证批改",
      template: "%s｜申论镜",
    },
    description: "多页拍照上传、逐行 OCR 校对、采分点证据标注、区间估分与历史复盘。",
    icons: {
      icon: "/favicon.svg",
    },
    openGraph: {
      title: "申论镜｜把纸上的思考，变成看得见的进步",
      description: "手写申论 OCR 与循证批改",
      type: "website",
      images: [{ url: `${origin}/og-v2.jpg`, width: 1200, height: 630, alt: "申论镜动态答卷与循证批改" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "申论镜｜把纸上的思考，变成看得见的进步",
      description: "手写申论 OCR 与循证批改",
      images: [`${origin}/og-v2.jpg`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

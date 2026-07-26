import type { Metadata } from "next";
import { headers } from "next/headers";
import { LandingPage } from "./landing-page";

export const metadata: Metadata = {
  title: "申论镜｜让每一个识别结果都有据可查",
  description: "手写申论多页 OCR、原图逐行校对、疑难行复核与循证批改。",
};

export default async function Home() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "";
  const workspaceHref = host.endsWith(".workers.dev")
    ? "https://shenlun-ocr.qiyihuipku.chatgpt.site/app"
    : "/app";

  return <LandingPage workspaceHref={workspaceHref} />;
}

import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { WorkspaceApp } from "../workspace-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "批改台",
  description: "上传手写申论答卷，校对 OCR 电子稿并生成循证批改报告。",
};

export default async function AppPage() {
  const user = await requireChatGPTUser("/app");
  return <WorkspaceApp userName={user.displayName} />;
}

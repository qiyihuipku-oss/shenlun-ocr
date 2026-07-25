import type { Metadata } from "next";
import { WorkspaceApp } from "./workspace-app";

export const metadata: Metadata = {
  title: "申论镜｜手写申论 OCR 与循证批改",
  description:
    "把手写申论转成可核对的电子稿，并基于题目材料与评分点给出有证据的估分和修改建议。",
};

export default function Home() {
  return <WorkspaceApp />;
}

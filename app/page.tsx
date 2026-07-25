import type { Metadata } from "next";
import { LandingPage } from "./landing-page";

export const metadata: Metadata = {
  title: "申论镜｜让每一个识别结果都有据可查",
  description: "手写申论多页 OCR、原图逐行校对、疑难行复核与循证批改。",
};

export default function Home() {
  return <LandingPage />;
}

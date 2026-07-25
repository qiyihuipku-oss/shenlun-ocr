import type { GradingReport, OcrBlock, Question } from "./types";

export const demoQuestions: Question[] = [
  {
    id: "q-governance",
    title: "2025 模拟题 · 基层治理现代化",
    type: "综合分析",
    prompt: "请结合给定材料，分析当前基层治理存在的问题，并提出改进建议。（不超过 500 字）",
    materialSummary:
      "材料涉及部门协同、资源下沉、数字平台重复建设、群众参与和基层减负等主题。当前内测题目的评分点为自有示例，不代表任何考试官方标准。",
    maxScore: 100,
    wordLimit: "400—500 字",
    rubricCount: 6,
    version: 1,
  },
  {
    id: "q-rural",
    title: "2024 模拟题 · 乡村公共文化空间",
    type: "归纳概括",
    prompt: "根据给定材料，概括乡村公共文化空间运营中存在的主要问题。（不超过 300 字）",
    materialSummary:
      "材料涉及设施闲置、内容供需错位、人才不足、运营机制和村民共建等主题。",
    maxScore: 50,
    wordLimit: "250—300 字",
    rubricCount: 5,
    version: 1,
  },
];

export const demoBlocks: OcrBlock[] = [
  {
    id: "b1",
    page: 1,
    text: "基层是国家治理的最末端，也是服务群众的最前沿。",
    confidence: 0.98,
    box: { x: 14, y: 22, width: 72, height: 9 },
  },
  {
    id: "b2",
    page: 1,
    text: "当前仍存在部门协同不足、资源配置分散、群众参与渠道单一等问题。",
    confidence: 0.91,
    uncertain: true,
    box: { x: 13, y: 37, width: 75, height: 12 },
  },
  {
    id: "b3",
    page: 1,
    text: "因此，应坚持党建引领，健全统筹协同机制，推动数据共享和资源下沉。",
    confidence: 0.94,
    box: { x: 13, y: 55, width: 76, height: 13 },
  },
  {
    id: "b4",
    page: 1,
    text: "同时完善群众诉求响应闭环，以基层减负换取服务增效。",
    confidence: 0.89,
    uncertain: true,
    box: { x: 13, y: 72, width: 68, height: 10 },
  },
];

export const demoReport: GradingReport = {
  scoreRange: { min: 64, max: 69, maxScore: 100 },
  dimensions: [
    { name: "要点", score: 25, max: 40, percent: 63 },
    { name: "逻辑", score: 17, max: 20, percent: 85 },
    { name: "表达", score: 16, max: 20, percent: 80 },
    { name: "规范", score: 15, max: 20, percent: 75 },
  ],
  rubricEvidence: [
    {
      pointId: "R1",
      title: "指出部门协同问题",
      status: "hit",
      evidence: "部门协同不足",
      explanation: "原文直接概括了横向协同不足。",
      awarded: 8,
      max: 8,
    },
    {
      pointId: "R2",
      title: "提出资源下沉",
      status: "hit",
      evidence: "推动数据共享和资源下沉",
      explanation: "建议与材料问题对应。",
      awarded: 8,
      max: 8,
    },
    {
      pointId: "R3",
      title: "说明数字平台重复建设",
      status: "missed",
      explanation: "答案提到数据共享，但未概括重复建设及多头填报问题。",
      awarded: 0,
      max: 8,
    },
    {
      pointId: "R4",
      title: "群众参与机制",
      status: "uncertain",
      evidence: "群众参与渠道单一",
      explanation: "识别了问题，但对策中缺少具体参与机制。",
      awarded: 4,
      max: 8,
    },
  ],
  missedPoints: ["数字平台重复建设", "基层权责不匹配"],
  uncertainItems: ["群众参与机制是否形成完整对策"],
  wordCount: 0,
  keywords: [
    { word: "基层", count: 3 },
    { word: "协同", count: 2 },
    { word: "群众", count: 2 },
  ],
  structureIssues: ["问题与对策对应关系基本清楚，但第二个问题缺少对应措施。"],
  languageIssues: ["“换取服务增效”可改为更直接的“提升基层服务效能”。"],
  priorities: [
    "补出“平台重复建设、多头填报”的材料问题，避免关键要点缺失。",
    "把群众参与从现象判断改成可执行措施，如议事协商和反馈闭环。",
    "每个问题后紧跟对应对策，减少最后一段集中罗列造成的错位。",
  ],
  questionVersion: 1,
  promptVersion: "grading-v1.0.0",
  modelRunId: "demo-run-20260725",
};

export const historyRows = [
  { id: "h1", title: "基层治理现代化", type: "综合分析 · 第 3 次", score: "64—69", coverage: "4/6", date: "07-25" },
  { id: "h2", title: "乡村公共文化空间", type: "归纳概括 · 第 2 次", score: "33—37", coverage: "4/5", date: "07-20" },
  { id: "h3", title: "城市更新中的烟火气", type: "大作文 · 第 1 次", score: "61—66", coverage: "5/8", date: "07-14" },
  { id: "h4", title: "基层报表治理", type: "提出对策 · 第 1 次", score: "30—34", coverage: "3/5", date: "07-08" },
];

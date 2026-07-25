export type SubmissionStatus =
  | "uploaded"
  | "quality_check"
  | "ocr_pending"
  | "ocr_processing"
  | "needs_review"
  | "confirmed"
  | "grading"
  | "completed"
  | "failed";

export type Question = {
  id: string;
  title: string;
  type: string;
  prompt: string;
  materialSummary: string;
  maxScore: number;
  wordLimit: string;
  rubricCount: number;
  version: number;
};

export type OcrBlock = {
  id: string;
  page: number;
  text: string;
  confidence: number;
  uncertain?: boolean;
  box: { x: number; y: number; width: number; height: number };
  provider?: string;
  runId?: string;
  imageVariant?: "original" | "normalized";
  confidenceSource?: "provider" | "character_average" | "heuristic";
  coordinateSpace?: "pixels" | "percent";
};

export type ImageQuality = {
  width: number;
  height: number;
  blurScore: number;
  brightness: number;
  darkRatio: number;
  lightRatio: number;
  issues: Array<"low_resolution" | "blur" | "underexposed" | "overexposed" | "page_edge" | "skew" | "shadow">;
  canContinue: boolean;
};

export type OcrCandidate = {
  id: string;
  blockId: string;
  provider: "baidu" | "paddle" | "context";
  imageVariant: "original" | "normalized";
  text: string;
  confidence: number;
  box: OcrBlock["box"];
  runId: string;
};

export type OcrDecision = {
  blockId: string;
  text: string;
  alternatives: Array<{ text: string; provider: string; confidence: number }>;
  confidence: number;
  requiresReview: boolean;
  reasonCodes: Array<"low_confidence" | "engine_disagreement" | "material_term" | "image_quality">;
  sourceProviders: string[];
};

export type CorrectionEvent = {
  id: string;
  submissionId: string;
  blockId?: string;
  before: string;
  after: string;
  acceptedSuggestion?: string;
  consentScope: "none" | "evaluation" | "improvement";
  modelVersion: string;
  createdAt: string;
};

export type OcrSuggestion = {
  original: string;
  candidate: string;
  reason: string;
  confidence: number;
};

export type RubricEvidence = {
  pointId: string;
  title: string;
  status: "hit" | "missed" | "uncertain";
  evidence?: string;
  explanation: string;
  awarded: number;
  max: number;
};

export type GradingReport = {
  scoreRange: { min: number; max: number; maxScore: number };
  dimensions: Array<{ name: string; score: number; max: number; percent: number }>;
  rubricEvidence: RubricEvidence[];
  missedPoints: string[];
  uncertainItems: string[];
  wordCount: number;
  keywords: Array<{ word: string; count: number }>;
  structureIssues: string[];
  languageIssues: string[];
  priorities: string[];
  questionVersion: number;
  promptVersion: string;
  modelRunId: string;
};

export type SubmissionSnapshot = {
  id: string;
  questionId: string;
  status: SubmissionStatus;
  pages: Array<{ key: string; order: number; rotation: number }>;
  blocks: OcrBlock[];
  decisions?: OcrDecision[];
  quality?: ImageQuality[];
  progress?: number;
  transcript: string;
  report?: GradingReport;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionStatus =
  | "uploaded"
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
  transcript: string;
  report?: GradingReport;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
};

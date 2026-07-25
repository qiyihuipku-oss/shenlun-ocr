import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  role: text("role").notNull().default("candidate"),
  createdAt: text("created_at").notNull(),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  prompt: text("prompt").notNull(),
  material: text("material").notNull(),
  referenceAnswer: text("reference_answer").notNull(),
  rubricJson: text("rubric_json").notNull(),
  maxScore: integer("max_score").notNull(),
  wordLimit: text("word_limit").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  questionId: text("question_id").notNull(),
  status: text("status").notNull(),
  pagesJson: text("pages_json").notNull(),
  blocksJson: text("blocks_json").notNull().default("[]"),
  transcript: text("transcript").notNull().default(""),
  confirmedTranscript: text("confirmed_transcript"),
  reportJson: text("report_json"),
  failureReason: text("failure_reason"),
  promptVersion: text("prompt_version"),
  modelRunId: text("model_run_id"),
  qualityJson: text("quality_json").notNull().default("[]"),
  decisionsJson: text("decisions_json").notNull().default("[]"),
  ocrProgress: integer("ocr_progress").notNull().default(0),
  confirmedAt: text("confirmed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const transcriptRevisions = sqliteTable("transcript_revisions", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

export const uploadTokens = sqliteTable("upload_tokens", {
  token: text("token").primaryKey(),
  ownerId: text("owner_id").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  maxBytes: integer("max_bytes").notNull(),
  usedAt: text("used_at"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const modelRuns = sqliteTable("model_runs", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  kind: text("kind").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  status: text("status").notNull(),
  usageJson: text("usage_json"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});

export const ocrRuns = sqliteTable("ocr_runs", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  ownerId: text("owner_id").notNull(),
  provider: text("provider").notNull(),
  mode: text("mode").notNull().default("primary"),
  status: text("status").notNull(),
  scopeJson: text("scope_json").notNull().default("{}"),
  providerTasksJson: text("provider_tasks_json").notNull().default("[]"),
  attempts: integer("attempts").notNull().default(0),
  leaseUntil: text("lease_until"),
  nextRetryAt: text("next_retry_at"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const ocrCandidates = sqliteTable("ocr_candidates", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  submissionId: text("submission_id").notNull(),
  blockId: text("block_id").notNull(),
  provider: text("provider").notNull(),
  imageVariant: text("image_variant").notNull(),
  text: text("text").notNull(),
  confidence: integer("confidence_milli").notNull(),
  boxJson: text("box_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const correctionEvents = sqliteTable("correction_events", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  ownerId: text("owner_id").notNull(),
  blockId: text("block_id"),
  before: text("before_text").notNull(),
  after: text("after_text").notNull(),
  acceptedSuggestion: text("accepted_suggestion"),
  consentScope: text("consent_scope").notNull().default("none"),
  modelVersion: text("model_version").notNull(),
  createdAt: text("created_at").notNull(),
});

export const dataConsents = sqliteTable("data_consents", {
  ownerId: text("owner_id").primaryKey(),
  scope: text("scope").notNull().default("none"),
  updatedAt: text("updated_at").notNull(),
});

export const qualityChecks = sqliteTable("quality_checks", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  pageOrder: integer("page_order").notNull(),
  metricsJson: text("metrics_json").notNull(),
  createdAt: text("created_at").notNull(),
});

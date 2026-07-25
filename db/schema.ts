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

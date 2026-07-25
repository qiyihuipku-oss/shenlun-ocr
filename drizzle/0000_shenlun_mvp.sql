CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text,
  `role` text DEFAULT 'candidate' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `type` text NOT NULL,
  `prompt` text NOT NULL,
  `material` text NOT NULL,
  `reference_answer` text NOT NULL,
  `rubric_json` text NOT NULL,
  `max_score` integer NOT NULL,
  `word_limit` text NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `question_id` text NOT NULL,
  `status` text NOT NULL,
  `pages_json` text NOT NULL,
  `blocks_json` text DEFAULT '[]' NOT NULL,
  `transcript` text DEFAULT '' NOT NULL,
  `confirmed_transcript` text,
  `report_json` text,
  `failure_reason` text,
  `prompt_version` text,
  `model_run_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submissions_owner_created_idx` ON `submissions` (`owner_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `transcript_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `submission_id` text NOT NULL,
  `content` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upload_tokens` (
  `token` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `object_key` text NOT NULL,
  `content_type` text NOT NULL,
  `max_bytes` integer NOT NULL,
  `used_at` text,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `submission_id` text NOT NULL,
  `kind` text NOT NULL,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `prompt_version` text NOT NULL,
  `status` text NOT NULL,
  `usage_json` text,
  `error` text,
  `created_at` text NOT NULL
);

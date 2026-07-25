ALTER TABLE `submissions` ADD `quality_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `submissions` ADD `decisions_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `submissions` ADD `ocr_progress` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `submissions` ADD `confirmed_at` text;
--> statement-breakpoint
CREATE TABLE `ocr_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `submission_id` text NOT NULL,
  `owner_id` text NOT NULL,
  `provider` text NOT NULL,
  `mode` text DEFAULT 'primary' NOT NULL,
  `status` text NOT NULL,
  `scope_json` text DEFAULT '{}' NOT NULL,
  `provider_tasks_json` text DEFAULT '[]' NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `lease_until` text,
  `next_retry_at` text,
  `error` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ocr_runs_submission_idx` ON `ocr_runs` (`submission_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `ocr_candidates` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `submission_id` text NOT NULL,
  `block_id` text NOT NULL,
  `provider` text NOT NULL,
  `image_variant` text NOT NULL,
  `text` text NOT NULL,
  `confidence_milli` integer NOT NULL,
  `box_json` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `correction_events` (
  `id` text PRIMARY KEY NOT NULL,
  `submission_id` text NOT NULL,
  `owner_id` text NOT NULL,
  `block_id` text,
  `before_text` text NOT NULL,
  `after_text` text NOT NULL,
  `accepted_suggestion` text,
  `consent_scope` text DEFAULT 'none' NOT NULL,
  `model_version` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `data_consents` (
  `owner_id` text PRIMARY KEY NOT NULL,
  `scope` text DEFAULT 'none' NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quality_checks` (
  `id` text PRIMARY KEY NOT NULL,
  `submission_id` text NOT NULL,
  `page_order` integer NOT NULL,
  `metrics_json` text NOT NULL,
  `created_at` text NOT NULL
);

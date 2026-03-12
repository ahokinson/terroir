CREATE TABLE `branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repository_id` integer NOT NULL,
	`name` text NOT NULL,
	`base_branch` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connectors` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`config` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dismissed_suggestions` (
	`key` text PRIMARY KEY NOT NULL,
	`dismissed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `epics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`source` text,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`timestamp` integer NOT NULL,
	`story_name` text,
	`summary` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`dismissed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback_hashes` (
	`story_key` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_key` text NOT NULL,
	`source` text NOT NULL,
	`ext_id` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_feedback_story_source_ext` ON `feedback_items` (`story_key`,`source`,`ext_id`);--> statement-breakpoint
CREATE TABLE `repositories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_id` integer NOT NULL,
	`path` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`epic_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'feature' NOT NULL,
	`ticket` text,
	`source` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	`lifecycle_stage` text DEFAULT 'active' NOT NULL,
	`auto_imported` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`epic_id`) REFERENCES `epics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_id` integer NOT NULL,
	`ext_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tasks_story_ext` ON `tasks` (`story_id`,`ext_id`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`git_username` text,
	`ticket_account_id` text
);

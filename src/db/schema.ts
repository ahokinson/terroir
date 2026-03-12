import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const epics = sqliteTable("epics", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	source: text("source"),
	position: integer("position").notNull().default(0),
})

export const stories = sqliteTable("stories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	epicId: integer("epic_id")
		.notNull()
		.references(() => epics.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	type: text("type").notNull().default("feature"),
	ticket: text("ticket"),
	source: text("source"),
	createdAt: text("created_at").notNull(),
	completedAt: text("completed_at"),
	lifecycleStage: text("lifecycle_stage").notNull().default("active"),
	autoImported: integer("auto_imported").notNull().default(0),
	position: integer("position").notNull().default(0),
})

export const repositories = sqliteTable("repositories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	storyId: integer("story_id")
		.notNull()
		.references(() => stories.id, { onDelete: "cascade" }),
	path: text("path").notNull(),
	position: integer("position").notNull().default(0),
})

export const branches = sqliteTable("branches", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	repositoryId: integer("repository_id")
		.notNull()
		.references(() => repositories.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	baseBranch: text("base_branch"),
	position: integer("position").notNull().default(0),
})

export const tasks = sqliteTable(
	"tasks",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		storyId: integer("story_id")
			.notNull()
			.references(() => stories.id, { onDelete: "cascade" }),
		extId: text("ext_id").notNull(),
		title: text("title").notNull(),
		status: text("status").notNull().default("todo"),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
		completedAt: text("completed_at"),
		position: integer("position").notNull().default(0),
	},
	(table) => [uniqueIndex("idx_tasks_story_ext").on(table.storyId, table.extId)],
)

export const feedbackHashes = sqliteTable("feedback_hashes", {
	storyKey: text("story_key").primaryKey(),
	hash: text("hash").notNull(),
})

export const settings = sqliteTable("settings", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
})

export const connectors = sqliteTable("connectors", {
	id: text("id").primaryKey(),
	enabled: integer("enabled").notNull().default(0),
	config: text("config").notNull().default("{}"),
})

export const teamMembers = sqliteTable("team_members", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	gitUsername: text("git_username"),
	ticketAccountId: text("ticket_account_id"),
})

export const feedbackItems = sqliteTable(
	"feedback_items",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		storyKey: text("story_key").notNull(),
		source: text("source").notNull(),
		extId: text("ext_id").notNull(),
		summary: text("summary").notNull(),
		createdAt: text("created_at").notNull(),
	},
	(table) => [
		uniqueIndex("idx_feedback_story_source_ext").on(table.storyKey, table.source, table.extId),
	],
)

export const events = sqliteTable("events", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	type: text("kind").notNull(),
	timestamp: integer("timestamp").notNull(),
	storyName: text("story_name"),
	summary: text("summary").notNull(),
	read: integer("read").notNull().default(0),
	dismissed: integer("dismissed").notNull().default(0),
})

export const dismissedSuggestions = sqliteTable("dismissed_suggestions", {
	key: text("key").primaryKey(),
	dismissedAt: text("dismissed_at").notNull(),
})

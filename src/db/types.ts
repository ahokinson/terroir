import { LifecycleStage } from "@domain/lifecycle"

export function parseEnum<T extends Record<string, string>>(
	e: T,
	s: string,
	fallback: T[keyof T],
): T[keyof T] {
	for (const v of Object.values(e)) {
		if (v === s) return v as T[keyof T]
	}
	return fallback
}

export enum Status {
	Todo = "todo",
	InProgress = "in-progress",
	Done = "done",
}

export enum StoryType {
	Feature = "feature",
	Bug = "bug",
}

export enum FeedbackSource {
	Review = "review",
	CI = "ci",
}

export interface Task {
	id: string
	title: string
	status: Status
	createdAt: string
	updatedAt: string
	completedAt: string | null
}

export interface Branch {
	name: string
	baseBranch: string | null
}

export interface Repository {
	path: string
	branches: Branch[]
}

export interface Story {
	name: string
	type: StoryType
	ticket: string | null
	source: string | null
	createdAt: string
	completedAt: string | null
	lifecycleStage: LifecycleStage
	autoImported: boolean
	tasks: Task[]
	repositories: Repository[]
}

export interface Epic {
	name: string
	source: string | null
	stories: Story[]
}

export function toStatus(s: string): Status {
	return parseEnum(Status, s, Status.Todo)
}

export function toStoryType(s: string): StoryType {
	return parseEnum(StoryType, s, StoryType.Feature)
}

export function toLifecycleStage(s: string): LifecycleStage {
	return parseEnum(LifecycleStage, s, LifecycleStage.Active)
}

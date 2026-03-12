import { randomBytes } from "node:crypto"
import type { Epic, Task } from "@db/types"
import { Status } from "@db/types"
import { Direction } from "@tui/lib/keys"
import type { SetStoreFunction } from "solid-js/store"

function randomId(): string {
	return randomBytes(4).toString("hex")
}

function cycleStatus(current: Status): Status {
	switch (current) {
		case Status.InProgress:
			return Status.Done
		case Status.Done:
			return Status.Todo
		default:
			return Status.InProgress
	}
}

export interface TaskManager {
	create(epicIdx: number, storyIdx: number, title: string): void
	edit(epicIdx: number, storyIdx: number, taskIdx: number, title: string): void
	cycleStatus(epicIdx: number, storyIdx: number, taskIdx: number, currentStatus: Status): void
	delete(epicIdx: number, storyIdx: number, taskIdx: number): void
	reorder(epicIdx: number, storyIdx: number, taskIdx: number, direction: Direction): void
	completeStory(epicIdx: number, storyIdx: number): void
	uncompleteStory(epicIdx: number, storyIdx: number): void
}

export function createTaskManager(setState: SetStoreFunction<{ epics: Epic[] }>): TaskManager {
	return {
		create(epicIdx, storyIdx, title) {
			const now = new Date().toISOString()
			const task: Task = {
				id: randomId(),
				title,
				status: Status.Todo,
				createdAt: now,
				updatedAt: now,
				completedAt: null,
			}
			setState("epics", epicIdx, "stories", storyIdx, "tasks", (prev) => [...prev, task])
		},

		edit(epicIdx, storyIdx, taskIdx, title) {
			const now = new Date().toISOString()
			setState("epics", epicIdx, "stories", storyIdx, "tasks", taskIdx, {
				title,
				updatedAt: now,
			})
		},

		cycleStatus(epicIdx, storyIdx, taskIdx, currentStatus) {
			const now = new Date().toISOString()
			const newStatus = cycleStatus(currentStatus)
			setState("epics", epicIdx, "stories", storyIdx, "tasks", taskIdx, {
				status: newStatus,
				updatedAt: now,
				completedAt: newStatus === Status.Done ? now : null,
			})
		},

		delete(epicIdx, storyIdx, taskIdx) {
			setState("epics", epicIdx, "stories", storyIdx, "tasks", (prev) => [
				...prev.slice(0, taskIdx),
				...prev.slice(taskIdx + 1),
			])
		},

		reorder(epicIdx, storyIdx, taskIdx, direction) {
			setState("epics", epicIdx, "stories", storyIdx, "tasks", (prev) => {
				const target = direction === Direction.Up ? taskIdx - 1 : taskIdx + 1
				if (target < 0 || target >= prev.length) return prev
				const next = [...prev]
				;[next[taskIdx], next[target]] = [next[target], next[taskIdx]]
				return next
			})
		},

		completeStory(epicIdx, storyIdx) {
			setState("epics", epicIdx, "stories", storyIdx, "completedAt", new Date().toISOString())
		},

		uncompleteStory(epicIdx, storyIdx) {
			setState("epics", epicIdx, "stories", storyIdx, "completedAt", null)
		},
	}
}

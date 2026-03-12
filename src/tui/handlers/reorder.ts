import { Direction, Section } from "@tui/lib/keys"
import { View } from "@tui/stores/route"
import type { AppStore } from "@tui/stores/store"

function swap<T>(arr: readonly T[], a: number, b: number): T[] {
	const result = [...arr]
	;[result[a], result[b]] = [result[b], result[a]]
	return result
}

function reorderListItem(app: AppStore, from: number, to: number) {
	const { store, route } = app
	const c = route.cursors
	switch (route.level) {
		case 0:
			store.setState("epics", (prev) => swap(prev, from, to))
			break
		case 1:
			store.setState("epics", c[0], "stories", (prev) => swap(prev, from, to))
			break
		case 2:
			store.setState("epics", c[0], "stories", c[1], "repositories", (prev) => swap(prev, from, to))
			break
		case 3:
			store.setState("epics", c[0], "stories", c[1], "repositories", c[2], "branches", (prev) =>
				swap(prev, from, to),
			)
			break
	}
	store.save()
}

export function handleReorder(app: AppStore, direction: Direction) {
	const { store, route, list, tasks } = app

	if (route.view === View.Story && route.focusSection === Section.Context) {
		const taskLen = list.currentStory()?.tasks.length ?? 0
		if (taskLen > 0) {
			tasks.reorder(...list.storyIndices(), list.contextCursor(), direction)
			if (direction === Direction.Down && list.contextCursor() < taskLen - 1)
				list.setContextCursor((c) => c + 1)
			if (direction === Direction.Up && list.contextCursor() > 0)
				list.setContextCursor((c) => c - 1)
			store.save()
		}
	} else if (!route.filterQuery) {
		const idx = route.cursor
		const max = list.listLen()
		if (direction === Direction.Down && idx < max - 1) {
			reorderListItem(app, idx, idx + 1)
			route.setCursor(idx + 1)
		} else if (direction === Direction.Up && idx > 0) {
			reorderListItem(app, idx, idx - 1)
			route.setCursor(idx - 1)
		}
	}
}

import { flatRows } from "@tui/detail"
import { handleActions } from "@tui/handlers/actions"
import { Section } from "@tui/lib/keys"
import { View } from "@tui/stores/route"
import type { AppStore } from "@tui/stores/store"

export interface Navigator {
	moveDown(): void
	moveUp(): void
	jumpTop(): void
	jumpBottom(): void
	enter(): void
	back(): void
}

export function createNavigator(app: AppStore): Navigator {
	function isDetailSection(): boolean {
		const { route } = app
		if (route.view === View.Branch) return route.focusSection === Section.List
		return route.focusSection === Section.Detail
	}

	function isSuggestionSection(): boolean {
		const { route } = app
		return route.view === View.Dashboard && route.focusSection === Section.Context
	}

	function detailRowCount(): number {
		const detail = app.list.currentDetail()
		if (!detail) return 0
		return flatRows(detail).length
	}

	return {
		moveDown() {
			const { route, list } = app
			if (isSuggestionSection()) {
				const max = list.suggestionCount()
				if (max > 0 && list.suggestionCursor() < max - 1) list.setSuggestionCursor((c) => c + 1)
			} else if (isDetailSection()) {
				const max = detailRowCount()
				if (max > 0 && list.detailCursor() < max - 1) list.setDetailCursor((c) => c + 1)
			} else if (route.view === View.Story && route.focusSection === Section.Context) {
				const taskLen = list.currentStory()?.tasks.length ?? 0
				if (taskLen > 0 && list.contextCursor() < taskLen - 1) list.setContextCursor((c) => c + 1)
			} else {
				const max = list.listLen()
				if (max > 0 && route.cursor < max - 1) route.setCursor(route.cursor + 1)
			}
		},

		moveUp() {
			const { route, list } = app
			if (isSuggestionSection()) {
				if (list.suggestionCursor() > 0) list.setSuggestionCursor((c) => c - 1)
			} else if (isDetailSection()) {
				if (list.detailCursor() > 0) list.setDetailCursor((c) => c - 1)
			} else if (route.view === View.Story && route.focusSection === Section.Context) {
				if (list.contextCursor() > 0) list.setContextCursor((c) => c - 1)
			} else {
				if (route.cursor > 0) route.setCursor(route.cursor - 1)
			}
		},

		jumpTop() {
			const { route, list } = app
			if (isSuggestionSection()) list.setSuggestionCursor(0)
			else if (isDetailSection()) list.setDetailCursor(0)
			else if (route.view === View.Story && route.focusSection === Section.Context)
				list.setContextCursor(0)
			else route.setCursor(0)
		},

		jumpBottom() {
			const { route, list } = app
			if (isSuggestionSection()) {
				const max = list.suggestionCount()
				if (max > 0) list.setSuggestionCursor(max - 1)
			} else if (isDetailSection()) {
				const max = detailRowCount()
				if (max > 0) list.setDetailCursor(max - 1)
			} else if (route.view === View.Story && route.focusSection === Section.Context) {
				const taskLen = list.currentStory()?.tasks.length ?? 0
				if (taskLen > 0) list.setContextCursor(taskLen - 1)
			} else {
				const max = list.listLen()
				if (max > 0) route.setCursor(max - 1)
			}
		},

		enter() {
			const { route, list } = app
			if (isDetailSection()) {
				const detail = list.currentDetail()
				if (detail) {
					const rows = flatRows(detail)
					const row = rows[list.detailCursor()]
					handleActions(app, row?.action)
				}
				return
			}
			if (route.view === View.Dashboard) {
				if (list.listLen() === 0) return
				const stories = list.flatStories()
				const target = stories[list.realIndex()]
				if (target) {
					if (route.filterQuery) route.setCursor(list.realIndex())
					route.gotoStory(target.epicIdx, target.storyIdx)
				}
				return
			}
			if (list.listLen() > 0) {
				if (route.filterQuery) route.setCursor(list.realIndex())
				route.enter()
			}
		},

		back() {
			app.route.back()
		},
	}
}

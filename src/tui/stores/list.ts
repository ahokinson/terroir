import type { Branch, Epic, Repository, Story } from "@db/types"
import { useAppStore } from "@tui/contexts/store"
import type { ThemeColors } from "@tui/contexts/theme"
import { branchDetail } from "@tui/detail/branch"
import { epicDetail } from "@tui/detail/epic"
import { repoDetail } from "@tui/detail/repo"
import { storyDetail } from "@tui/detail/story"
import type { DetailData } from "@tui/detail/types"
import type { CacheState } from "@tui/stores/cache"
import type { EpicsState } from "@tui/stores/epics"
import type { IntegrationsState } from "@tui/stores/integrations"
import { type RouteState, View } from "@tui/stores/route"
import { createEffect, createSignal, on } from "solid-js"

export interface FlatStory {
	epicIdx: number
	storyIdx: number
	name: string
}

export interface ListState {
	listLen: () => number
	realIndex: (filteredIdx?: number) => number
	flatStories: () => FlatStory[]
	currentStory: () => Story | null
	storyIndices: () => [number, number]
	currentDetail: () => DetailData | null
	selectedEpic: () => Epic | null
	selectedStory: () => Story | null
	selectedRepository: () => Repository | null
	selectedBranch: () => Branch | null
	contextCursor: () => number
	setContextCursor: (v: number | ((c: number) => number)) => void
	detailCursor: () => number
	setDetailCursor: (v: number | ((c: number) => number)) => void
	suggestionCursor: () => number
	setSuggestionCursor: (v: number | ((c: number) => number)) => void
	suggestionCount: () => number
	setSuggestionCount: (v: number) => void
}

export interface ListStateDeps {
	route: RouteState
	store: EpicsState
	cache: CacheState
	integrations: IntegrationsState
	theme: ThemeColors
}

export function createListState(deps: ListStateDeps): ListState {
	const { route, store, cache, integrations, theme } = deps
	const [contextCursor, setContextCursor] = createSignal(0)
	const [detailCursor, setDetailCursor] = createSignal(0)
	const [suggestionCursor, setSuggestionCursor] = createSignal(0)
	const [suggestionCount, setSuggestionCount] = createSignal(0)

	function flatStories(): { epicIdx: number; storyIdx: number; name: string }[] {
		const out: { epicIdx: number; storyIdx: number; name: string }[] = []
		const epics = store.epics
		for (let ei = 0; ei < epics.length; ei++) {
			const stories = epics[ei].stories
			for (let si = 0; si < stories.length; si++) {
				if (stories[si].completedAt) continue
				out.push({ epicIdx: ei, storyIdx: si, name: stories[si].name })
			}
		}
		return out
	}

	function rawItems(): string[] {
		const epics = store.epics
		const idx = route.indices
		switch (route.view) {
			case View.Dashboard:
				return flatStories().map((s) => s.name)
			case View.Epic:
				return epics[idx[0]]?.stories.map((s) => s.name) ?? []
			case View.Story:
				return epics[idx[0]]?.stories[idx[1]]?.repositories.map((r) => r.path) ?? []
			case View.Repo:
				return (
					epics[idx[0]]?.stories[idx[1]]?.repositories[idx[2]]?.branches.map((b) => b.name) ?? []
				)
			case View.Branch:
				return []
			default:
				return []
		}
	}

	function filteredIndices(): number[] {
		const query = route.filterQuery.toLowerCase()
		const items = rawItems()
		if (!query) return items.map((_, i) => i)
		return items.reduce<number[]>((acc, item, i) => {
			if (item.toLowerCase().includes(query)) acc.push(i)
			return acc
		}, [])
	}

	function listLen(): number {
		return filteredIndices().length
	}

	function realIndex(filteredIdx?: number): number {
		const indices = filteredIndices()
		const idx = filteredIdx ?? route.cursor
		return indices[idx] ?? idx
	}

	function currentStory() {
		const idx = route.indices
		switch (route.view) {
			case View.Dashboard: {
				const target = flatStories()[realIndex()]
				if (!target) return null
				return store.epics[target.epicIdx]?.stories[target.storyIdx] ?? null
			}
			case View.Epic:
				return store.epics[idx[0]]?.stories[realIndex()] ?? null
			case View.Story:
			case View.Repo:
			case View.Branch:
				return store.epics[idx[0]]?.stories[idx[1]] ?? null
			default:
				return null
		}
	}

	function storyIndices(): [number, number] {
		const idx = route.indices
		if (route.view === View.Epic) return [idx[0], realIndex()]
		return [idx[0] ?? 0, idx[1] ?? 0]
	}

	function currentDetail(): DetailData | null {
		const epics = store.epics
		const c = route.cursors
		const ri = realIndex()

		if (route.view === View.Dashboard) {
			const target = flatStories()[ri]
			if (!target) return null
			const story = epics[target.epicIdx]?.stories[target.storyIdx]
			return story ? storyDetail(story, cache, integrations, theme) : null
		}
		if (route.level === 0) {
			const epic = epics[ri]
			return epic ? epicDetail(epic, cache) : null
		}
		if (route.level === 1) {
			const story = epics[c[0]]?.stories[ri]
			return story ? storyDetail(story, cache, integrations, theme) : null
		}
		if (route.level === 2) {
			const repo = epics[c[0]]?.stories[c[1]]?.repositories[ri]
			return repo ? repoDetail(repo, cache, theme) : null
		}
		if (route.level === 3) {
			const repo = epics[c[0]]?.stories[c[1]]?.repositories[c[2]]
			const branch = repo?.branches[ri]
			return repo && branch ? branchDetail(repo, branch, cache, integrations, theme) : null
		}
		return null
	}

	function selectedEpic(): Epic | null {
		const c = route.cursors
		const ri = realIndex()
		if (route.view === View.Dashboard) {
			const target = flatStories()[ri]
			return target ? (store.epics[target.epicIdx] ?? null) : null
		}
		return store.epics[c[0]] ?? null
	}

	function selectedStory(): Story | null {
		const c = route.cursors
		const ri = realIndex()
		if (route.view === View.Dashboard) {
			const target = flatStories()[ri]
			return target ? (store.epics[target.epicIdx]?.stories[target.storyIdx] ?? null) : null
		}
		const epic = store.epics[c[0]]
		if (!epic) return null
		if (route.view === View.Epic) return epic.stories[ri] ?? null
		return epic.stories[c[1]] ?? null
	}

	function selectedRepository(): Repository | null {
		const c = route.cursors
		const ri = realIndex()
		const story = store.epics[c[0]]?.stories[c[1]]
		if (!story) return null
		if (route.view === View.Story) return story.repositories[ri] ?? null
		return story.repositories[c[2]] ?? null
	}

	function selectedBranch(): Branch | null {
		const c = route.cursors
		const ri = realIndex()
		const repo = store.epics[c[0]]?.stories[c[1]]?.repositories[c[2]]
		if (!repo) return null
		if (route.view === View.Repo) return repo.branches[ri] ?? null
		return repo.branches[c[3]] ?? null
	}

	createEffect(
		on(
			() => [route.view, route.cursor],
			() => setDetailCursor(0),
		),
	)

	return {
		listLen,
		realIndex,
		flatStories,
		currentStory,
		storyIndices,
		currentDetail,
		selectedEpic,
		selectedStory,
		selectedRepository,
		selectedBranch,
		contextCursor,
		setContextCursor,
		detailCursor,
		setDetailCursor,
		suggestionCursor,
		setSuggestionCursor,
		suggestionCount,
		setSuggestionCount,
	}
}

export function useList() {
	return useAppStore().list
}

import { useAppStore } from "@tui/contexts/store"
import { Section } from "@tui/lib/keys"
import { createMemo, createSignal } from "solid-js"

export enum View {
	Dashboard = "dashboard",
	Epic = "epic",
	Story = "story",
	Repo = "repo",
	Branch = "branch",
}

export type Level = 0 | 1 | 2 | 3

export const VIEW_LABELS: Record<View, string> = {
	[View.Dashboard]: "Stories",
	[View.Epic]: "Stories",
	[View.Story]: "Repos",
	[View.Repo]: "Branches",
	[View.Branch]: "Branch",
}

export const LEVEL_NAMES = ["Epics", "Stories", "Repos", "Branches"] as const

interface ViewStateInternal {
	view: View
	indices: number[]
	cursor: number
	focusSection: Section
	filterQuery: string
	contextMode: number
}

export enum Panel {
	Repos = "repos",
	List = "list",
	Detail = "detail",
	Context = "context",
}

export type FocusPanel = Panel

function viewLevel(view: View): Level {
	switch (view) {
		case View.Dashboard:
			return 0
		case View.Epic:
			return 1
		case View.Story:
			return 2
		case View.Repo:
		case View.Branch:
			return 3
	}
}

function viewCursors(state: ViewStateInternal): [number, number, number, number] {
	const i = state.indices
	switch (state.view) {
		case View.Dashboard:
			return [state.cursor, 0, 0, 0]
		case View.Epic:
			return [i[0] ?? 0, state.cursor, 0, 0]
		case View.Story:
			return [i[0] ?? 0, i[1] ?? 0, state.cursor, 0]
		case View.Repo:
			return [i[0] ?? 0, i[1] ?? 0, i[2] ?? 0, state.cursor]
		case View.Branch:
			return [i[0] ?? 0, i[1] ?? 0, i[2] ?? 0, i[3] ?? 0]
	}
}

function focusPanelOf(state: ViewStateInternal): FocusPanel {
	if (state.view === View.Dashboard) return Panel.List
	if (state.focusSection === Section.List) return Panel.List
	if (state.focusSection === Section.Detail) return Panel.Detail
	return Panel.Context
}

function nextView(cur: View): View | null {
	switch (cur) {
		case View.Dashboard:
			return View.Epic
		case View.Epic:
			return View.Story
		case View.Story:
			return View.Repo
		case View.Repo:
			return View.Branch
		default:
			return null
	}
}

function makeViewState(view: View, indices: number[]): ViewStateInternal {
	return { view, indices, cursor: 0, focusSection: Section.List, filterQuery: "", contextMode: 0 }
}

const SECTION_CYCLE: Record<View, Section[]> = {
	[View.Dashboard]: [Section.List, Section.Detail, Section.Context],
	[View.Epic]: [Section.List, Section.Detail],
	[View.Story]: [Section.List, Section.Detail, Section.Context],
	[View.Repo]: [Section.List, Section.Detail],
	[View.Branch]: [Section.List, Section.Detail, Section.Context],
}

export interface RouteState {
	readonly view: View
	readonly indices: number[]
	readonly focusSection: Section
	readonly sectionCount: number
	readonly stack: ViewStateInternal[]
	readonly level: Level
	readonly cursor: number
	readonly cursors: [number, number, number, number]
	readonly focusPanel: FocusPanel
	readonly contextMode: number
	readonly filterQuery: string
	pushView: (view: View, idx: number) => void
	gotoStory: (epicIdx: number, storyIdx: number) => void
	popView: () => void
	goHome: () => void
	setFocusSection: (section: Section) => void
	setCursor: (value: number) => void
	setFocusPanel: (panel: FocusPanel) => void
	setContextMode: (mode: number) => void
	setFilterQuery: (query: string) => void
	enter: () => void
	back: () => void
	cycleFocus: () => void
}

export function createRouteState(): RouteState {
	const [current, setCurrent] = createSignal<ViewStateInternal>(makeViewState(View.Dashboard, []))
	const [stack, setStack] = createSignal<ViewStateInternal[]>([])

	const level = createMemo(() => viewLevel(current().view))
	const cursors = createMemo(() => viewCursors(current()))
	const cursor = createMemo(() => current().cursor)
	const focusPanel = createMemo(() => focusPanelOf(current()))

	function pushView(view: View, idx: number) {
		const prev = current()
		setStack((s) => [...s, prev])
		const newIndices = [...prev.indices, idx]
		setCurrent(makeViewState(view, newIndices))
	}

	function gotoStory(epicIdx: number, storyIdx: number) {
		const prev = current()
		setStack((s) => [...s, prev])
		setCurrent(makeViewState(View.Story, [epicIdx, storyIdx]))
	}

	function popView() {
		const s = stack()
		if (s.length === 0) return
		setCurrent(s[s.length - 1])
		setStack((prev) => prev.slice(0, -1))
	}

	function goHome() {
		setStack([])
		setCurrent(makeViewState(View.Dashboard, []))
	}

	function enter() {
		const cur = current()
		const next = nextView(cur.view)
		if (next) pushView(next, cur.cursor)
	}

	function back() {
		const cur = current()
		if (cur.filterQuery) {
			setCurrent({ ...cur, filterQuery: "", cursor: 0 })
		} else {
			popView()
		}
	}

	function setCursor(value: number) {
		setCurrent((prev) => ({ ...prev, cursor: value }))
	}

	function setFilterQuery(query: string) {
		setCurrent((prev) => ({ ...prev, filterQuery: query }))
	}

	function setContextMode(mode: number) {
		setCurrent((prev) => ({ ...prev, contextMode: mode }))
	}

	function setFocusSection(section: Section) {
		setCurrent((prev) => ({ ...prev, focusSection: section }))
	}

	function cycleFocus() {
		const cur = current()
		const cycle = SECTION_CYCLE[cur.view]
		const idx = cycle.indexOf(cur.focusSection)
		const next = cycle[(idx + 1) % cycle.length]
		setCurrent((prev) => ({ ...prev, focusSection: next }))
	}

	function setFocusPanel(panel: FocusPanel) {
		const panelToSection: Record<Panel, Section> = {
			[Panel.Repos]: Section.List,
			[Panel.List]: Section.List,
			[Panel.Detail]: Section.Detail,
			[Panel.Context]: Section.Context,
		}
		setFocusSection(panelToSection[panel])
	}

	return {
		get view() {
			return current().view
		},
		get indices() {
			return current().indices
		},
		get focusSection() {
			return current().focusSection
		},
		get sectionCount() {
			return SECTION_CYCLE[current().view].length
		},
		get stack() {
			return stack()
		},
		pushView,
		gotoStory,
		popView,
		goHome,
		setFocusSection,
		get level() {
			return level()
		},
		get cursor() {
			return cursor()
		},
		get cursors() {
			return cursors()
		},
		get focusPanel() {
			return focusPanel()
		},
		get contextMode() {
			return current().contextMode
		},
		get filterQuery() {
			return current().filterQuery
		},
		setCursor,
		setFocusPanel,
		setContextMode,
		setFilterQuery,
		enter,
		back,
		cycleFocus,
	}
}

export function useRoute() {
	return useAppStore().route
}

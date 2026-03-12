import { View } from "@tui/stores/route"

export enum Section {
	List = "list",
	Detail = "detail",
	Context = "context",
}

export enum Direction {
	Up = "up",
	Down = "down",
}

export const Key = {
	Up: "up",
	Down: "down",
	Left: "left",
	Right: "right",
	Return: "return",
	Escape: "escape",
	Space: "space",
	Tab: "tab",
	Backspace: "backspace",
	Delete: "delete",
	Home: "home",
	End: "end",
	PageUp: "pageup",
	PageDown: "pagedown",
} as const

export enum Action {
	MoveDown = "move_down",
	MoveUp = "move_up",
	Enter = "enter",
	Back = "back",
	Top = "top",
	Bottom = "bottom",
	GoHome = "go_home",

	CycleFocus = "cycle_focus",

	Help = "help",
	Connectors = "connectors",
	Filter = "filter",
	Refresh = "refresh",
	Fetch = "fetch",
	ToggleContextMode = "toggle_context_mode",

	TaskCycle = "task_cycle",
	TaskNew = "task_new",
	TaskEdit = "task_edit",
	TaskDelete = "task_delete",

	ReorderDown = "reorder_down",
	ReorderUp = "reorder_up",

	Describe = "describe",
	Suggest = "suggest",
	Cleanup = "cleanup",

	Activity = "activity",
	PollNow = "poll_now",

	SuggestionDismiss = "suggestion_dismiss",
	SuggestionAccept = "suggestion_accept",

	EventDismiss = "event_dismiss",
	EventDismissAll = "event_dismiss_all",
}

type ActionMap = Record<string, Action>

export const globalActions: ActionMap = {
	tab: Action.CycleFocus,
	"?": Action.Help,
	I: Action.Connectors,
	"/": Action.Filter,
	r: Action.Refresh,
	a: Action.Activity,
	R: Action.PollNow,
	H: Action.GoHome,
	x: Action.EventDismiss,
	X: Action.EventDismissAll,
}

const navActions: ActionMap = {
	j: Action.MoveDown,
	down: Action.MoveDown,
	k: Action.MoveUp,
	up: Action.MoveUp,
	g: Action.Top,
	G: Action.Bottom,
}

const listActions: ActionMap = {
	...navActions,
	return: Action.Enter,
	l: Action.Enter,
	escape: Action.Back,
	backspace: Action.Back,
	h: Action.Back,
	f: Action.Fetch,
	C: Action.Cleanup,
	S: Action.Suggest,
	P: Action.Describe,
	"ctrl+j": Action.ReorderDown,
	"ctrl+k": Action.ReorderUp,
}

const taskActions: ActionMap = {
	...navActions,
	c: Action.TaskCycle,
	return: Action.TaskCycle,
	n: Action.TaskNew,
	e: Action.TaskEdit,
	d: Action.TaskDelete,
	"ctrl+j": Action.ReorderDown,
	"ctrl+k": Action.ReorderUp,
}

const dashboardActions: ActionMap = {
	...navActions,
	return: Action.Enter,
	l: Action.Enter,
	escape: Action.Back,
	f: Action.Fetch,
	C: Action.Cleanup,
	S: Action.Suggest,
	P: Action.Describe,
	"ctrl+j": Action.ReorderDown,
	"ctrl+k": Action.ReorderUp,
}

const suggestionActions: ActionMap = {
	...navActions,
	return: Action.SuggestionAccept,
	d: Action.SuggestionDismiss,
}

const detailActions: ActionMap = {
	...navActions,
	return: Action.Enter,
	l: Action.Enter,
	escape: Action.Back,
	backspace: Action.Back,
	h: Action.Back,
}

const branchDetailActions: ActionMap = {
	...detailActions,
	v: Action.ToggleContextMode,
}

export function resolveAction(key: KeyEvent, view: View, focusSection: Section): Action | null {
	const normalized = normalizeKey(key)
	if (!normalized) return null

	const globalAction = globalActions[normalized]
	if (globalAction !== undefined) {
		if (globalAction === Action.GoHome && view === View.Dashboard) return null
		return globalAction
	}

	if (view === View.Dashboard) {
		if (focusSection === Section.Context) return suggestionActions[normalized] ?? null
		if (focusSection === Section.Detail) return detailActions[normalized] ?? null
		return dashboardActions[normalized] ?? null
	}

	if (view === View.Branch) {
		if (focusSection === Section.List) return branchDetailActions[normalized] ?? null
		return branchDetailActions[normalized] ?? null
	}

	if (focusSection === Section.List) return listActions[normalized] ?? null
	if (view === View.Story && focusSection === Section.Context)
		return taskActions[normalized] ?? null
	if (focusSection === Section.Detail) return detailActions[normalized] ?? null

	return navActions[normalized] ?? null
}

export const actionDescriptions: Record<Action, string> = {
	[Action.MoveDown]: "Move down",
	[Action.MoveUp]: "Move up",
	[Action.Enter]: "Drill into",
	[Action.Back]: "Go back",
	[Action.Top]: "Jump to top",
	[Action.Bottom]: "Jump to bottom",
	[Action.GoHome]: "Go to dashboard",
	[Action.CycleFocus]: "Cycle focus",
	[Action.Help]: "Help",
	[Action.Connectors]: "Connectors",
	[Action.Filter]: "Filter",
	[Action.Refresh]: "Refresh git data",
	[Action.Fetch]: "Fetch remotes",
	[Action.ToggleContextMode]: "Toggle context mode",
	[Action.TaskCycle]: "Cycle task status",
	[Action.TaskNew]: "New task",
	[Action.TaskEdit]: "Edit task",
	[Action.TaskDelete]: "Delete task",
	[Action.ReorderDown]: "Move item down",
	[Action.ReorderUp]: "Move item up",
	[Action.Describe]: "Describe / Prune",
	[Action.Suggest]: "AI suggest tasks",
	[Action.Cleanup]: "Cleanup story",
	[Action.Activity]: "Activity feed",
	[Action.PollNow]: "Force poll all",
	[Action.SuggestionDismiss]: "Dismiss suggestion",
	[Action.SuggestionAccept]: "Accept suggestion (create story)",
	[Action.EventDismiss]: "Dismiss latest event for story",
	[Action.EventDismissAll]: "Dismiss all events for story",
}

interface KeyEvent {
	name?: string
	shift?: boolean
	ctrl?: boolean
}

function normalizeKey(key: KeyEvent): string {
	const name = key.shift && key.name?.length === 1 ? key.name.toUpperCase() : key.name
	if (!name) return ""
	if (key.ctrl) return `ctrl+${name}`
	return name
}

export function helpBindings(): { key: string; desc: string }[] {
	const seen = new Set<Action>()
	const result: { key: string; desc: string }[] = []

	function collect(map: ActionMap) {
		const actionKeys = new Map<Action, string[]>()
		for (const [key, action] of Object.entries(map)) {
			if (seen.has(action)) continue
			const keys = actionKeys.get(action) ?? []
			keys.push(formatKey(key))
			actionKeys.set(action, keys)
		}
		for (const [action, keys] of actionKeys) {
			seen.add(action)
			result.push({ key: keys.join(" / "), desc: actionDescriptions[action] })
		}
	}

	collect(globalActions)
	collect(listActions)
	result.push({ key: "Ctrl+C", desc: "Quit" })
	return result
}

function formatKey(raw: string): string {
	const map: Record<string, string> = {
		return: "Enter",
		escape: "Esc",
		backspace: "Bksp",
		tab: "Tab",
		up: "Up",
		down: "Down",
	}
	if (raw.startsWith("ctrl+")) return `Ctrl+${raw.slice(5)}`
	return map[raw] ?? raw
}

import type { Config } from "@db/config"
import type { Repos } from "@db/queries/repos"
import type { ThemeColors } from "@tui/contexts/theme"
import { createTaskManager, type TaskManager } from "@tui/handlers/tasks"
import { type CacheState, createCacheState } from "@tui/stores/cache"
import { createDialogState, type DialogState } from "@tui/stores/dialog"
import { createEpicsState, type EpicsState } from "@tui/stores/epics"
import { createIntegrationsState, type IntegrationsState } from "@tui/stores/integrations"
import { createLayoutState, type LayoutState } from "@tui/stores/layout"
import { createListState, type ListState } from "@tui/stores/list"
import { createMonitorState, type MonitorState } from "@tui/stores/monitor"
import { createReposState, type ReposState } from "@tui/stores/repos"
import { createRouteState, type RouteState } from "@tui/stores/route"
import { createStatusState, type StatusState } from "@tui/stores/status"
import { createSuggestionsState, type SuggestionsState } from "@tui/stores/suggestions"

export interface AppStore {
	status: StatusState
	layout: LayoutState
	route: RouteState
	dialog: DialogState
	store: EpicsState
	cache: CacheState
	localRepos: ReposState
	repos: Repos
	integrations: IntegrationsState
	suggestions: SuggestionsState
	list: ListState
	monitor: MonitorState
	tasks: TaskManager
}

export interface AppStoreDeps {
	repos: Repos
	config: () => Config
	theme: ThemeColors
	onExit: (fn: () => void) => void
}

export function createAppStore(deps: AppStoreDeps): AppStore {
	const { repos, config, theme, onExit } = deps

	const status = createStatusState()
	const layout = createLayoutState()
	const route = createRouteState()
	const dialog = createDialogState()
	const store = createEpicsState(repos)
	const tasks = createTaskManager(store.setState)
	const localRepos = createReposState()
	const cache = createCacheState({ store, config })
	const integrations = createIntegrationsState({ store, config })
	const suggestions = createSuggestionsState({ repos })
	const list = createListState({ route, store, cache, integrations, theme })
	const monitor = createMonitorState({
		store,
		cache,
		integrations,
		suggestions,
		localRepos,
		config,
		route,
		status,
		dialog,
		repos,
		onExit,
	})

	return {
		status,
		layout,
		route,
		dialog,
		store,
		cache,
		localRepos,
		repos,
		integrations,
		suggestions,
		list,
		monitor,
		tasks,
	}
}

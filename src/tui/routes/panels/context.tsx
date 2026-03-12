import type { LogEntry } from "@integrations/git/client"
import type { LinkedIssue, Pipeline, PullRequest } from "@integrations/types"
import { DriftList } from "@tui/components/drift-list"
import { GitLog } from "@tui/components/git-log"
import { IntegrationInfo } from "@tui/components/integration-info"
import { TaskList } from "@tui/components/task-list"
import { useTheme } from "@tui/contexts/theme"
import { useCache } from "@tui/stores/cache"
import { createDriftAccessors, type DriftEntry, epicDriftEntries } from "@tui/stores/drift"
import { useEpics } from "@tui/stores/epics"
import { useIntegrations } from "@tui/stores/integrations"
import { useList } from "@tui/stores/list"
import { Panel, useRoute } from "@tui/stores/route"
import { createMemo, Match, Switch } from "solid-js"

export function ContextPanel() {
	const route = useRoute()
	const store = useEpics()
	const theme = useTheme()
	const cache = useCache()
	const list = useList()
	const integrations = useIntegrations()

	const story = createMemo(() => {
		const c = route.cursors
		if (route.level === 0) return null
		const epic = store.epics[c[0]]
		const si = route.level === 1 ? list.realIndex() : c[1]
		return epic?.stories[si] ?? null
	})

	const tasks = createMemo(() => story()?.tasks ?? [])

	const driftAccessors = createDriftAccessors(cache, integrations)

	const driftEntries = createMemo((): DriftEntry[] => {
		if (route.level !== 0) return []
		const epic = store.epics[list.realIndex()]
		if (!epic) return []
		return epicDriftEntries(epic.stories, driftAccessors, {
			danger: theme.danger,
			warning: theme.warning,
			gitClean: theme.gitClean,
		})
	})

	const logEntries = createMemo((): LogEntry[] => {
		if (route.level < 2) return []
		const c = route.cursors
		const ri = list.realIndex()
		const repo = store.epics[c[0]]?.stories[c[1]]?.repositories[route.level === 2 ? ri : c[2]]
		if (!repo) return []
		if (route.level === 3) {
			const branch = repo.branches[ri]
			if (!branch) return []
			const key = cache.branchKey(repo.path, branch.name)
			return cache.logs[key] ?? []
		}
		return cache.logs[repo.path] ?? []
	})

	const branchInfo = createMemo(
		(): {
			prs: PullRequest[]
			pipeline: Pipeline | null
			linked: LinkedIssue[]
		} | null => {
			if (route.level !== 3) return null
			const c = route.cursors
			const repo = store.epics[c[0]]?.stories[c[1]]?.repositories[c[2]]
			const branch = repo?.branches[list.realIndex()]
			if (!repo || !branch) return null
			return {
				prs: integrations.getPRs(repo.path, branch.name),
				pipeline: integrations.getPipeline(repo.path, branch.name),
				linked: integrations.getLinkedIssues(repo.path, branch.name),
			}
		},
	)

	const isFocused = () => route.focusPanel === Panel.Context

	return (
		<box flexDirection="column" paddingLeft={1} paddingRight={1} flexGrow={1}>
			<Switch>
				<Match when={route.level === 0}>
					<DriftList entries={driftEntries()} theme={theme} />
				</Match>

				<Match when={route.level === 1}>
					<TaskList
						tasks={tasks()}
						selectedIndex={list.contextCursor()}
						isFocused={isFocused()}
						theme={theme}
						emptyHint={isFocused()}
					/>
				</Match>

				<Match when={route.level >= 2 && (route.level < 3 || route.contextMode === 0)}>
					<GitLog entries={logEntries()} ticket={story()?.ticket} theme={theme} />
				</Match>

				<Match when={route.level === 3 && route.contextMode === 1}>
					{(() => {
						const info = branchInfo()
						if (!info) return <text fg={theme.textDim}>No integration data</text>
						return (
							<IntegrationInfo
								prs={info.prs}
								pipeline={info.pipeline}
								linked={info.linked}
								theme={theme}
							/>
						)
					})()}
				</Match>
			</Switch>
		</box>
	)
}

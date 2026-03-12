import { GitLog } from "@tui/components/git-log"
import { IntegrationInfo } from "@tui/components/integration-info"
import { useTheme } from "@tui/contexts/theme"
import { DetailSection } from "@tui/detail"
import { branchDetail } from "@tui/detail/branch"
import { ColumnPadding } from "@tui/layout"
import { Section } from "@tui/lib/keys"
import { useCache } from "@tui/stores/cache"
import { useEpics } from "@tui/stores/epics"
import { useIntegrations } from "@tui/stores/integrations"
import { useList } from "@tui/stores/list"
import { useRoute } from "@tui/stores/route"
import { createMemo, Show } from "solid-js"

export function BranchView() {
	const route = useRoute()
	const store = useEpics()
	const cache = useCache()
	const integrations = useIntegrations()
	const theme = useTheme()
	const list = useList()

	const repo = createMemo(
		() => store.epics[route.indices[0]]?.stories[route.indices[1]]?.repositories[route.indices[2]],
	)

	const branch = createMemo(() => repo()?.branches[route.indices[3]])

	const story = createMemo(() => store.epics[route.indices[0]]?.stories[route.indices[1]])

	const detail = createMemo(() => {
		const r = repo()
		const b = branch()
		return r && b ? branchDetail(r, b, cache, integrations, theme) : null
	})

	const branchInfo = createMemo(() => {
		const r = repo()
		const b = branch()
		if (!r || !b) return null
		return {
			prs: integrations.getPRs(r.path, b.name),
			pipeline: integrations.getPipeline(r.path, b.name),
			linked: integrations.getLinkedIssues(r.path, b.name),
		}
	})

	const logEntries = createMemo(() => {
		const r = repo()
		const b = branch()
		if (!r || !b) return []
		const key = cache.branchKey(r.path, b.name)
		return cache.logs[key] ?? []
	})

	return (
		<box flexDirection="column" flexGrow={1}>
			<box flexDirection="column" flexGrow={1}>
				<box height={1} paddingLeft={ColumnPadding} backgroundColor={theme.bgElement}>
					<text fg={theme.textMuted}>Detail</text>
				</box>
				<DetailSection
					detail={detail()}
					cursor={list.detailCursor()}
					isFocused={route.focusSection === Section.List}
				/>
			</box>

			<box flexDirection="column" flexGrow={1}>
				<box height={1} paddingLeft={ColumnPadding} backgroundColor={theme.bgElement}>
					<text fg={theme.textMuted}>Integrations</text>
				</box>
				<Show
					when={branchInfo()}
					fallback={
						<box paddingLeft={ColumnPadding} paddingTop={1}>
							<text fg={theme.textDim}>No integration data</text>
						</box>
					}
				>
					{(info) => (
						<IntegrationInfo
							prs={info().prs}
							pipeline={info().pipeline}
							linked={info().linked}
							theme={theme}
						/>
					)}
				</Show>
			</box>

			<box flexDirection="column" flexGrow={1}>
				<box height={1} paddingLeft={ColumnPadding} backgroundColor={theme.bgElement}>
					<text fg={theme.textMuted}>Git Log</text>
				</box>
				<GitLog entries={logEntries()} ticket={story()?.ticket} theme={theme} />
			</box>
		</box>
	)
}

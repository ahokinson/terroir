import { DriftList } from "@tui/components/drift-list"
import { useTheme } from "@tui/contexts/theme"
import { epicDetail } from "@tui/detail/epic"
import { storyListItems } from "@tui/routes/panels/items"
import { ListDetailView } from "@tui/routes/views/list-detail"
import { useCache } from "@tui/stores/cache"
import { createDriftAccessors, epicDriftEntries } from "@tui/stores/drift"
import { useEpics } from "@tui/stores/epics"
import { useIntegrations } from "@tui/stores/integrations"
import { useRoute } from "@tui/stores/route"
import { createMemo } from "solid-js"

export function EpicView() {
	const route = useRoute()
	const store = useEpics()
	const cache = useCache()
	const integrations = useIntegrations()
	const theme = useTheme()
	const driftAccessors = createDriftAccessors(cache, integrations)

	const epic = createMemo(() => store.epics[route.indices[0]])

	const storyCtx = {
		getTicketSummary: (key: string) => integrations.getTicket(key)?.summary ?? null,
		isRepoDirty: (path: string) => cache.repos[path]?.status?.dirty ?? false,
		hasOpenPR: (repoPath: string, branchName: string) =>
			integrations.hasOpenPR(repoPath, branchName),
	}

	const items = createMemo(() => {
		const e = epic()
		if (!e) return []
		return storyListItems(e.stories, theme, storyCtx, driftAccessors)
	})

	const detail = createMemo(() => {
		const e = epic()
		return e ? epicDetail(e, cache) : null
	})

	const driftEntries = createMemo(() => {
		const e = epic()
		if (!e) return []
		return epicDriftEntries(e.stories, driftAccessors, {
			danger: theme.danger,
			warning: theme.warning,
			gitClean: theme.gitClean,
		})
	})

	return (
		<ListDetailView
			items={items}
			detail={detail}
			listHeader="Stories"
			emptyText="No stories yet"
			secondaryLabel="Drift"
			secondary={<DriftList entries={driftEntries()} theme={theme} />}
		/>
	)
}

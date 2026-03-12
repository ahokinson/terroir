import { ScrollableList } from "@tui/components/scrollable-list"
import { useTheme } from "@tui/contexts/theme"
import {
	branchListItems,
	epicListItems,
	repoListItems,
	storyListItems,
} from "@tui/routes/panels/items"
import { useCache } from "@tui/stores/cache"
import { createDriftAccessors } from "@tui/stores/drift"
import { useEpics } from "@tui/stores/epics"
import { useIntegrations } from "@tui/stores/integrations"
import { LEVEL_NAMES, useRoute } from "@tui/stores/route"
import { createMemo } from "solid-js"

export function ListPanel() {
	const route = useRoute()
	const store = useEpics()
	const integrations = useIntegrations()
	const cache = useCache()
	const theme = useTheme()
	const driftAccessors = createDriftAccessors(cache, integrations)

	const storyCtx = {
		getTicketSummary: (key: string) => {
			const info = integrations.getTicket(key)
			return info?.summary ?? null
		},
		isRepoDirty: (path: string) => cache.repos[path]?.status?.dirty ?? false,
		hasOpenPR: (repoPath: string, branchName: string) =>
			integrations.hasOpenPR(repoPath, branchName),
	}

	const repoCtx = {
		getRepoStatus: (path: string) => cache.repos[path]?.status ?? null,
	}

	const branchCtx = {
		getBranchStatus: (repoPath: string, branchName: string) => {
			const key = cache.branchKey(repoPath, branchName)
			const bs = cache.branches[key]
			if (!bs) return null
			return { session: bs.session, aheadBehind: bs.aheadBehind }
		},
		getPRs: (repoPath: string, branchName: string) => integrations.getPRs(repoPath, branchName),
	}

	const items = createMemo(() => {
		const epics = store.epics
		const c = route.cursors
		switch (route.level) {
			case 0:
				return epicListItems(epics, theme, driftAccessors)
			case 1: {
				const epic = epics[c[0]]
				if (!epic) return []
				return storyListItems(epic.stories, theme, storyCtx, driftAccessors)
			}
			case 2: {
				const story = epics[c[0]]?.stories[c[1]]
				if (!story) return []
				return repoListItems(story.repositories, theme, repoCtx)
			}
			case 3: {
				const repo = epics[c[0]]?.stories[c[1]]?.repositories[c[2]]
				if (!repo) return []
				return branchListItems(repo.branches, repo.path, theme, branchCtx)
			}
			default:
				return []
		}
	})

	const filteredItems = createMemo(() => {
		const query = route.filterQuery.toLowerCase()
		if (!query) return items()
		return items().filter((item) => item.label.toLowerCase().includes(query))
	})

	return (
		<ScrollableList
			items={filteredItems()}
			cursor={route.cursor}
			highlightQuery={route.filterQuery}
			emptyText={
				route.filterQuery
					? `No matches for "${route.filterQuery}"`
					: `No ${LEVEL_NAMES[route.level].toLowerCase()} yet — n to create`
			}
		/>
	)
}

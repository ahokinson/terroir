import { GitLog } from "@tui/components/git-log"
import { useTheme } from "@tui/contexts/theme"
import { repoDetail } from "@tui/detail/repo"
import { branchListItems } from "@tui/routes/panels/items"
import { ListDetailView } from "@tui/routes/views/list-detail"
import { useCache } from "@tui/stores/cache"
import { useEpics } from "@tui/stores/epics"
import { useIntegrations } from "@tui/stores/integrations"
import { useRoute } from "@tui/stores/route"
import { createMemo } from "solid-js"

export function RepoView() {
	const route = useRoute()
	const store = useEpics()
	const cache = useCache()
	const integrations = useIntegrations()
	const theme = useTheme()

	const repo = createMemo(
		() => store.epics[route.indices[0]]?.stories[route.indices[1]]?.repositories[route.indices[2]],
	)

	const story = createMemo(() => store.epics[route.indices[0]]?.stories[route.indices[1]])

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
		const r = repo()
		if (!r) return []
		return branchListItems(r.branches, r.path, theme, branchCtx)
	})

	const detail = createMemo(() => {
		const r = repo()
		return r ? repoDetail(r, cache, theme) : null
	})

	const logEntries = createMemo(() => {
		const r = repo()
		if (!r) return []
		return cache.logs[r.path] ?? []
	})

	return (
		<ListDetailView
			items={items}
			detail={detail}
			listHeader="Branches"
			emptyText="No branches yet"
			secondaryLabel="Git Log"
			secondary={<GitLog entries={logEntries()} ticket={story()?.ticket} theme={theme} />}
		/>
	)
}

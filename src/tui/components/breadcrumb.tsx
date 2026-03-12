import { Status } from "@db/types"
import { repoName } from "@integrations/git/client"
import { useTheme } from "@tui/contexts/theme"
import { Icon } from "@tui/icons"
import { useEpics } from "@tui/stores/epics"
import { useMonitor } from "@tui/stores/monitor"
import { useRoute, View } from "@tui/stores/route"
import { createMemo, For, Show } from "solid-js"

export function Breadcrumb() {
	const route = useRoute()
	const store = useEpics()
	const theme = useTheme()
	const monitor = useMonitor()

	const crumbs = () => {
		const parts: string[] = []
		const indices = route.indices
		const epics = store.epics
		if (route.view === View.Dashboard) return parts

		const epic = epics[indices[0]]
		if (epic) parts.push(epic.name || "(No Epic)")

		if (route.view === View.Epic) return parts

		const story = epic?.stories[indices[1]]
		if (story) parts.push(story.name)

		if (route.view === View.Story) return parts

		const repo = story?.repositories[indices[2]]
		if (repo) parts.push(repoName(repo.path))

		if (route.view === View.Repo) return parts

		const branch = repo?.branches[indices[3]]
		if (branch) parts.push(branch.name)

		return parts
	}

	const stats = createMemo(() => {
		let storyCount = 0
		let activeCount = 0
		let tasksDone = 0
		let tasksTotal = 0
		for (const epic of store.epics) {
			storyCount += epic.stories.length
			for (const s of epic.stories) {
				if (!s.completedAt) activeCount++
				for (const t of s.tasks) {
					tasksTotal++
					if (t.status === Status.Done) tasksDone++
				}
			}
		}
		return { storyCount, activeCount, tasksDone, tasksTotal }
	})

	const info = () => (
		<text>
			<span fg={theme.textMuted}>{`${Icon.square.char} ${stats().storyCount} stories`}</span>
			<Show when={stats().activeCount > 0}>
				<span
					fg={theme.success}
				>{`  ${Icon.circleFilled.char} ${stats().activeCount} active`}</span>
			</Show>
			<Show when={stats().tasksTotal > 0}>
				<span
					fg={theme.textDim}
				>{`  ${Icon.check.char} ${stats().tasksDone}/${stats().tasksTotal} tasks`}</span>
			</Show>
			<Show when={monitor.unreadCount > 0}>
				<span fg={theme.warning}>{`  ${Icon.warning.char} ${monitor.unreadCount} new`}</span>
			</Show>
		</text>
	)

	return (
		<box
			height={1}
			paddingLeft={1}
			paddingRight={1}
			flexDirection="row"
			justifyContent="space-between"
			backgroundColor={theme.bgPanel}
		>
			<Show when={route.view !== View.Dashboard} fallback={info()}>
				<text>
					<For each={crumbs()}>
						{(crumb, i) => (
							<>
								{i() > 0 && <span fg={theme.textDim}>{` ${Icon.chevron.char} `}</span>}
								<span fg={i() === crumbs().length - 1 ? theme.accent : theme.textMuted}>
									{crumb}
								</span>
							</>
						)}
					</For>
				</text>
			</Show>
			<Show when={route.view !== View.Dashboard}>{info()}</Show>
		</box>
	)
}

import { TaskList } from "@tui/components/task-list"
import { useTheme } from "@tui/contexts/theme"
import { storyDetail } from "@tui/detail/story"
import { Section } from "@tui/lib/keys"
import { repoListItems } from "@tui/routes/panels/items"
import { ListDetailView } from "@tui/routes/views/list-detail"
import { useCache } from "@tui/stores/cache"
import { useEpics } from "@tui/stores/epics"
import { useIntegrations } from "@tui/stores/integrations"
import { useList } from "@tui/stores/list"
import { useMonitor } from "@tui/stores/monitor"
import { useRoute } from "@tui/stores/route"
import { createEffect, createMemo, For, on, Show } from "solid-js"

const EVENT_TAIL_LIMIT = 5

export function StoryView() {
	const route = useRoute()
	const store = useEpics()
	const cache = useCache()
	const integrations = useIntegrations()
	const theme = useTheme()
	const list = useList()
	const monitor = useMonitor()

	const story = createMemo(() => store.epics[route.indices[0]]?.stories[route.indices[1]])

	const repoCtx = {
		getRepoStatus: (path: string) => cache.repos[path]?.status ?? null,
		getRepoFindings: (path: string) => integrations.getRepoFindings(path),
		getRepoSignals: (path: string) => integrations.getRepoSignals(path),
	}

	const items = createMemo(() => {
		const s = story()
		if (!s) return []
		return repoListItems(s.repositories, theme, repoCtx)
	})

	const detail = createMemo(() => {
		const s = story()
		return s ? storyDetail(s, cache, integrations, theme) : null
	})

	const tasks = createMemo(() => story()?.tasks ?? [])

	const storyEvents = createMemo(() => {
		const s = story()
		if (!s) return []
		return monitor.events
			.filter((ev) => ev.storyName === s.name && !ev.dismissed)
			.slice(0, EVENT_TAIL_LIMIT)
	})

	createEffect(
		on(
			() => story()?.name,
			(name) => {
				if (name) monitor.markStoryRead(name)
			},
		),
	)

	return (
		<ListDetailView
			items={items}
			detail={detail}
			listHeader="Repositories"
			emptyText="No repos yet"
			secondaryLabel="Tasks"
			secondary={
				<box flexDirection="column" flexGrow={1}>
					<TaskList
						tasks={tasks()}
						selectedIndex={route.focusSection === Section.Context ? list.contextCursor() : -1}
						isFocused={route.focusSection === Section.Context}
						theme={theme}
						emptyHint={route.focusSection === Section.Context}
					/>
					<Show when={storyEvents().length > 0}>
						<box flexDirection="column" paddingTop={1}>
							<text fg={theme.textMuted}>Events — x dismiss / X dismiss all</text>
							<For each={storyEvents()}>
								{(ev) => <text fg={ev.read ? theme.textDim : theme.text}>{`  ${ev.summary}`}</text>}
							</For>
						</box>
					</Show>
				</box>
			}
		/>
	)
}

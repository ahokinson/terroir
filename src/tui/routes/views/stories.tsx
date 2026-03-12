import type { Story } from "@db/types"
import type { ListItem, SuffixSegment } from "@tui/components/scrollable-list"
import { ScrollableList } from "@tui/components/scrollable-list"
import { useTheme } from "@tui/contexts/theme"
import { DetailSection } from "@tui/detail"
import { Icon } from "@tui/icons"
import {
	ColumnPadding,
	FullPanelWidth,
	ListDetailContextWidth,
	ListDetailListWidth,
} from "@tui/layout"
import { Section } from "@tui/lib/keys"
import { storyListItems } from "@tui/routes/panels/items"
import { useCache } from "@tui/stores/cache"
import { createDriftAccessors } from "@tui/stores/drift"
import { useEpics } from "@tui/stores/epics"
import { useIntegrations } from "@tui/stores/integrations"
import { LayoutMode, useLayout } from "@tui/stores/layout"
import { type FlatStory, useList } from "@tui/stores/list"
import { useMonitor } from "@tui/stores/monitor"
import { useRoute } from "@tui/stores/route"
import { useSuggestions } from "@tui/stores/suggestions"
import { createEffect, createMemo, Show } from "solid-js"

const SUGGESTION_VISIBLE_LIMIT = 5

export function StoriesView() {
	const route = useRoute()
	const theme = useTheme()
	const list = useList()
	const layout = useLayout()
	const store = useEpics()
	const cache = useCache()
	const integrations = useIntegrations()
	const suggestions = useSuggestions()
	const monitor = useMonitor()
	const driftAccessors = createDriftAccessors(cache, integrations)

	const storyCtx = {
		getTicketSummary: (key: string) => integrations.getTicket(key)?.summary ?? null,
		isRepoDirty: (path: string) => cache.repos[path]?.status?.dirty ?? false,
		hasOpenPR: (repoPath: string, branchName: string) =>
			integrations.hasOpenPR(repoPath, branchName),
	}

	const flat = createMemo(() => list.flatStories())

	const stories = createMemo<Story[]>(() => {
		const epics = store.epics
		return flat()
			.map((f) => epics[f.epicIdx]?.stories[f.storyIdx])
			.filter((s): s is Story => !!s)
	})

	const epicNamesByIdx = createMemo(() => {
		const out = new Map<number, string>()
		const flatList = flat()
		for (const f of flatList) {
			out.set(f.epicIdx, store.epics[f.epicIdx]?.name ?? "")
		}
		return out
	})

	const baseItems = createMemo(() => storyListItems(stories(), theme, storyCtx, driftAccessors))

	const items = createMemo<ListItem[]>(() => {
		const flatList = flat()
		const base = baseItems()
		const ss = stories()
		return base.map((row, i) => {
			const story = ss[i]
			const epicName = epicNamesByIdx().get(flatList[i]?.epicIdx ?? -1) ?? ""
			const unread = story ? monitor.unackedCountForStory(story.name) : 0
			const extra: SuffixSegment[] = []
			if (unread > 0) extra.push({ text: `● ${unread}`, color: theme.warning })
			if (epicName) extra.push({ text: epicName, color: theme.textDim })
			if (extra.length === 0) return row
			return { ...row, suffix: [...(row.suffix ?? []), ...extra] }
		})
	})

	const filtered = createMemo<{ items: ListItem[]; mapping: FlatStory[] }>(() => {
		const query = route.filterQuery.toLowerCase()
		const all = items()
		const mapping = flat()
		if (!query) return { items: all, mapping }
		const outItems: ListItem[] = []
		const outMap: FlatStory[] = []
		for (let i = 0; i < all.length; i++) {
			if (all[i].label.toLowerCase().includes(query)) {
				outItems.push(all[i])
				outMap.push(mapping[i])
			}
		}
		return { items: outItems, mapping: outMap }
	})

	const detail = createMemo(() => list.currentDetail())

	const visibleSuggestions = createMemo(() => suggestions.items.slice(0, SUGGESTION_VISIBLE_LIMIT))

	createEffect(() => {
		list.setSuggestionCount(visibleSuggestions().length)
		if (list.suggestionCursor() >= visibleSuggestions().length) {
			list.setSuggestionCursor(Math.max(0, visibleSuggestions().length - 1))
		}
	})

	const suggestionItems = createMemo<ListItem[]>(() =>
		visibleSuggestions().map((s) => {
			const ageSuffix: SuffixSegment[] = []
			ageSuffix.push({ text: s.item.source })
			if (s.item.ticketKey) ageSuffix.push({ text: s.item.ticketKey })
			return {
				label: s.item.name,
				suffix: ageSuffix,
				glyph: Icon.diamond.char,
				glyphColor: theme.warning,
			}
		}),
	)

	const listWidth = createMemo(() => {
		switch (layout.mode) {
			case LayoutMode.Narrow:
				return FullPanelWidth
			case LayoutMode.Standard:
				return ListDetailListWidth
			case LayoutMode.Wide:
				return ListDetailContextWidth
		}
	})

	const showList = createMemo(() => {
		if (layout.mode !== LayoutMode.Narrow) return true
		return route.focusSection === Section.List
	})

	const showRight = createMemo(() => {
		if (layout.mode !== LayoutMode.Narrow) return true
		return route.focusSection !== Section.List
	})

	return (
		<box flexDirection="row" flexGrow={1} gap={1}>
			<Show when={showList()}>
				<box flexDirection="column" width={listWidth()}>
					<ScrollableList
						items={filtered().items}
						cursor={route.focusSection === Section.List ? route.cursor : -1}
						highlightQuery={route.filterQuery}
						emptyText={
							route.filterQuery ? `No matches for "${route.filterQuery}"` : "No stories yet"
						}
						headers={[{ label: `Stories (${stories().length})` }]}
					/>
				</box>
			</Show>

			<Show when={showRight()}>
				<box flexDirection="column" flexGrow={1}>
					<box flexDirection="column" flexGrow={1}>
						<box height={1} paddingLeft={ColumnPadding} backgroundColor={theme.bgElement}>
							<text fg={theme.textMuted}>Detail</text>
						</box>
						<DetailSection
							detail={detail()}
							cursor={list.detailCursor()}
							isFocused={route.focusSection === Section.Detail}
						/>
					</box>

					<Show when={visibleSuggestions().length > 0}>
						<box flexDirection="column">
							<box height={1} paddingLeft={ColumnPadding} backgroundColor={theme.bgElement}>
								<text fg={theme.textMuted}>
									Suggestions ({suggestions.items.length}) — ↵ create / d dismiss
								</text>
							</box>
							<ScrollableList
								items={suggestionItems()}
								cursor={route.focusSection === Section.Context ? list.suggestionCursor() : -1}
								emptyText=""
							/>
						</box>
					</Show>
				</box>
			</Show>
		</box>
	)
}

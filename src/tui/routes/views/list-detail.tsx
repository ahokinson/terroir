import type { ListItem } from "@tui/components/scrollable-list"
import { ScrollableList } from "@tui/components/scrollable-list"
import { useTheme } from "@tui/contexts/theme"
import { DetailSection } from "@tui/detail"
import type { DetailData } from "@tui/detail/types"
import {
	ColumnPadding,
	FullPanelWidth,
	ListDetailContextWidth,
	ListDetailListWidth,
} from "@tui/layout"
import { Section } from "@tui/lib/keys"
import { LayoutMode, useLayout } from "@tui/stores/layout"
import { useList } from "@tui/stores/list"
import { useRoute } from "@tui/stores/route"
import { createMemo, type JSX, Show } from "solid-js"

interface ListDetailViewProps {
	items: () => ListItem[]
	detail: () => DetailData | null
	listHeader: string
	emptyText: string
	secondaryLabel: string
	secondary: JSX.Element
}

export function ListDetailView(props: ListDetailViewProps) {
	const route = useRoute()
	const theme = useTheme()
	const list = useList()
	const layout = useLayout()

	const filteredItems = createMemo(() => {
		const query = route.filterQuery.toLowerCase()
		if (!query) return props.items()
		return props.items().filter((item) => item.label.toLowerCase().includes(query))
	})

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
						items={filteredItems()}
						cursor={route.focusSection === Section.List ? route.cursor : -1}
						highlightQuery={route.filterQuery}
						emptyText={
							route.filterQuery ? `No matches for "${route.filterQuery}"` : props.emptyText
						}
						headers={[{ label: props.listHeader }]}
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
							detail={props.detail()}
							cursor={list.detailCursor()}
							isFocused={route.focusSection === Section.Detail}
						/>
					</box>

					<box flexDirection="column" flexGrow={1}>
						<box height={1} paddingLeft={ColumnPadding} backgroundColor={theme.bgElement}>
							<text fg={theme.textMuted}>{props.secondaryLabel}</text>
						</box>
						{props.secondary}
					</box>
				</box>
			</Show>
		</box>
	)
}

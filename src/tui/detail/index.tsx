import { useTheme } from "@tui/contexts/theme"
import type { DetailData, DetailRow } from "@tui/detail/types"
import { ColumnPadding, createScrollboxOptions, LabelWidth } from "@tui/layout"
import { createScrollSync, type ScrollRef } from "@tui/lib/signals"
import { useList } from "@tui/stores/list"
import { Panel, useRoute } from "@tui/stores/route"
import { createMemo, createSignal, Index, Show } from "solid-js"

export function flatRows(detail: DetailData): DetailRow[] {
	const rows: DetailRow[] = []
	for (const section of detail.sections) {
		for (const row of section.rows) {
			rows.push(row)
		}
	}
	return rows
}

interface SectionBreak {
	break: true
}
type RenderItem = (DetailRow & { flatIdx: number }) | SectionBreak

function isBreak(item: RenderItem): item is SectionBreak {
	return "break" in item
}

export function DetailSection(props: {
	detail: DetailData | null
	cursor?: number
	isFocused?: boolean
}) {
	const theme = useTheme()
	const scrollboxOptions = createScrollboxOptions(theme)
	const [scrollRef, setScrollRef] = createSignal<ScrollRef | null>(null)

	const renderItems = createMemo((): RenderItem[] => {
		if (!props.detail) return []
		const items: RenderItem[] = []
		let flatIdx = 0
		for (let si = 0; si < props.detail.sections.length; si++) {
			if (si > 0) items.push({ break: true })
			for (const row of props.detail.sections[si].rows) {
				items.push({ ...row, flatIdx })
				flatIdx++
			}
		}
		return items
	})

	const visualRow = createMemo(() => {
		const target = props.cursor
		if (target === undefined) return 0
		const items = renderItems()
		let row = 0
		for (const item of items) {
			if (isBreak(item)) {
				row++
				continue
			}
			if (item.flatIdx === target) return row
			row++
		}
		return 0
	})

	createScrollSync(visualRow, scrollRef)

	return (
		<scrollbox flexGrow={1} ref={setScrollRef} {...scrollboxOptions}>
			<box flexDirection="column" paddingLeft={ColumnPadding} paddingRight={1} flexShrink={0}>
				<Show when={props.detail} fallback={<text fg={theme.textDim}>Nothing selected</text>}>
					<Index each={renderItems()}>
						{(item) => {
							const it = item()
							if (isBreak(it)) {
								return <box height={1} />
							}
							const selected = () =>
								props.isFocused === true &&
								props.cursor !== undefined &&
								it.flatIdx === props.cursor &&
								!!it.action
							return (
								<box
									height={1}
									flexDirection="row"
									backgroundColor={selected() ? theme.bg : theme.transparent}
								>
									<Show
										when={it.label}
										fallback={
											<text fg={it.valueColor ?? theme.textDim} wrapMode="none">
												{"  "}
												{it.value}
											</text>
										}
									>
										<box width={LabelWidth} flexShrink={0}>
											<text fg={theme.textMuted}>
												<b>{it.label}</b>
											</text>
										</box>
										<text fg={it.valueColor ?? theme.text} wrapMode="none">
											{it.value}
										</text>
									</Show>
								</box>
							)
						}}
					</Index>
				</Show>
			</box>
		</scrollbox>
	)
}

export function DetailPanel() {
	const route = useRoute()
	const list = useList()

	const isFocused = () => route.focusPanel === Panel.Detail

	return (
		<DetailSection
			detail={list.currentDetail()}
			cursor={list.detailCursor()}
			isFocused={isFocused()}
		/>
	)
}

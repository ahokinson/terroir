import type { RGBA } from "@opentui/core"
import { useTheme } from "@tui/contexts/theme"
import { Icon } from "@tui/icons"
import { ColumnPadding, createScrollboxOptions, GlyphWidth } from "@tui/layout"
import { createScrollSync, type ScrollRef } from "@tui/lib/signals"
import { createMemo, createSignal, For, Show } from "solid-js"

export interface SuffixSegment {
	text: string
	color?: RGBA
}

export interface ListItem {
	label: string
	suffix?: SuffixSegment[]
	dim?: boolean
	glyph?: string
	glyphColor?: RGBA
	header?: boolean
}

export interface ColumnHeader {
	label: string
	width?: number
}

interface ScrollableListProps {
	items: ListItem[]
	cursor: number
	emptyText?: string
	headers?: ColumnHeader[]
	highlightQuery?: string
}

interface LabelSegment {
	text: string
	match: boolean
}

function splitLabel(label: string, query: string): LabelSegment[] {
	if (!query) return [{ text: label, match: false }]
	const q = query.toLowerCase()
	const result: LabelSegment[] = []
	let remaining = label
	while (remaining.length > 0) {
		const idx = remaining.toLowerCase().indexOf(q)
		if (idx === -1) {
			result.push({ text: remaining, match: false })
			break
		}
		if (idx > 0) result.push({ text: remaining.slice(0, idx), match: false })
		result.push({ text: remaining.slice(idx, idx + q.length), match: true })
		remaining = remaining.slice(idx + q.length)
	}
	return result
}

export function ScrollableList(props: ScrollableListProps) {
	const theme = useTheme()
	const [scrollRef, setScrollRef] = createSignal<ScrollRef | null>(null)

	createScrollSync(() => props.cursor, scrollRef)

	const columnWidths = createMemo(() => {
		const widths: number[] = []
		for (const item of props.items) {
			if (!item.suffix) continue
			for (let j = 0; j < item.suffix.length; j++) {
				const len = item.suffix[j].text.length
				if (j >= widths.length) widths.push(len)
				else if (len > widths[j]) widths[j] = len
			}
		}
		return widths
	})

	const scrollboxOptions = createScrollboxOptions(theme)

	return (
		<box flexDirection="column" flexGrow={1}>
			<Show when={props.headers}>
				<box
					height={1}
					paddingLeft={ColumnPadding}
					paddingRight={1}
					flexDirection="row"
					backgroundColor={theme.bgElement}
				>
					<box flexGrow={1} flexShrink={1}>
						<text fg={theme.textMuted} wrapMode="none">
							{props.headers![0]?.label ?? ""}
						</text>
					</box>
					<Show when={props.items.length > 0}>
						<For each={columnWidths()}>
							{(colWidth, ci) => {
								const header = props.headers![ci() + 1]
								return (
									<box width={colWidth + ColumnPadding} flexShrink={0}>
										<text fg={theme.textMuted} wrapMode="none">
											{"  "}
											{header?.label ?? ""}
										</text>
									</box>
								)
							}}
						</For>
					</Show>
				</box>
			</Show>
			<Show
				when={props.items.length > 0}
				fallback={
					<box paddingLeft={ColumnPadding} paddingTop={1}>
						<text fg={theme.textDim}>{props.emptyText ?? "No items"}</text>
					</box>
				}
			>
				<scrollbox flexGrow={1} ref={setScrollRef} {...scrollboxOptions}>
					<box flexDirection="column" flexShrink={0}>
						<For each={props.items}>
							{(item, i) => {
								const isHeader = () => item.header === true
								const selected = () => !isHeader() && i() === props.cursor
								const cols = columnWidths()
								const labelFg = () =>
									isHeader()
										? theme.textMuted
										: selected()
											? theme.selectionText
											: item.dim
												? theme.textDim
												: theme.text
								const segments = () => splitLabel(item.label, props.highlightQuery ?? "")
								return (
									<box
										height={1}
										paddingRight={1}
										flexDirection="row"
										backgroundColor={selected() ? theme.selection : theme.transparent}
									>
										<box width={GlyphWidth} flexShrink={0}>
											<text
												fg={selected() ? theme.accent : (item.glyphColor ?? theme.textDim)}
												wrapMode="none"
												attributes={selected() ? 1 : 0}
											>
												{isHeader()
													? "   "
													: selected()
														? ` ${Icon.cursor.char} `
														: item.glyph
															? ` ${item.glyph} `
															: "   "}
											</text>
										</box>
										<text
											wrapMode="none"
											flexGrow={1}
											flexShrink={1}
											attributes={selected() ? 1 : 0}
										>
											<For each={segments()}>
												{(seg) =>
													seg.match ? (
														<span fg={theme.accent} attributes={1}>
															{seg.text}
														</span>
													) : (
														<span fg={labelFg()}>{seg.text}</span>
													)
												}
											</For>
										</text>
										<For each={cols}>
											{(colWidth, ci) => {
												const seg = isHeader() ? undefined : item.suffix?.[ci()]
												return (
													<box width={colWidth + ColumnPadding} flexShrink={0}>
														<text
															fg={selected() ? theme.selectionText : (seg?.color ?? theme.textDim)}
															wrapMode="none"
														>
															{"  "}
															{seg?.text ?? ""}
														</text>
													</box>
												)
											}}
										</For>
									</box>
								)
							}}
						</For>
					</box>
				</scrollbox>
			</Show>
		</box>
	)
}

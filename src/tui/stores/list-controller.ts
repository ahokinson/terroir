import { createClampedSetter, createScrollSync, type ScrollRef } from "@tui/lib/signals"
import { type Accessor, createMemo, createSignal } from "solid-js"

export type { ScrollRef } from "@tui/lib/signals"

export interface ListController<T> {
	cursor: Accessor<number>
	setCursor: (v: number | ((prev: number) => number)) => void
	filter: Accessor<string>
	setFilter: (v: string) => void
	items: Accessor<T[]>
	visible: Accessor<T[]>
	selected: Accessor<T | undefined>
	scrollRef: Accessor<ScrollRef | null>
	setScrollRef: (r: ScrollRef | null) => void
}

export interface ListControllerOptions<T> {
	source: Accessor<T[]>
	cursor?: Accessor<number>
	setCursor?: (v: number | ((prev: number) => number)) => void
	filter?: Accessor<string>
	setFilter?: (v: string) => void
	matches?: (item: T, query: string) => boolean
}

function defaultMatches<T>(item: T, query: string): boolean {
	const label = (item as { label?: unknown }).label
	if (typeof label !== "string") return false
	return label.toLowerCase().includes(query)
}

export function createListController<T>(options: ListControllerOptions<T>): ListController<T> {
	const [localCursor, setLocalCursor] = createSignal(0)
	const [localFilter, setLocalFilter] = createSignal("")
	const [scrollRef, setScrollRef] = createSignal<ScrollRef | null>(null)

	const cursor = options.cursor ?? localCursor
	const setCursorRaw = options.setCursor ?? setLocalCursor
	const filter = options.filter ?? localFilter
	const setFilter = options.setFilter ?? setLocalFilter
	const match = options.matches ?? defaultMatches

	const items = createMemo(() => {
		const query = filter().toLowerCase()
		const source = options.source()
		if (!query) return source
		return source.filter((item) => match(item, query))
	})

	const visible = items

	const setCursor = createClampedSetter(setCursorRaw, () => visible().length - 1)

	createScrollSync(cursor, scrollRef)

	const selected = createMemo(() => visible()[cursor()])

	return {
		cursor,
		setCursor,
		filter,
		setFilter,
		items,
		visible,
		selected,
		scrollRef,
		setScrollRef,
	}
}

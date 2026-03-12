import { createEffect } from "solid-js"

export interface ScrollRef {
	scrollTo(position: number | { x: number; y: number }): void
	readonly viewport?: { height: number }
}

const DefaultContextRows = 1

export function createScrollSync(
	index: () => number,
	scrollRef: () => ScrollRef | null,
	viewportHeight?: () => number,
	contextRows: number = DefaultContextRows,
): void {
	let scrollTop = 0

	createEffect(() => {
		const position = index()
		const ref = scrollRef()
		if (!ref || typeof ref.scrollTo !== "function") return
		const height = viewportHeight ? viewportHeight() : (ref.viewport?.height ?? 0)
		if (height <= 0) return

		const topEdge = scrollTop + contextRows
		const bottomEdge = scrollTop + height - 1 - contextRows

		if (position < topEdge) {
			scrollTop = Math.max(0, position - contextRows)
		} else if (position > bottomEdge) {
			scrollTop = position - height + 1 + contextRows
		}

		ref.scrollTo({ x: 0, y: scrollTop })
	})
}

export function createClampedSetter(
	setRaw: (v: number | ((prev: number) => number)) => void,
	maxIndex: () => number,
): (v: number | ((prev: number) => number)) => void {
	return (v) => {
		if (typeof v === "function") {
			setRaw((prev) => {
				const next = v(prev)
				const max = Math.max(0, maxIndex())
				return Math.max(0, Math.min(next, max))
			})
		} else {
			const max = Math.max(0, maxIndex())
			setRaw(Math.max(0, Math.min(v, max)))
		}
	}
}

export function createCycler<T>(
	values: readonly T[],
	signal: () => T,
	setter: (value: T) => void,
): () => void {
	return () => {
		const index = values.indexOf(signal())
		setter(values[(index + 1) % values.length]!)
	}
}

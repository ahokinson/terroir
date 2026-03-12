import { useTerminalDimensions } from "@opentui/solid"
import { useAppStore } from "@tui/contexts/store"
import { createMemo } from "solid-js"

export enum LayoutMode {
	Narrow = "narrow",
	Standard = "standard",
	Wide = "wide",
}

const NarrowBreakpoint = 80
const StandardBreakpoint = 120

export interface LayoutState {
	readonly mode: LayoutMode
	readonly width: number
	readonly height: number
}

export function createLayoutState(): LayoutState {
	const dimensions = useTerminalDimensions()

	const mode = createMemo<LayoutMode>(() => {
		const w = dimensions().width
		if (w < NarrowBreakpoint) return LayoutMode.Narrow
		if (w < StandardBreakpoint) return LayoutMode.Standard
		return LayoutMode.Wide
	})

	return {
		get mode() {
			return mode()
		},
		get width() {
			return dimensions().width
		},
		get height() {
			return dimensions().height
		},
	}
}

export function useLayout() {
	return useAppStore().layout
}

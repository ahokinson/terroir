import { useAppStore } from "@tui/contexts/store"
import { Icon } from "@tui/icons"
import { StatusDismissMs, TrailLength } from "@tui/layout"
import { createSignal, onCleanup } from "solid-js"

export interface BusyHandle {
	active: () => boolean
	reason: () => string | null
	showReason: (message: string) => void
	clear: () => void
}

export interface StatusState {
	busy: BusyHandle
	readonly text: string | null
	readonly trail: string
	show: (msg: string, durationMs?: number) => void
	clear: () => void
}

export function createStatusState(): StatusState {
	const [text, setText] = createSignal<string | null>(null)
	const [trail, setTrail] = createSignal("")
	const [busyReason, setBusyReason] = createSignal<string | null>(null)
	let dismissTimer: ReturnType<typeof setTimeout> | undefined
	let trailTimers: ReturnType<typeof setTimeout>[] = []

	function clearTimers() {
		if (dismissTimer !== undefined) {
			clearTimeout(dismissTimer)
			dismissTimer = undefined
		}
		for (const t of trailTimers) clearTimeout(t)
		trailTimers = []
	}

	onCleanup(clearTimers)

	function message(msg: string, durationMs = StatusDismissMs) {
		clearTimers()
		setBusyReason(null)
		setText(msg)
		setTrail(" " + Icon.trail.char.repeat(TrailLength))

		const step = durationMs / TrailLength
		for (let i = 1; i <= TrailLength; i++) {
			trailTimers.push(
				setTimeout(() => {
					setTrail(" " + Icon.trail.char.repeat(TrailLength - i))
				}, step * i),
			)
		}

		dismissTimer = setTimeout(() => {
			setText(null)
			setTrail("")
			dismissTimer = undefined
		}, durationMs)
	}

	function clear() {
		clearTimers()
		setText(null)
		setTrail("")
		setBusyReason(null)
	}

	function show(msg: string, durationMs: number = StatusDismissMs) {
		message(msg, durationMs)
	}

	const busy: BusyHandle = {
		active: () => busyReason() !== null,
		reason: () => busyReason(),
		showReason: (msg: string) => {
			clearTimers()
			setText(null)
			setTrail("")
			setBusyReason(msg)
		},
		clear: () => setBusyReason(null),
	}

	return {
		busy,
		get text() {
			return text()
		},
		get trail() {
			return trail()
		},
		show,
		clear,
	}
}

export function useStatus() {
	return useAppStore().status
}

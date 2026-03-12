import { useAppStore } from "@tui/contexts/store"
import { createSignal, type JSX } from "solid-js"

export interface KeyHint {
	key: string
	desc: string
}

interface DialogEntry {
	id: string
	render: () => JSX.Element
	onClose?: () => void
}

export interface ConfirmAction {
	title: string
	message: string
	destructive?: boolean
	onConfirm: () => void
}

export interface DialogState {
	readonly active: boolean
	readonly top: DialogEntry | null
	readonly all: DialogEntry[]
	readonly hints: KeyHint[]
	readonly rightText: string | null
	readonly confirmAction: ConfirmAction | null
	push: (render: () => JSX.Element, onClose?: () => void) => string
	replace: (render: () => JSX.Element, onClose?: () => void) => string
	pop: () => void
	clear: () => void
	setHints: (hints: KeyHint[]) => void
	setRightText: (text: string | null) => void
	requestConfirm: (action: ConfirmAction) => void
	cancelConfirm: () => void
	executeConfirm: () => void
}

let nextId = 0

export function createDialogState(): DialogState {
	const [stack, setStack] = createSignal<DialogEntry[]>([])
	const [hints, setHints] = createSignal<KeyHint[]>([])
	const [rightText, setRightText] = createSignal<string | null>(null)
	const [confirmAction, setConfirmAction] = createSignal<ConfirmAction | null>(null)

	function requestConfirm(action: ConfirmAction) {
		setConfirmAction(action)
	}

	function cancelConfirm() {
		setConfirmAction(null)
	}

	function executeConfirm() {
		const action = confirmAction()
		if (!action) return
		setConfirmAction(null)
		action.onConfirm()
	}

	function push(render: () => JSX.Element, onClose?: () => void) {
		const id = String(++nextId)
		setStack((s) => [...s, { id, render, onClose }])
		return id
	}

	function replace(render: () => JSX.Element, onClose?: () => void) {
		const id = String(++nextId)
		setStack([{ id, render, onClose }])
		return id
	}

	function pop() {
		setStack((s) => {
			if (s.length === 0) return s
			const top = s[s.length - 1]
			top.onClose?.()
			return s.slice(0, -1)
		})
		setHints([])
		setRightText(null)
	}

	function clear() {
		setStack((s) => {
			for (const entry of s) entry.onClose?.()
			return []
		})
		setHints([])
		setRightText(null)
	}

	return {
		get active() {
			return stack().length > 0
		},
		get top() {
			const s = stack()
			return s.length > 0 ? s[s.length - 1] : null
		},
		get all() {
			return stack()
		},
		get hints() {
			return hints()
		},
		get rightText() {
			return rightText()
		},
		get confirmAction() {
			return confirmAction()
		},
		push,
		replace,
		pop,
		clear,
		setHints,
		setRightText,
		requestConfirm,
		cancelConfirm,
		executeConfirm,
	}
}

export function useDialog() {
	return useAppStore().dialog
}

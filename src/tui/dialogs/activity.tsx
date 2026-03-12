import type { MonitorEvent } from "@monitor/types"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/contexts/theme"
import { DialogFrame, DialogSize } from "@tui/dialogs/frame"
import { EventIcon } from "@tui/icons"
import { createClampedSetter } from "@tui/lib/signals"
import { relativeTimeFromMs } from "@tui/lib/time"
import { useDialog } from "@tui/stores/dialog"
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"

interface DialogActivityProps {
	events: MonitorEvent[]
	onClose: () => void
}

export function DialogActivity(props: DialogActivityProps) {
	const theme = useTheme()
	const dialog = useDialog()
	const [cursor, setCursorRaw] = createSignal(0)
	const setCursor = createClampedSetter(setCursorRaw, () => props.events.length - 1)

	createEffect(() => {
		dialog.setHints([{ key: "Esc", desc: "close" }])
	})
	onCleanup(() => dialog.setHints([]))

	useKeyboard((key) => {
		switch (key.name) {
			case "escape":
			case "q":
			case "a":
				props.onClose()
				return
			case "j":
			case "down":
				setCursor((c) => c + 1)
				return
			case "k":
			case "up":
				setCursor((c) => c - 1)
				return
		}
	})

	return (
		<DialogFrame size={DialogSize.Large} title="Activity">
			<Show
				when={props.events.length > 0}
				fallback={<text fg={theme.textMuted}>No activity yet</text>}
			>
				<For each={props.events}>
					{(ev, i) => {
						const icon = EventIcon[ev.type] ?? "?"
						const time = relativeTimeFromMs(ev.timestamp)
						const selected = () => i() === cursor()
						return (
							<box height={1}>
								<Show when={selected()}>
									<text fg={theme.accent}>{"> "}</text>
								</Show>
								<Show when={!selected()}>
									<text>{"  "}</text>
								</Show>
								<box width={3}>
									<text fg={theme.tertiary}>{icon}</text>
								</box>
								<text fg={ev.read ? theme.textDim : theme.text}>{ev.summary}</text>
								<box flexGrow={1} />
								<text fg={theme.textDim}>{time}</text>
							</box>
						)
					}}
				</For>
			</Show>
			<box flexGrow={1} />
		</DialogFrame>
	)
}

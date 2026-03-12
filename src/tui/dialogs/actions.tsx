import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/contexts/theme"
import { DialogFrame, DialogSize } from "@tui/dialogs/frame"
import { Key } from "@tui/lib/keys"
import { createClampedSetter } from "@tui/lib/signals"
import { createSignal, For } from "solid-js"

export interface ActionItem {
	label: string
	icon?: string
	onSelect: () => void
}

interface DialogActionsProps {
	title: string
	actions: ActionItem[]
	onCancel: () => void
}

export function DialogActions(props: DialogActionsProps) {
	const theme = useTheme()
	const [cursor, setCursorRaw] = createSignal(0)
	const setCursor = createClampedSetter(setCursorRaw, () => props.actions.length - 1)

	useKeyboard((key) => {
		switch (key.name) {
			case "j":
			case Key.Down:
				setCursor((c) => c + 1)
				return
			case "k":
			case Key.Up:
				setCursor((c) => c - 1)
				return
			case Key.Return:
				props.actions[cursor()]?.onSelect()
				return
			case Key.Escape:
			case "q":
				props.onCancel()
				return
		}
	})

	return (
		<DialogFrame size={DialogSize.Small} title={` ${props.title} `}>
			<box flexDirection="column" paddingTop={1} paddingBottom={1}>
				<For each={props.actions}>
					{(action, i) => {
						const selected = () => i() === cursor()
						return (
							<box
								height={1}
								flexDirection="row"
								paddingLeft={1}
								paddingRight={1}
								backgroundColor={selected() ? theme.bg : theme.transparent}
							>
								<text fg={selected() ? theme.accent : theme.text}>
									{action.icon ? `${action.icon} ` : "  "}
									{action.label}
								</text>
							</box>
						)
					}}
				</For>
			</box>
		</DialogFrame>
	)
}

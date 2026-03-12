import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/contexts/theme"
import { DialogFrame, DialogSize } from "@tui/dialogs/frame"
import { KeyLabelWidth } from "@tui/layout"
import { helpBindings } from "@tui/lib/keys"
import { useDialog } from "@tui/stores/dialog"
import { createEffect, For, onCleanup } from "solid-js"

interface DialogHelpProps {
	onClose: () => void
}

const bindings = helpBindings()

export function DialogHelp(props: DialogHelpProps) {
	const theme = useTheme()
	const dialog = useDialog()

	createEffect(() => {
		dialog.setHints([{ key: "Esc", desc: "close" }])
	})
	onCleanup(() => dialog.setHints([]))

	useKeyboard((key) => {
		if (key.name === "escape" || key.name === "?" || key.name === "q") {
			props.onClose()
			return
		}
	})

	return (
		<DialogFrame size={DialogSize.Large} left="25%" width="50%">
			<text fg={theme.accent}>
				<b>Keybindings</b>
			</text>
			<box height={1} />
			<For each={bindings}>
				{(b) => (
					<box height={1} flexDirection="row">
						<box width={KeyLabelWidth}>
							<text>
								<span fg={theme.text} bg={theme.bgElevated} attributes={1}>{` ${b.key} `}</span>
							</text>
						</box>
						<text fg={theme.textMuted}>{b.desc}</text>
					</box>
				)}
			</For>
		</DialogFrame>
	)
}

import { useTheme } from "@tui/contexts/theme"
import { DialogFrame, DialogSize } from "@tui/dialogs/frame"
import type { ConfirmAction } from "@tui/stores/dialog"
import { useDialog } from "@tui/stores/dialog"
import { Show } from "solid-js"

export function ConfirmOverlay() {
	const dialog = useDialog()
	const theme = useTheme()

	return (
		<Show when={dialog.confirmAction}>
			{(action: () => ConfirmAction) => (
				<DialogFrame
					size={DialogSize.Small}
					height={5}
					borderColor={action().destructive ? theme.danger : theme.accent}
				>
					<text fg={theme.text} attributes={1}>
						{action().title}
					</text>
					<box height={1} />
					<text fg={theme.textMuted}>{action().message}</text>
				</DialogFrame>
			)}
		</Show>
	)
}

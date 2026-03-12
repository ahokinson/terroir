import { useTheme } from "@tui/contexts/theme"
import { DialogFrame, DialogSize } from "@tui/dialogs/frame"
import { useDismissKeyboard } from "@tui/lib/keyboard"

interface DialogCleanupProps {
	ticketKey: string
	ticketStatus: string
	branchCount: number
	onConfirm: () => void
	onCancel: () => void
}

export function DialogCleanup(props: DialogCleanupProps) {
	const theme = useTheme()

	useDismissKeyboard(props.onConfirm, props.onCancel)

	return (
		<DialogFrame size={DialogSize.Small} height={8} title={` Cleanup ${props.ticketKey} `}>
			<box height={1} />
			<text fg={theme.text}>
				Ticket is <b>{props.ticketStatus}</b>. Clean up {props.branchCount} branches?
			</text>
			<text fg={theme.textDim}>Kill sessions, delete local + remote branches,</text>
			<text fg={theme.textDim}>switch to default branch, remove story.</text>
			<box height={1} />
			<text fg={theme.textMuted}>Enter clean up Esc dismiss</text>
		</DialogFrame>
	)
}

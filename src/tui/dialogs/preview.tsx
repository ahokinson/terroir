import { useTheme } from "@tui/contexts/theme"
import { DialogFrame, DialogSize } from "@tui/dialogs/frame"
import { createScrollboxOptions } from "@tui/layout"
import { useDismissKeyboard } from "@tui/lib/keyboard"

interface DialogPreviewProps {
	title: string
	content: string
	onAccept: () => void
	onReject: () => void
	extraKey?: {
		name: string
		label: string
		action: () => void
	}
}

export function DialogPreview(props: DialogPreviewProps) {
	const theme = useTheme()
	const scrollboxOptions = createScrollboxOptions(theme)

	const extras: Record<string, () => void> = {
		y: () => props.onAccept(),
		n: () => props.onReject(),
	}
	if (props.extraKey) {
		extras[props.extraKey.name] = () => props.extraKey!.action()
	}

	useDismissKeyboard(props.onAccept, props.onReject, extras)

	return (
		<DialogFrame size={DialogSize.Large}>
			<text fg={theme.accent}>
				<b>{props.title}</b>
			</text>
			<box height={1} />
			<scrollbox flexGrow={1} {...scrollboxOptions}>
				<text fg={theme.text}>{props.content}</text>
			</scrollbox>
			<box height={1} />
			<box flexDirection="row" gap={2} height={1}>
				<text fg={theme.success}>y/Enter</text>
				<text fg={theme.textMuted}>accept</text>
				<text fg={theme.danger}>n/Esc</text>
				<text fg={theme.textMuted}>reject</text>
				{props.extraKey ? (
					<>
						<text fg={theme.accent}>{props.extraKey.name}</text>
						<text fg={theme.textMuted}>{props.extraKey.label}</text>
					</>
				) : null}
			</box>
		</DialogFrame>
	)
}

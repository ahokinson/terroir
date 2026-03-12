import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/contexts/theme"
import { DialogFrame } from "@tui/dialogs/frame"

interface DialogWelcomeProps {
	onClose: () => void
	onConnectors: () => void
}

export function DialogWelcome(props: DialogWelcomeProps) {
	const theme = useTheme()

	useKeyboard((key) => {
		if (key.name === "return" || key.name === "c") {
			props.onConnectors()
			return
		}
		if (key.name === "escape" || key.name === "q") {
			props.onClose()
			return
		}
	})

	return (
		<DialogFrame
			top="20%"
			left="20%"
			width="60%"
			height="60%"
			paddingLeft={3}
			paddingRight={3}
			paddingTop={2}
		>
			<text fg={theme.accent}>
				<b>Welcome to Terroir</b>
			</text>
			<box height={2} />
			<text fg={theme.text}>
				Terroir organizes your work as Epics, Stories, Repos, and Branches.
			</text>
			<box height={1} />
			<text fg={theme.text}>Each branch gets a terminal session with your configured tools.</text>
			<box height={2} />
			<text fg={theme.textMuted}>Getting started:</text>
			<box height={1} />
			<text fg={theme.text}> 1. Press c to configure connectors (Jira, GitHub, GitLab)</text>
			<text fg={theme.text}>
				{" "}
				2. Terroir auto-attaches discovered work to your stories; new items appear as suggestions
			</text>
			<text fg={theme.text}> 3. Press n to create new epics and stories</text>
			<text fg={theme.text}> 4. Press ? for keybinding help</text>
			<box flexGrow={1} />
			<box height={1} flexDirection="row" gap={2}>
				<text fg={theme.accent}>c</text>
				<text fg={theme.textMuted}>connectors</text>
				<text fg={theme.accent}>Esc</text>
				<text fg={theme.textMuted}>close</text>
			</box>
		</DialogFrame>
	)
}

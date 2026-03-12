import { isInstalled } from "@lib/cli"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/contexts/theme"
import { DialogFrame, DialogSize } from "@tui/dialogs/frame"
import { Icon } from "@tui/icons"
import { createClampedSetter } from "@tui/lib/signals"
import { useDialog } from "@tui/stores/dialog"
import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js"

interface Connector {
	id: string
	name: string
	category: string
	cli: string
	installed: boolean
}

interface DialogConnectorsProps {
	onClose: () => void
}

async function detectConnectors(): Promise<Connector[]> {
	const [gh, glab, acli, aikido, orca, sumo] = await Promise.all([
		isInstalled("gh"),
		isInstalled("glab"),
		isInstalled("acli"),
		isInstalled("aikido-api-client"),
		isInstalled("orca-cli"),
		isInstalled("sumocli"),
	])
	return [
		{ id: "github", name: "GitHub", category: "Git", cli: "gh", installed: gh },
		{ id: "gitlab", name: "GitLab", category: "Git", cli: "glab", installed: glab },
		{ id: "jira", name: "Jira", category: "Tickets", cli: "acli", installed: acli },
		{
			id: "aikido",
			name: "Aikido",
			category: "Security",
			cli: "aikido-api-client",
			installed: aikido,
		},
		{ id: "orca", name: "Orca", category: "Security", cli: "orca-cli", installed: orca },
		{ id: "sumo", name: "Sumo Logic", category: "Security", cli: "sumocli", installed: sumo },
	]
}

export function DialogConnectors(props: DialogConnectorsProps) {
	const theme = useTheme()
	const dialog = useDialog()
	const [cursor, setCursorRaw] = createSignal(0)
	const [connectors, setConnectors] = createSignal<Connector[]>([])
	const setCursor = createClampedSetter(setCursorRaw, () => connectors().length - 1)

	createEffect(() => {
		dialog.setHints([{ key: "Esc", desc: "close" }])
	})
	onCleanup(() => dialog.setHints([]))

	onMount(() => {
		detectConnectors().then(setConnectors)
	})

	useKeyboard((key) => {
		switch (key.name) {
			case "j":
			case "down":
				setCursor((c) => c + 1)
				return
			case "k":
			case "up":
				setCursor((c) => c - 1)
				return
			case "escape":
			case "q":
				props.onClose()
				return
		}
	})

	return (
		<DialogFrame size={DialogSize.Large} left="15%" width="70%">
			<text fg={theme.accent}>
				<b>Connectors</b>
			</text>
			<box height={1} />
			<text fg={theme.textDim}>CLI tools detected on PATH</text>
			<box height={1} />
			<For each={connectors()}>
				{(conn, i) => (
					<box
						flexDirection="column"
						paddingBottom={1}
						backgroundColor={i() === cursor() ? theme.bgElement : theme.transparent}
					>
						<box height={1} flexDirection="row" gap={2} paddingLeft={1}>
							<text fg={conn.installed ? theme.success : theme.textDim}>
								{conn.installed ? Icon.circleFilled.char : Icon.circleEmpty.char}
							</text>
							<text fg={theme.text}>
								<b>{conn.name}</b>
							</text>
							<text fg={theme.textDim}>{conn.category}</text>
						</box>
						<box height={1} paddingLeft={5} flexDirection="row" gap={1}>
							<text fg={conn.installed ? theme.success : theme.danger}>
								{conn.installed ? Icon.check.char : Icon.cross.char}
							</text>
							<text fg={theme.textMuted}>{conn.cli}</text>
						</box>
					</box>
				)}
			</For>
		</DialogFrame>
	)
}

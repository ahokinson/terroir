import { useSpinnerFrame } from "@tui/components/spinner"
import { useTheme } from "@tui/contexts/theme"
import { Icon } from "@tui/icons"
import { Section } from "@tui/lib/keys"
import { useCache } from "@tui/stores/cache"
import { useMonitor } from "@tui/stores/monitor"
import { useRoute, View } from "@tui/stores/route"
import { useStatus } from "@tui/stores/status"
import { createMemo, For, Show } from "solid-js"

export interface StatusHint {
	key: string
	desc: string
}

export interface StatusBarOverride {
	hints?: StatusHint[]
	rightText?: string | null
}

interface StatusBarProps {
	override?: StatusBarOverride
}

export function StatusBar(props: StatusBarProps) {
	const route = useRoute()
	const theme = useTheme()
	const status = useStatus()
	const cache = useCache()
	const monitor = useMonitor()
	const spinnerFrame = useSpinnerFrame()

	const isBusy = createMemo(() => cache.fetching || monitor.polling || status.busy.active())

	const viewKeys = createMemo<StatusHint[]>(() => {
		const view = route.view
		const fs = route.focusSection

		if (view === View.Dashboard) {
			if (fs === Section.Context) {
				return [
					{ key: "Enter", desc: "create story" },
					{ key: "d", desc: "dismiss" },
					{ key: "Tab", desc: "section" },
					{ key: "?", desc: "help" },
				]
			}
			return [
				{ key: "Enter", desc: "open story" },
				{ key: "Tab", desc: "section" },
				{ key: "?", desc: "help" },
			]
		}

		if (view === View.Branch) {
			return [
				{ key: "Bksp", desc: "back" },
				{ key: "H", desc: "home" },
				{ key: "v", desc: "toggle" },
			]
		}

		if (fs === Section.Context && view === View.Story) {
			return [
				{ key: "n", desc: "new task" },
				{ key: "c", desc: "cycle" },
				{ key: "e", desc: "edit" },
				{ key: "Tab", desc: "section" },
			]
		}

		switch (view) {
			case View.Epic:
				return [
					{ key: "Enter", desc: "drill" },
					{ key: "n", desc: "new" },
					{ key: "S", desc: "suggest" },
					{ key: "H", desc: "home" },
				]
			case View.Story:
				return [
					{ key: "Enter", desc: "drill" },
					{ key: "n", desc: "add" },
					{ key: "f", desc: "fetch" },
					{ key: "H", desc: "home" },
				]
			case View.Repo:
				return [
					{ key: "Enter", desc: "drill" },
					{ key: "n", desc: "add" },
					{ key: "P", desc: "describe" },
					{ key: "H", desc: "home" },
				]
			default:
				return [{ key: "Enter", desc: "drill" }]
		}
	})

	const keys = createMemo(() => {
		const overrideHints = props.override?.hints
		if (overrideHints && overrideHints.length > 0) return overrideHints
		return viewKeys()
	})

	const rightText = createMemo(() => props.override?.rightText ?? null)

	return (
		<box
			height={1}
			paddingLeft={1}
			paddingRight={1}
			flexDirection="row"
			justifyContent="space-between"
			backgroundColor={theme.bgPanel}
		>
			<Show
				when={status.text || isBusy()}
				fallback={
					<text>
						<For each={keys()}>
							{(k, index) => (
								<>
									<span fg={theme.text} bg={theme.bgElevated} attributes={1}>{` ${k.key} `}</span>
									<Show when={k.desc}>
										<span fg={theme.textDim}>{` ${k.desc}`}</span>
									</Show>
									<Show when={index() < keys().length - 1}>
										<span fg={theme.bgOverlay}>{` ${Icon.dot.char} `}</span>
									</Show>
								</>
							)}
						</For>
					</text>
				}
			>
				<text>
					<Show when={status.text}>
						<span fg={theme.accent}>
							{status.text}
							<span fg={theme.textDim}>{status.trail}</span>
						</span>
					</Show>
					<Show when={!status.text && isBusy()}>
						<span fg={theme.active}>
							{`${spinnerFrame()} `}
							{status.busy.reason() ?? ""}
						</span>
					</Show>
				</text>
			</Show>
			<text>
				<Show when={rightText()}>
					<span fg={theme.textMuted}>{rightText()}</span>
				</Show>
				<Show when={!rightText()}>
					<Show when={monitor.unreadCount > 0}>
						<span fg={theme.accent}>{` ${monitor.unreadCount}`}</span>
					</Show>
				</Show>
			</text>
		</box>
	)
}

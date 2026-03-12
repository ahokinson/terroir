import type { LogEntry } from "@integrations/git/client"
import type { ThemeColors } from "@tui/contexts/theme"
import { createScrollboxOptions } from "@tui/layout"
import { relativeTimeShort } from "@tui/lib/time"
import { For, Show } from "solid-js"

interface GitLogProps {
	entries: LogEntry[]
	ticket?: string | null
	theme: ThemeColors
}

export function GitLog(props: GitLogProps) {
	const scrollboxOptions = createScrollboxOptions(props.theme)

	return (
		<Show
			when={props.entries.length > 0}
			fallback={<text fg={props.theme.textDim}>No log entries</text>}
		>
			<scrollbox flexGrow={1} {...scrollboxOptions}>
				<box flexDirection="column" flexShrink={0}>
					<For each={props.entries}>
						{(entry) => {
							const highlight = props.ticket && entry.subject.includes(props.ticket)
							return (
								<box height={1} flexDirection="row" gap={1}>
									<text fg={props.theme.secondary}>{entry.hash.slice(0, 7)}</text>
									<text fg={highlight ? props.theme.accent : props.theme.text} wrapMode="none">
										{highlight ? <b>{entry.subject}</b> : entry.subject}
									</text>
									<text fg={props.theme.textDim}>{relativeTimeShort(entry.authorEpoch)}</text>
								</box>
							)
						}}
					</For>
				</box>
			</scrollbox>
		</Show>
	)
}

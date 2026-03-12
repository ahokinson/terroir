import type { ThemeColors } from "@tui/contexts/theme"
import { createScrollboxOptions } from "@tui/layout"
import type { DriftEntry } from "@tui/stores/drift"
import { For, Show } from "solid-js"

interface DriftListProps {
	entries: DriftEntry[]
	theme: ThemeColors
}

export function DriftList(props: DriftListProps) {
	const scrollboxOptions = createScrollboxOptions(props.theme)

	return (
		<Show when={props.entries.length > 0} fallback={<text fg={props.theme.textDim}>No drift</text>}>
			<scrollbox flexGrow={1} {...scrollboxOptions}>
				<box flexDirection="column" flexShrink={0}>
					<For each={props.entries}>
						{(entry) => (
							<>
								<box height={1}>
									<text fg={props.theme.text} wrapMode="none">
										{entry.name}
									</text>
								</box>
								<For each={entry.tags}>
									{(tag) => (
										<box height={1} paddingLeft={2} flexDirection="row" gap={1}>
											<text fg={tag.color}>{tag.icon}</text>
											<text fg={tag.color}>{tag.detail}</text>
										</box>
									)}
								</For>
							</>
						)}
					</For>
				</box>
			</scrollbox>
		</Show>
	)
}

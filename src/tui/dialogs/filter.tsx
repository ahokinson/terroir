import type { InputRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/contexts/theme"
import { DialogFrame } from "@tui/dialogs/frame"
import { onMount } from "solid-js"

interface DialogFilterProps {
	onFilter: (query: string) => void
	onCancel: () => void
}

export function DialogFilter(props: DialogFilterProps) {
	const theme = useTheme()
	let inputRef: InputRenderable

	useKeyboard((key) => {
		if (key.name === "return") {
			props.onFilter(inputRef?.plainText?.trim() ?? "")
			return
		}
		if (key.name === "escape") {
			props.onCancel()
			return
		}
	})

	onMount(() => {
		setTimeout(() => {
			if (inputRef && !inputRef.isDestroyed) inputRef.focus()
		}, 1)
	})

	return (
		<DialogFrame bottom={1} left={0} width="40%" height={3}>
			<text fg={theme.accent}>/</text>
			<input
				ref={(el: InputRenderable) => {
					inputRef = el
				}}
				fg={theme.text}
				height={1}
				flexGrow={1}
			/>
		</DialogFrame>
	)
}

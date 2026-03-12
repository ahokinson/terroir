import type { InputRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/contexts/theme"
import { DialogFrame, DialogSize } from "@tui/dialogs/frame"
import { onMount } from "solid-js"

interface DialogFormProps {
	title: string
	initial?: string
	onSubmit: (value: string) => void
	onCancel: () => void
}

export function DialogForm(props: DialogFormProps) {
	const theme = useTheme()
	let inputRef: InputRenderable

	useKeyboard((key) => {
		if (key.name === "return") {
			const v = inputRef?.plainText?.trim()
			if (v) props.onSubmit(v)
			return
		}
		if (key.name === "escape") {
			props.onCancel()
			return
		}
	})

	onMount(() => {
		setTimeout(() => {
			if (inputRef && !inputRef.isDestroyed) {
				inputRef.focus()
			}
		}, 1)
	})

	return (
		<DialogFrame size={DialogSize.Small} height={5}>
			<text fg={theme.accent}>{props.title}</text>
			<box height={1} />
			<input
				ref={(el: InputRenderable) => {
					inputRef = el
					if (props.initial) {
						el.plainText = props.initial
					}
				}}
				fg={theme.text}
				height={1}
				width="100%"
			/>
		</DialogFrame>
	)
}

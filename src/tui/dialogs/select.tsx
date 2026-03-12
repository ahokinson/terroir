import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/contexts/theme"
import { DialogFrame, DialogSize } from "@tui/dialogs/frame"
import { Icon } from "@tui/icons"
import { createScrollboxOptions, NestedIndent } from "@tui/layout"
import { Key } from "@tui/lib/keys"
import { createClampedSetter } from "@tui/lib/signals"
import { useDialog } from "@tui/stores/dialog"
import { createEffect, createSignal, For, Index, onCleanup, Show } from "solid-js"

export interface SelectItem {
	label: string
	detail?: string
	tag?: string
	selected: boolean
}

interface DialogSelectProps {
	title: string
	items: SelectItem[]
	onCommit: (items: SelectItem[]) => void
	onCancel: () => void
	extraKeys?: (key: { name: string }, cursor: number, items: SelectItem[]) => boolean
	extraHint?: string
}

export function DialogSelect(props: DialogSelectProps) {
	const theme = useTheme()
	const dialog = useDialog()
	const scrollboxOptions = createScrollboxOptions(theme)
	const [cursor, setCursorRaw] = createSignal(0)
	const [items, setItems] = createSignal([...props.items])
	const setCursor = createClampedSetter(setCursorRaw, () => items().length - 1)

	const selectedCount = () => items().filter((i) => i.selected).length

	createEffect(() => {
		const hints = [
			{ key: "Space", desc: "toggle" },
			{ key: "a", desc: "all" },
			{ key: "Enter", desc: "commit" },
			{ key: "Esc", desc: "cancel" },
		]
		if (props.extraHint) {
			const parts = props.extraHint.split(" ", 2)
			if (parts.length === 2) hints.push({ key: parts[0], desc: parts[1] })
		}
		dialog.setHints(hints)
	})

	createEffect(() => {
		dialog.setRightText(`${selectedCount()}/${items().length} selected`)
	})

	onCleanup(() => {
		dialog.setHints([])
		dialog.setRightText(null)
	})

	useKeyboard((key) => {
		if (props.extraKeys?.(key, cursor(), items())) return
		switch (key.name) {
			case "j":
			case Key.Down:
				setCursor((c) => c + 1)
				return
			case "k":
			case Key.Up:
				setCursor((c) => c - 1)
				return
			case Key.Space:
				setItems((prev) =>
					prev.map((item, i) => (i === cursor() ? { ...item, selected: !item.selected } : item)),
				)
				return
			case "a":
				setItems((prev) => {
					const allSelected = prev.every((i) => i.selected)
					return prev.map((i) => ({ ...i, selected: !allSelected }))
				})
				return
			case Key.Return:
				props.onCommit(items())
				return
			case Key.Escape:
				props.onCancel()
				return
		}
	})

	return (
		<DialogFrame size={DialogSize.Large} title={` ${props.title} `}>
			<scrollbox flexGrow={1} {...scrollboxOptions}>
				<box flexDirection="column" flexShrink={0}>
					<Index each={items()}>
						{(item, i) => {
							const isCursor = () => i === cursor()
							const hasDetail = () => !!item().detail
							return (
								<box flexDirection="column" paddingBottom={hasDetail() ? 1 : 0}>
									<box
										height={1}
										flexDirection="row"
										paddingLeft={1}
										backgroundColor={isCursor() ? theme.bg : theme.transparent}
									>
										<box width={3} flexShrink={0}>
											<text fg={item().selected ? theme.tertiary : theme.textDim}>
												{item().selected ? ` ${Icon.check.char}` : ` ${Icon.circleEmpty.char}`}
											</text>
										</box>
										<box flexGrow={1}>
											<text
												fg={
													isCursor()
														? theme.text
														: item().selected
															? theme.textSecondary
															: theme.textDim
												}
												wrapMode="none"
											>
												{item().label}
											</text>
										</box>
										<Show when={item().tag}>
											<box flexShrink={0} paddingLeft={2} paddingRight={1}>
												<text fg={theme.textDim} wrapMode="none">
													{item().tag}
												</text>
											</box>
										</Show>
									</box>
									<Show when={item().detail}>
										<For each={item().detail!.split("\n")}>
											{(line) => (
												<box height={1} paddingLeft={NestedIndent}>
													<text fg={theme.textDim} wrapMode="none">
														{line}
													</text>
												</box>
											)}
										</For>
									</Show>
								</box>
							)
						}}
					</Index>
				</box>
			</scrollbox>
		</DialogFrame>
	)
}

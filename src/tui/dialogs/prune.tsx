import { DialogSelect, type SelectItem } from "@tui/dialogs/select"
import type { PruneItem } from "@tui/lib/prune"

interface DialogPruneProps {
	items: PruneItem[]
	onCommit: (items: PruneItem[]) => void
	onCancel: () => void
}

export function DialogPrune(props: DialogPruneProps) {
	const selectItems: SelectItem[] = props.items.map((item) => ({
		label: `${item.epicName} / ${item.storyName}`,
		detail: item.reason,
		selected: item.selected,
	}))

	return (
		<DialogSelect
			title={`Prune — ${props.items.length} stale stories`}
			items={selectItems}
			onCommit={(selected) => {
				const result = props.items.map((item, i) => ({
					...item,
					selected: selected[i].selected,
				}))
				props.onCommit(result)
			}}
			onCancel={props.onCancel}
		/>
	)
}

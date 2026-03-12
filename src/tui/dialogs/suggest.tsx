import { DialogSelect, type SelectItem } from "@tui/dialogs/select"

interface DialogSuggestProps {
	tasks: string[]
	onCommit: (tasks: string[]) => void
	onCancel: () => void
}

export function DialogSuggest(props: DialogSuggestProps) {
	const selectItems: SelectItem[] = props.tasks.map((task) => ({
		label: task,
		selected: true,
	}))

	return (
		<DialogSelect
			title={`Suggest — ${props.tasks.length} tasks`}
			items={selectItems}
			onCommit={(selected) => {
				props.onCommit(selected.filter((s) => s.selected).map((s) => s.label))
			}}
			onCancel={props.onCancel}
		/>
	)
}

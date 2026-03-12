import { DialogForm } from "@tui/dialogs/form"
import type { AppStore } from "@tui/stores/store"

export class TaskUI {
	constructor(private readonly app: AppStore) {}

	new() {
		const { store, dialog, status, list, tasks } = this.app
		const [ei, si] = list.storyIndices()
		dialog.push(() => (
			<DialogForm
				title="New Task"
				onSubmit={(title) => {
					tasks.create(ei, si, title)
					store.save()
					status.show(`Added task "${title}"`)
					dialog.pop()
				}}
				onCancel={() => dialog.pop()}
			/>
		))
	}

	edit() {
		const { store, dialog, status, list, tasks } = this.app
		const [ei, si] = list.storyIndices()
		const story = list.currentStory()
		const task = story?.tasks[list.contextCursor()]
		if (!task) return
		dialog.push(() => (
			<DialogForm
				title="Edit Task"
				initial={task.title}
				onSubmit={(title) => {
					tasks.edit(ei, si, list.contextCursor(), title)
					store.save()
					status.show(`Updated task`)
					dialog.pop()
				}}
				onCancel={() => dialog.pop()}
			/>
		))
	}

	cycle() {
		const { store, list, tasks } = this.app
		const [ei, si] = list.storyIndices()
		const story = list.currentStory()
		const task = story?.tasks[list.contextCursor()]
		if (!task) return
		tasks.cycleStatus(ei, si, list.contextCursor(), task.status)
		store.save()
	}

	delete() {
		const { store, status, list, tasks } = this.app
		const [ei, si] = list.storyIndices()
		const story = list.currentStory()
		const task = story?.tasks[list.contextCursor()]
		if (!task) return
		tasks.delete(ei, si, list.contextCursor())
		store.save()
		const len = list.currentStory()?.tasks.length ?? 0
		if (list.contextCursor() >= len && len > 0) list.setContextCursor(len - 1)
		status.show("Task deleted")
	}
}

import type { Task } from "@db/types"
import { Status } from "@db/types"
import type { ThemeColors } from "@tui/contexts/theme"
import { Icon } from "@tui/icons"
import { createScrollboxOptions } from "@tui/layout"
import { createScrollSync, type ScrollRef } from "@tui/lib/signals"
import { createSignal, For, Show } from "solid-js"

interface TaskListProps {
	tasks: Task[]
	selectedIndex: number
	isFocused: boolean
	theme: ThemeColors
	emptyHint?: boolean
}

export function TaskList(props: TaskListProps) {
	const scrollboxOptions = createScrollboxOptions(props.theme)
	const [scrollRef, setScrollRef] = createSignal<ScrollRef | null>(null)

	createScrollSync(() => (props.isFocused ? props.selectedIndex : 0), scrollRef)

	return (
		<Show
			when={props.tasks.length > 0}
			fallback={
				<text fg={props.theme.textDim}>No tasks yet{props.emptyHint ? " — n to add" : ""}</text>
			}
		>
			<scrollbox flexGrow={1} ref={setScrollRef} {...scrollboxOptions}>
				<box flexDirection="column" flexShrink={0}>
					<For each={props.tasks}>
						{(task, i) => {
							const selected = () => props.isFocused && i() === props.selectedIndex
							const statusColor = () => {
								switch (task.status) {
									case Status.Done:
										return props.theme.taskDone
									case Status.InProgress:
										return props.theme.taskActive
									default:
										return props.theme.taskTodo
								}
							}
							const glyph = () => {
								switch (task.status) {
									case Status.Done:
										return Icon.circleFilled.char
									case Status.InProgress:
										return Icon.circleHalf.char
									default:
										return Icon.circleEmpty.char
								}
							}
							return (
								<box
									height={1}
									flexDirection="row"
									gap={1}
									backgroundColor={selected() ? props.theme.bgElement : props.theme.transparent}
								>
									<text fg={statusColor()}>{glyph()}</text>
									<text
										fg={task.status === Status.Done ? props.theme.textDim : props.theme.text}
										wrapMode="none"
									>
										{task.title}
									</text>
								</box>
							)
						}}
					</For>
				</box>
			</scrollbox>
		</Show>
	)
}

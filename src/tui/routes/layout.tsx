import { commit as discoverCommit } from "@monitor/discover"
import { useKeyboard } from "@opentui/solid"
import { Breadcrumb } from "@tui/components/breadcrumb"
import { useConfig } from "@tui/contexts/config"
import { useAppStore } from "@tui/contexts/store"
import { DialogActivity } from "@tui/dialogs/activity"
import { ConfirmOverlay } from "@tui/dialogs/confirm"
import { DialogConnectors } from "@tui/dialogs/connectors"
import { DialogFilter } from "@tui/dialogs/filter"
import { DialogHelp } from "@tui/dialogs/help"
import { createCommandRunner } from "@tui/handlers/commands"
import { createNavigator } from "@tui/handlers/navigation"
import { handleReorder } from "@tui/handlers/reorder"
import { TaskUI } from "@tui/handlers/task-handlers"
import { Action, Direction, resolveAction } from "@tui/lib/keys"
import { StatusBar } from "@tui/routes/panels/status"
import { Router } from "@tui/routes/router"
import { View } from "@tui/stores/route"
import { Show } from "solid-js"

export function Layout() {
	const app = useAppStore()
	const cfg = useConfig()
	const { dialog, route, cache, localRepos, monitor, status, list, suggestions, store } = app
	const nav = createNavigator(app)
	const taskUI = new TaskUI(app)
	const commands = createCommandRunner(app, cfg.config)

	useKeyboard((key) => {
		if (dialog.confirmAction) {
			if (key.name === "return" || key.name === "y") {
				dialog.executeConfirm()
				return
			}
			if (key.name === "escape" || key.name === "n") {
				dialog.cancelConfirm()
				return
			}
			return
		}

		if (dialog.active) return

		const action = resolveAction(key, route.view, route.focusSection)
		if (!action) return

		switch (action) {
			case Action.CycleFocus:
				route.cycleFocus()
				return
			case Action.GoHome:
				route.goHome()
				return

			case Action.Help:
				dialog.push(() => <DialogHelp onClose={() => dialog.pop()} />)
				return
			case Action.Connectors:
				dialog.push(() => <DialogConnectors onClose={() => dialog.pop()} />)
				return
			case Action.ToggleContextMode:
				route.setContextMode(route.contextMode === 0 ? 1 : 0)
				return
			case Action.Filter:
				dialog.push(() => (
					<DialogFilter
						onFilter={(query) => {
							route.setFilterQuery(query)
							route.setCursor(0)
							dialog.pop()
						}}
						onCancel={() => dialog.pop()}
					/>
				))
				return
			case Action.Refresh:
				cache.refreshAll()
				localRepos.refresh()
				status.show("Refreshing...")
				return
			case Action.Fetch:
				if (cache.fetching) {
					status.show("Already fetching...")
					return
				}
				status.show("Fetching remotes...")
				cache.fetchAll().then(() => status.show("Fetch complete"))
				return

			case Action.MoveDown:
				nav.moveDown()
				return
			case Action.MoveUp:
				nav.moveUp()
				return
			case Action.Top:
				nav.jumpTop()
				return
			case Action.Bottom:
				nav.jumpBottom()
				return
			case Action.Enter:
				nav.enter()
				return
			case Action.SuggestionAccept: {
				const items = suggestions.items
				const idx = list.suggestionCursor()
				const target = items[idx]
				if (!target) return
				target.item.selected = true
				const result = discoverCommit(
					[target.item],
					store.epics,
					cfg.config.discover.autoImportEpic,
				)
				if (result.imported > 0) {
					store.setState("epics", result.epics)
					store.save()
				}
				suggestions.dismiss(target.id)
				status.show(`Created story: ${target.item.name}`)
				return
			}
			case Action.SuggestionDismiss: {
				const items = suggestions.items
				const idx = list.suggestionCursor()
				const target = items[idx]
				if (!target) return
				suggestions.dismiss(target.id)
				return
			}
			case Action.Back:
				nav.back()
				return

			case Action.TaskCycle: {
				const taskLen = list.currentStory()?.tasks.length ?? 0
				if (taskLen > 0) taskUI.cycle()
				return
			}
			case Action.TaskNew:
				taskUI.new()
				return
			case Action.TaskEdit: {
				const taskLen = list.currentStory()?.tasks.length ?? 0
				if (taskLen > 0) taskUI.edit()
				return
			}
			case Action.TaskDelete: {
				const taskLen = list.currentStory()?.tasks.length ?? 0
				if (taskLen > 0) taskUI.delete()
				return
			}

			case Action.ReorderDown:
				handleReorder(app, Direction.Down)
				return
			case Action.ReorderUp:
				handleReorder(app, Direction.Up)
				return

			case Action.Suggest:
				commands.suggest()
				return
			case Action.Describe:
				commands.describe()
				return
			case Action.Cleanup:
				commands.cleanup()
				return

			case Action.EventDismiss: {
				if (route.view !== View.Story) return
				const story = list.currentStory()
				if (!story) return
				const target = monitor.events.find((e) => e.storyName === story.name && !e.dismissed)
				if (target) monitor.dismiss(target.id)
				return
			}
			case Action.EventDismissAll: {
				if (route.view !== View.Story) return
				const story = list.currentStory()
				if (!story) return
				monitor.dismissAllForStory(story.name)
				return
			}
			case Action.Activity:
				dialog.push(() => (
					<DialogActivity
						events={monitor.events}
						onClose={() => {
							monitor.markAllRead()
							dialog.pop()
						}}
					/>
				))
				return
			case Action.PollNow:
				status.show("Polling all sources...")
				monitor.pollNow()
				return
		}
	})

	return (
		<box flexDirection="column" width="100%" height="100%">
			<Breadcrumb />

			<box flexGrow={1}>
				<Router />
			</box>

			<StatusBar
				override={dialog.active ? { hints: dialog.hints, rightText: dialog.rightText } : undefined}
			/>

			<Show when={dialog.active}>{dialog.top?.render()}</Show>
			<ConfirmOverlay />
		</box>
	)
}

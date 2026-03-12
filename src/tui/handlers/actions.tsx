import { type ActionTarget, ActionTargetKind } from "@tui/detail/types"
import { type ActionItem, DialogActions } from "@tui/dialogs/actions"
import type { AppStore } from "@tui/stores/store"
import { spawn } from "bun"

function openInBrowser(url: string) {
	spawn(["open", url], { stdout: "ignore", stderr: "ignore" })
}

function actionsForContext(ac: ActionTarget, app: AppStore): ActionItem[] {
	const { dialog, status } = app

	switch (ac.type) {
		case ActionTargetKind.Url:
			return [
				{
					label: "Open in browser",
					icon: "󰖟",
					onSelect: () => {
						openInBrowser(ac.url)
						dialog.pop()
					},
				},
			]

		case ActionTargetKind.Ticket:
			return [
				{
					label: "Open in browser",
					icon: "󰖟",
					onSelect: () => {
						openInBrowser(ac.url)
						dialog.pop()
					},
				},
				{
					label: "Transition status",
					icon: "󰁔",
					onSelect: () => {
						handleTransition(ac.key, app)
					},
				},
			]

		case ActionTargetKind.Pipeline:
			return [
				{
					label: "Open in browser",
					icon: "󰖟",
					onSelect: () => {
						openInBrowser(ac.url)
						dialog.pop()
					},
				},
			]

		case ActionTargetKind.Branch:
			return [
				{
					label: "Checkout branch",
					icon: "󰘬",
					onSelect: async () => {
						dialog.pop()
						status.show(`Checking out ${ac.branchName}...`)
						try {
							const proc = spawn(["git", "-C", ac.repoPath, "checkout", ac.branchName], {
								stdout: "ignore",
								stderr: "pipe",
							})
							const exitCode = await proc.exited
							if (exitCode === 0) {
								status.show(`Checked out ${ac.branchName}`)
								app.cache.refreshAll()
							} else {
								status.show(`Failed to checkout ${ac.branchName}`)
							}
						} catch {
							status.show(`Failed to checkout ${ac.branchName}`)
						}
					},
				},
			]
	}
}

async function handleTransition(ticketKey: string, app: AppStore) {
	const { dialog, status, integrations } = app

	if (!integrations.tickets) {
		status.show("No ticket integration configured")
		dialog.pop()
		return
	}

	status.busy.showReason("Fetching transitions...")
	try {
		const transitions = await integrations.tickets.getTransitions(ticketKey)
		if (transitions.length === 0) {
			status.show("No transitions available")
			dialog.pop()
			return
		}
		status.clear()
		dialog.pop()
		dialog.push(() => (
			<DialogActions
				title={`Transition ${ticketKey}`}
				actions={transitions.map((t) => ({
					label: t.name,
					onSelect: async () => {
						dialog.pop()
						status.busy.showReason(`Transitioning to ${t.name}...`)
						try {
							await integrations.tickets!.transitionIssue(ticketKey, t.id)
							status.show(`${ticketKey} → ${t.name}`)
							integrations.fetchTicket(ticketKey)
						} catch {
							status.show(`Transition failed`)
						}
					},
				}))}
				onCancel={() => dialog.pop()}
			/>
		))
	} catch {
		status.show("Failed to fetch transitions")
		dialog.pop()
	}
}

export function handleActions(app: AppStore, action: ActionTarget | undefined) {
	const { dialog } = app

	if (!action) return

	const actions = actionsForContext(action, app)
	if (actions.length === 0) return

	if (actions.length === 1) {
		actions[0].onSelect()
		return
	}

	dialog.push(() => (
		<DialogActions title="Actions" actions={actions} onCancel={() => dialog.pop()} />
	))
}

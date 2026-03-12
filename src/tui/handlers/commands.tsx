import type { Config } from "@db/config"
import {
	defaultDescribePRPrompt,
	defaultDescribeTicketPrompt,
	defaultSuggestPrompt,
} from "@db/config"
import { isTicketDone } from "@integrations/types"
import { describe as aiDescribe, suggest as aiSuggest, commandFor } from "@lib/ai"
import { errMsg } from "@lib/log"
import { DialogCleanup } from "@tui/dialogs/cleanup"
import { DialogPreview } from "@tui/dialogs/preview"
import { DialogPrune } from "@tui/dialogs/prune"
import { DialogSuggest } from "@tui/dialogs/suggest"
import { collectStale, commitPrune } from "@tui/lib/prune"
import type { AppStore } from "@tui/stores/store"

export interface CommandRunner {
	suggest(): void
	describe(): void
	cleanup(): void
}

export function createCommandRunner(app: AppStore, config: Config): CommandRunner {
	const aiCommand = () => commandFor(config.ai.provider, config.ai.model)

	return {
		suggest() {
			const { store, dialog, status, route, integrations, list, tasks } = app
			if (route.level !== 1) return
			const story = list.currentStory()
			if (!story?.ticket) {
				status.show("No ticket linked to this story")
				return
			}
			const ticketKey = story.ticket
			const ticketInfo = integrations.getTicket(ticketKey)
			status.busy.showReason("Suggesting tasks...")
			aiSuggest(
				aiCommand(),
				defaultSuggestPrompt,
				ticketKey,
				ticketInfo?.summary ?? story.name,
				ticketInfo?.description,
			)
				.then((suggested) => {
					if (suggested.length === 0) {
						status.show("No suggestions returned")
						return
					}
					status.clear()
					dialog.push(() => (
						<DialogSuggest
							tasks={suggested}
							onCommit={(selected) => {
								const [ei, si] = list.storyIndices()
								for (const title of selected) {
									tasks.create(ei, si, title)
								}
								store.save()
								status.show(`Added ${selected.length} tasks`)
								dialog.pop()
							}}
							onCancel={() => dialog.pop()}
						/>
					))
				})
				.catch((err) => status.show(`Suggest failed: ${errMsg(err)}`))
		},

		describe() {
			const { store, dialog, status, route, list } = app
			if (route.level === 3) {
				const c = route.cursors
				const repo = store.epics[c[0]]?.stories[c[1]]?.repositories[c[2]]
				const branch = repo?.branches[list.realIndex()]
				if (!repo || !branch) return
				status.busy.showReason("Generating PR description...")
				import("@integrations/git/client")
					.then(async ({ GitRepo }) => {
						const entries = await new GitRepo(repo.path).logRange(
							branch.baseBranch ?? "main",
							branch.name,
						)
						const diff = entries.map((e) => `${e.hash} ${e.subject}`).join("\n")
						return aiDescribe(aiCommand(), defaultDescribePRPrompt, diff)
					})
					.then((description) => {
						status.clear()
						dialog.push(() => (
							<DialogPreview
								title="PR Description"
								content={description}
								onAccept={() => {
									status.show("PR description generated (copy from preview)")
									dialog.pop()
								}}
								onReject={() => dialog.pop()}
							/>
						))
					})
					.catch((err) => status.show(`Describe failed: ${errMsg(err)}`))
				return
			}
			if (route.level === 1) {
				const story = list.currentStory()
				if (!story?.ticket) {
					status.show("No ticket linked")
					return
				}
				status.busy.showReason("Generating ticket description...")
				const context: string[] = []
				for (const repo of story.repositories) {
					for (const branch of repo.branches) {
						context.push(`Branch: ${branch.name} in ${repo.path}`)
					}
				}
				aiDescribe(aiCommand(), defaultDescribeTicketPrompt, context.join("\n"))
					.then((description) => {
						status.clear()
						dialog.push(() => (
							<DialogPreview
								title="Ticket Description"
								content={description}
								onAccept={() => {
									status.show("Ticket description generated (copy from preview)")
									dialog.pop()
								}}
								onReject={() => dialog.pop()}
							/>
						))
					})
					.catch((err) => status.show(`Describe failed: ${errMsg(err)}`))
				return
			}
			const stale = collectStale(store.epics, config.stalenessDays)
			if (stale.length === 0) {
				status.show("No stale stories")
				return
			}
			dialog.push(() => (
				<DialogPrune
					items={stale}
					onCommit={(items) => {
						const pruned = commitPrune(store.epics, items)
						const removed = items.filter((i) => i.selected).length
						store.setState("epics", pruned)
						store.save()
						status.show(`Pruned ${removed} stories`)
						dialog.pop()
					}}
					onCancel={() => dialog.pop()}
				/>
			))
		},

		cleanup() {
			const { store, dialog, status, route, integrations, list } = app
			if (route.level !== 1) return
			const s = list.currentStory()
			if (!s?.ticket) {
				status.show("No ticket linked")
				return
			}
			const ti = integrations.getTicket(s.ticket)
			if (!ti?.status) {
				status.show("No ticket status available")
				return
			}
			if (!isTicketDone(ti.status)) {
				status.show("Ticket not done yet")
				return
			}
			let hasOpenPR = false
			for (const repo of s.repositories) {
				for (const branch of repo.branches) {
					if (integrations.hasOpenPR(repo.path, branch.name)) {
						hasOpenPR = true
						break
					}
				}
				if (hasOpenPR) break
			}
			if (hasOpenPR) {
				status.show("Story still has open PRs")
				return
			}
			let branchCount = 0
			for (const repo of s.repositories) {
				branchCount += repo.branches.length
			}
			dialog.push(() => (
				<DialogCleanup
					ticketKey={s.ticket!}
					ticketStatus={ti.status}
					branchCount={branchCount}
					onConfirm={() => {
						const c = route.cursors
						const epic = store.epics[c[0]]
						if (epic) {
							const idx = list.realIndex()
							const updated = [...epic.stories]
							updated.splice(idx, 1)
							store.setState("epics", c[0], "stories", updated)
							store.save()
							status.show(`Cleaned up ${s.name}`)
						}
						dialog.pop()
					}}
					onCancel={() => dialog.pop()}
				/>
			))
		},
	}
}

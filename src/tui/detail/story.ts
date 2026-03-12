import type { Story } from "@db/types"
import { Status } from "@db/types"
import { LifecycleStage } from "@domain/lifecycle"
import { repoName } from "@integrations/git/client"
import type { PullRequest } from "@integrations/types"
import type { RGBA } from "@opentui/core"
import { detailSection } from "@tui/detail/builder"
import type {
	ActionTarget,
	Cache,
	DetailData,
	DetailRow,
	IntegrationsCtx,
	Theme,
} from "@tui/detail/types"
import { ActionTargetKind } from "@tui/detail/types"
import { epochFromISO, relativeTimeShort } from "@tui/lib/time"
import { pipelineIndicator } from "@tui/stores/pipeline"

export function storyDetail(
	story: Story,
	cache: Cache,
	integrations: IntegrationsCtx,
	theme: Theme,
): DetailData {
	const ticketInfo = story.ticket ? integrations.getTicket(story.ticket) : null

	const ticketAction: ActionTarget | undefined =
		story.ticket && ticketInfo?.url
			? { type: ActionTargetKind.Ticket, key: story.ticket, url: ticketInfo.url }
			: undefined

	const info = detailSection()
		.row("Type", story.type)
		.rowIf(story.lifecycleStage !== LifecycleStage.Active, "Stage", story.lifecycleStage)
		.rowIf(story.ticket, "Ticket", story.ticket ?? "", { action: ticketAction })
		.rowIf(ticketInfo?.summary, "Summary", ticketInfo?.summary ?? "")
		.rowIf(ticketInfo?.status, "Status", ticketInfo?.status ?? "", { action: ticketAction })
		.rowIf(ticketInfo?.assignee, "Assignee", ticketInfo?.assignee ?? "")
		.row("Created", story.createdAt.split("T")[0])
		.rowIf(story.completedAt, "Completed", story.completedAt?.split("T")[0] ?? "")
		.row("Repositories", String(story.repositories.length))

	const repoRows: DetailRow[] = []
	for (const repo of story.repositories) {
		const name = repoName(repo.path)
		const rs = cache.repos[repo.path]?.status

		let statusStr = ""
		let statusColor: RGBA | undefined
		if (rs) {
			statusStr = rs.dirty ? "dirty" : "clean"
			statusColor = rs.dirty ? theme.gitDirty : theme.gitClean
		}

		let totalAhead = 0
		let totalBehind = 0
		for (const b of repo.branches) {
			const bs = cache.branches[cache.branchKey(repo.path, b.name)]
			if (bs?.aheadBehind) {
				totalAhead += bs.aheadBehind.ahead
				totalBehind += bs.aheadBehind.behind
			}
		}
		const ab = `+${totalAhead}/-${totalBehind}`

		const repoLine = statusStr ? `${name}  ${statusStr}  ${ab}` : name
		repoRows.push({ label: "", value: repoLine, indent: true, valueColor: statusColor })

		interface BranchEntry {
			name: string
			color: RGBA
			prSummary: string
			prTime: number
		}
		const branchEntries: BranchEntry[] = []

		for (const b of repo.branches) {
			let color = theme.textDim
			if (rs && b.name === rs.currentBranch) {
				color = theme.accent
			}
			branchEntries.push({ name: b.name, color, prSummary: "", prTime: 0 })
		}

		for (const be of branchEntries) {
			const prs = integrations.getPRs(repo.path, be.name)
			let latest: PullRequest | null = null
			for (const pr of prs) {
				if (!latest || new Date(pr.updatedAt) > new Date(latest.updatedAt)) {
					latest = pr
				}
			}
			if (latest) {
				be.prTime = epochFromISO(latest.updatedAt)
				const state = latest.draft ? "draft" : latest.state
				const pipeline = integrations.getPipeline(repo.path, be.name)
				let ciStr = ""
				if (pipeline) {
					const pi = pipelineIndicator(pipeline.status, theme)
					ciStr = ` 󰟀 ${pi.icon}`
				}
				const timeStr = relativeTimeShort(epochFromISO(latest.updatedAt))
				be.prSummary = `  → #${latest.id} ${state}${ciStr} ${timeStr}`
			}
		}

		branchEntries.sort((a, b) => b.prTime - a.prTime)

		for (const be of branchEntries) {
			repoRows.push({
				label: "",
				value: `  ${be.name}${be.prSummary}`,
				indent: true,
				valueColor: be.color,
			})
		}
	}

	const taskRows: DetailRow[] = []
	if (story.tasks.length > 0) {
		const done = story.tasks.filter((t) => t.status === Status.Done).length
		taskRows.push({ label: "Tasks", value: `${done}/${story.tasks.length}` })
	}

	return {
		title: story.name,
		sections: [
			{ rows: info.rows },
			...(repoRows.length > 0 ? [{ rows: repoRows }] : []),
			...(taskRows.length > 0 ? [{ rows: taskRows }] : []),
		],
	}
}

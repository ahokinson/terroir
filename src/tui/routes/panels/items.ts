import type { Epic, Repository, Story } from "@db/types"
import { Status, StoryType } from "@db/types"
import { LifecycleStage } from "@domain/lifecycle"
import { repoName } from "@integrations/git/client"
import type { PullRequest, SecurityFinding, Signal } from "@integrations/types"
import { PR_OPEN_STATES } from "@integrations/types"
import type { RGBA } from "@opentui/core"
import type { ListItem, SuffixSegment } from "@tui/components/scrollable-list"
import { Icon } from "@tui/icons"
import type { DriftAccessors } from "@tui/stores/drift"
import { storyIsDrifting } from "@tui/stores/drift"

const DriftDangerThreshold = 3

interface ListTheme {
	danger: RGBA
	warning: RGBA
	textDim: RGBA
	secondary: RGBA
	success: RGBA
	active: RGBA
	gitClean: RGBA
	gitDirty: RGBA
	gitAhead: RGBA
	gitBehind: RGBA
}

interface StoryQuery {
	getTicketSummary: (key: string) => string | null
	isRepoDirty: (path: string) => boolean
	hasOpenPR: (repoPath: string, branchName: string) => boolean
}

interface RepoQuery {
	getRepoStatus: (path: string) => { currentBranch?: string; dirty?: boolean } | null
	getRepoFindings?: (path: string) => SecurityFinding[]
	getRepoSignals?: (path: string) => Signal[]
}

interface BranchQuery {
	getBranchStatus: (
		repoPath: string,
		branchName: string,
	) => {
		session?: boolean
		aheadBehind?: { ahead: number; behind: number }
	} | null
	getPRs: (repoPath: string, branchName: string) => PullRequest[]
}

export function epicListItems(
	epics: Epic[],
	theme: ListTheme,
	driftAccessors: DriftAccessors,
): ListItem[] {
	return epics.map((e) => {
		const suffix: SuffixSegment[] = []
		const storyCount = e.stories.length
		suffix.push({ text: storyCount === 1 ? "1 story" : `${storyCount} stories` })

		let driftCount = 0
		for (const s of e.stories) {
			if (s.completedAt) continue
			if (storyIsDrifting(s, driftAccessors)) driftCount++
		}
		if (driftCount > 0) {
			const color =
				driftCount > storyCount / 2 || driftCount >= DriftDangerThreshold
					? theme.danger
					: theme.warning
			suffix.push({ text: `${driftCount} drifting`, color })
		}

		return {
			label: e.name || "(No Epic)",
			suffix,
			glyph: Icon.square.char,
			glyphColor: theme.secondary,
		}
	})
}

export function storyListItems(
	stories: Story[],
	theme: ListTheme,
	ctx: StoryQuery,
	driftAccessors: DriftAccessors,
): ListItem[] {
	return stories.map((s) => {
		if (s.completedAt) {
			return {
				label: s.name,
				suffix: [{ text: "completed" }],
				dim: true,
				glyph: Icon.circleFilled.char,
				glyphColor: theme.success,
			}
		}

		let name = s.name
		if (s.ticket) {
			const summary = ctx.getTicketSummary(s.ticket)
			if (summary && summary !== s.ticket) {
				name = summary
			}
		}

		const suffix: SuffixSegment[] = []

		if (s.lifecycleStage !== LifecycleStage.Active) {
			const stageColors: Record<LifecycleStage, RGBA | undefined> = {
				[LifecycleStage.Active]: undefined,
				[LifecycleStage.Review]: theme.warning,
				[LifecycleStage.Approved]: theme.success,
				[LifecycleStage.Merged]: theme.secondary,
				[LifecycleStage.Transitioned]: theme.textDim,
				[LifecycleStage.Cleaned]: theme.textDim,
				[LifecycleStage.Archived]: theme.textDim,
			}
			suffix.push({
				text: s.lifecycleStage,
				color: stageColors[s.lifecycleStage] ?? theme.textDim,
			})
		}

		if (s.type === StoryType.Feature) suffix.push({ text: "feat" })
		else if (s.type === StoryType.Bug) suffix.push({ text: "fix" })

		if (s.ticket) suffix.push({ text: s.ticket })

		if (s.repositories.length > 0) {
			suffix.push({ text: `${s.repositories.length} repos` })
		}

		if (s.tasks.length > 0) {
			const done = s.tasks.filter((t) => t.status === Status.Done).length
			suffix.push({ text: `${done}/${s.tasks.length}` })
		}

		let dirtyCount = 0
		for (const repo of s.repositories) {
			if (ctx.isRepoDirty(repo.path)) dirtyCount++
		}
		if (dirtyCount > 0) {
			suffix.push({ text: `${dirtyCount} dirty`, color: theme.gitDirty })
		}

		let openPRs = 0
		for (const repo of s.repositories) {
			for (const branch of repo.branches) {
				if (ctx.hasOpenPR(repo.path, branch.name)) openPRs++
			}
		}
		if (openPRs > 0) {
			suffix.push({
				text: openPRs === 1 ? "1 open PR" : `${openPRs} open PRs`,
				color: theme.warning,
			})
		}

		if (storyIsDrifting(s, driftAccessors)) {
			suffix.push({ text: "drift" })
		}

		let glyph = Icon.circleEmpty.char
		let glyphColor: RGBA = theme.textDim
		if (s.lifecycleStage === LifecycleStage.Review) {
			glyph = Icon.circleHalf.char
			glyphColor = theme.warning
		} else if (
			s.lifecycleStage === LifecycleStage.Approved ||
			s.lifecycleStage === LifecycleStage.Merged
		) {
			glyph = Icon.circleFilled.char
			glyphColor = theme.success
		} else if (s.tasks.length > 0 && s.tasks.some((t) => t.status === Status.InProgress)) {
			glyph = Icon.circleHalf.char
			glyphColor = theme.active
		}

		return { label: name, suffix, glyph, glyphColor }
	})
}

export function repoListItems(repos: Repository[], theme: ListTheme, ctx: RepoQuery): ListItem[] {
	return repos.map((r) => {
		const name = repoName(r.path)
		const suffix: SuffixSegment[] = []
		suffix.push({ text: `${r.branches.length} branches` })

		const repoStatus = ctx.getRepoStatus(r.path)
		if (repoStatus?.currentBranch) {
			suffix.push({ text: repoStatus.currentBranch })
		}
		if (repoStatus) {
			if (repoStatus.dirty) {
				suffix.push({ text: "dirty", color: theme.gitDirty })
			} else {
				suffix.push({ text: "clean", color: theme.gitClean })
			}
		}

		const findings = ctx.getRepoFindings?.(r.path) ?? []
		if (findings.length > 0) {
			const critical = findings.filter((f) => f.severity === "critical").length
			const high = findings.filter((f) => f.severity === "high").length
			const color = critical > 0 ? theme.danger : high > 0 ? theme.warning : theme.textDim
			const label =
				critical > 0
					? `${critical} crit${high > 0 ? `/${high} high` : ""}`
					: high > 0
						? `${high} high`
						: `${findings.length} findings`
			suffix.push({ text: label, color })
		}

		const signals = ctx.getRepoSignals?.(r.path) ?? []
		if (signals.length > 0) {
			const critical = signals.filter((s) => s.severity === "critical").length
			const high = signals.filter((s) => s.severity === "high").length
			const color = critical > 0 ? theme.danger : high > 0 ? theme.warning : theme.textDim
			const label =
				critical > 0
					? `⚡ ${critical} crit${high > 0 ? `/${high} high` : ""}`
					: high > 0
						? `⚡ ${high} high`
						: `⚡ ${signals.length} errors`
			suffix.push({ text: label, color })
		}

		const glyph = repoStatus?.dirty ? Icon.diamond.char : Icon.circleEmpty.char
		const glyphColor = repoStatus?.dirty ? theme.gitDirty : theme.gitClean

		return { label: name, suffix, glyph, glyphColor }
	})
}

export function branchListItems(
	branches: { name: string; baseBranch: string | null }[],
	repoPath: string,
	theme: ListTheme,
	ctx: BranchQuery,
): ListItem[] {
	return branches.map((b) => {
		const suffix: SuffixSegment[] = []
		const bs = ctx.getBranchStatus(repoPath, b.name)

		if (bs?.session) {
			suffix.push({ text: "running", color: theme.active })
		}

		if (bs?.aheadBehind) {
			const parts: string[] = []
			if (bs.aheadBehind.ahead > 0) parts.push(`+${bs.aheadBehind.ahead}`)
			if (bs.aheadBehind.behind > 0) parts.push(`-${bs.aheadBehind.behind}`)
			if (parts.length > 0) {
				const color =
					bs.aheadBehind.behind > 0
						? theme.gitBehind
						: bs.aheadBehind.ahead > 0
							? theme.gitAhead
							: undefined
				suffix.push({ text: parts.join("/"), color })
			}
		}

		const prList = ctx.getPRs(repoPath, b.name)
		const openPR = prList.find((pr) => PR_OPEN_STATES.has(pr.state))
		if (openPR) {
			suffix.push({
				text: `!${openPR.id} ${openPR.draft ? "draft" : openPR.state}`,
				color: theme.warning,
			})
		}
		if (b.baseBranch) {
			suffix.push({ text: `← ${b.baseBranch}` })
		}

		let glyph = Icon.circleEmpty.char
		let glyphColor: RGBA = theme.textDim
		if (bs?.session) {
			glyph = Icon.circleFilled.char
			glyphColor = theme.active
		} else if (openPR) {
			glyph = Icon.circleHalf.char
			glyphColor = theme.warning
		}

		return { label: b.name, suffix, glyph, glyphColor }
	})
}

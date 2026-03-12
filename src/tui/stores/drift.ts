import type { Story } from "@db/types"
import { PRState } from "@integrations/types"
import type { RGBA } from "@opentui/core"
import { DriftIcon } from "@tui/icons"
import type { useCache } from "@tui/stores/cache"
import type { useIntegrations } from "@tui/stores/integrations"

export interface DriftTag {
	icon: string
	detail: string
	color: RGBA
}

export interface DriftEntry {
	name: string
	tags: DriftTag[]
}

interface DriftColors {
	danger: RGBA
	warning: RGBA
	gitClean: RGBA
}

export interface DriftAccessors {
	getTicketStatus: (key: string) => string | null
	getBranchBehind: (repoPath: string, branchName: string) => number
	getRepoDirty: (repoPath: string) => boolean
	hasOpenPR: (repoPath: string, branchName: string) => boolean
	getPRsMergedCount: (repoPath: string, branchName: string) => number
}

function isTicketDone(status: string): boolean {
	const lower = status.toLowerCase()
	return lower.includes("done") || lower.includes("closed") || lower.includes("production")
}

export function storyIsDrifting(story: Story, accessors: DriftAccessors): boolean {
	if (story.completedAt) return false

	if (story.ticket) {
		const status = accessors.getTicketStatus(story.ticket)
		if (status && isTicketDone(status)) return true
	}

	for (const repo of story.repositories) {
		for (const branch of repo.branches) {
			if (accessors.getBranchBehind(repo.path, branch.name) > 0) return true
		}
	}

	for (const repo of story.repositories) {
		if (accessors.getRepoDirty(repo.path)) return true
	}

	return false
}

export function storyDriftTags(
	story: Story,
	accessors: DriftAccessors,
	colors: DriftColors,
): DriftTag[] {
	const tags: DriftTag[] = []

	if (story.ticket) {
		const status = accessors.getTicketStatus(story.ticket)
		if (status && isTicketDone(status)) {
			tags.push({ icon: DriftIcon.ticketDone, detail: "ticket done", color: colors.danger })
		}
	}

	let mergedCount = 0
	let openCount = 0
	for (const repo of story.repositories) {
		for (const branch of repo.branches) {
			mergedCount += accessors.getPRsMergedCount(repo.path, branch.name)
			if (accessors.hasOpenPR(repo.path, branch.name)) openCount++
		}
	}
	if (mergedCount > 0 && openCount === 0 && !tags.some((t) => t.detail === "ticket done")) {
		tags.push({ icon: DriftIcon.prsMerged, detail: "PRs merged", color: colors.gitClean })
	}

	let maxBehind = 0
	for (const repo of story.repositories) {
		for (const branch of repo.branches) {
			const behind = accessors.getBranchBehind(repo.path, branch.name)
			if (behind > maxBehind) maxBehind = behind
		}
	}
	if (maxBehind > 0) {
		tags.push({ icon: DriftIcon.behind, detail: `${maxBehind} behind`, color: colors.danger })
	}

	let dirtyCount = 0
	for (const repo of story.repositories) {
		if (accessors.getRepoDirty(repo.path)) dirtyCount++
	}
	if (dirtyCount > 0) {
		tags.push({
			icon: DriftIcon.dirty,
			detail: dirtyCount === 1 ? "1 dirty" : `${dirtyCount} dirty`,
			color: colors.warning,
		})
	}

	return tags
}

export function epicDriftEntries(
	stories: Story[],
	accessors: DriftAccessors,
	colors: DriftColors,
): DriftEntry[] {
	const entries: DriftEntry[] = []
	for (const s of stories) {
		if (s.completedAt) continue
		const tags = storyDriftTags(s, accessors, colors)
		if (tags.length > 0) {
			entries.push({ name: s.name, tags })
		}
	}
	return entries
}

export function createDriftAccessors(
	cache: ReturnType<typeof useCache>,
	integrations: ReturnType<typeof useIntegrations>,
): DriftAccessors {
	return {
		getTicketStatus: (key: string) => integrations.getTicket(key)?.status ?? null,
		getBranchBehind: (repoPath: string, branchName: string) =>
			cache.branches[cache.branchKey(repoPath, branchName)]?.aheadBehind?.behind ?? 0,
		getRepoDirty: (repoPath: string) => cache.repos[repoPath]?.status?.dirty ?? false,
		hasOpenPR: (repoPath: string, branchName: string) =>
			integrations.hasOpenPR(repoPath, branchName),
		getPRsMergedCount: (repoPath: string, branchName: string) =>
			integrations.getPRs(repoPath, branchName).filter((pr) => pr.state === PRState.Merged).length,
	}
}

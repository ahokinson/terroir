import type { DiscoverConfig } from "@db/config"
import type { Epic, Story } from "@db/types"
import { GitRepo } from "@integrations/git/client"
import { debug } from "@lib/log"
import type { DiscoverItem } from "@monitor/discover"

export enum AttachBand {
	Definite = "definite",
	Probable = "probable",
}

export interface AttachedItem {
	item: DiscoverItem
	storyName: string
	band: AttachBand
}

export interface DiscoveryDecision {
	attached: AttachedItem[]
	autoCreate: DiscoverItem[]
	suggest: DiscoverItem[]
}

export interface DiscoveryPlanner {
	partition(
		items: DiscoverItem[],
		epics: Epic[],
		userEmails: Set<string>,
		assignedTickets: Set<string>,
	): Promise<DiscoveryDecision>
	collectUserEmails(repoPaths: string[]): Promise<Set<string>>
}

interface MatchTarget {
	storyName: string
	ticket: string | null
	branchKeys: Set<string>
	tokens: string[]
}

const TOKEN_SPLIT = /[^a-z0-9]+/
const PROBABLE_FUZZY_THRESHOLD = 0.8

function tokenize(s: string): string[] {
	return s
		.toLowerCase()
		.split(TOKEN_SPLIT)
		.filter((t) => t.length > 1)
}

function buildMatchTargets(epics: Epic[]): MatchTarget[] {
	const out: MatchTarget[] = []
	for (const epic of epics) {
		for (const story of epic.stories) {
			if (story.completedAt) continue
			out.push(buildTarget(story))
		}
	}
	return out
}

function buildTarget(story: Story): MatchTarget {
	const branchKeys = new Set<string>()
	for (const repo of story.repositories) {
		for (const branch of repo.branches) {
			branchKeys.add(`${repo.path}:${branch.name}`)
		}
	}
	return {
		storyName: story.name,
		ticket: story.ticket,
		branchKeys,
		tokens: tokenize(story.name),
	}
}

function matchItem(item: DiscoverItem, targets: MatchTarget[]): AttachedItem | null {
	for (const t of targets) {
		if (item.ticketKey && t.ticket === item.ticketKey) {
			return { item, storyName: t.storyName, band: AttachBand.Definite }
		}
		for (const b of item.branches) {
			if (t.branchKeys.has(`${b.repoPath}:${b.branchName}`)) {
				return { item, storyName: t.storyName, band: AttachBand.Definite }
			}
		}
	}

	const itemTokens = tokenize(item.name)
	if (itemTokens.length === 0) return null

	let bestScore = 0
	let bestTarget: MatchTarget | null = null
	for (const t of targets) {
		if (t.tokens.length === 0) continue
		const tSet = new Set(t.tokens)
		const matches = itemTokens.filter((tok) => tSet.has(tok)).length
		const score = matches / itemTokens.length
		if (score > bestScore) {
			bestScore = score
			bestTarget = t
		}
	}

	if (bestScore >= PROBABLE_FUZZY_THRESHOLD && bestTarget) {
		return { item, storyName: bestTarget.storyName, band: AttachBand.Probable }
	}
	return null
}

function isAutoCreateable(
	item: DiscoverItem,
	userEmails: Set<string>,
	projectSet: Set<string>,
	assignedTickets: Set<string>,
	authorEmails: Map<string, string>,
): boolean {
	if (userEmails.size === 0) return false

	const authorMatches = item.branches.some((b) => {
		const email = authorEmails.get(`${b.repoPath}:${b.branchName}`)
		return email != null && userEmails.has(email)
	})
	if (!authorMatches) return false

	if (item.ticketKey && assignedTickets.has(item.ticketKey)) return true

	if (item.ticketKey && projectSet.size > 0) {
		const prefix = item.ticketKey.replace(/-\d+$/, "")
		if (projectSet.has(prefix)) return true
	}

	return false
}

export function createDiscoveryPlanner(config: DiscoverConfig): DiscoveryPlanner {
	return {
		async partition(items, epics, userEmails, assignedTickets) {
			const fresh = items.filter((i) => !i.existing)
			if (fresh.length === 0) return { attached: [], autoCreate: [], suggest: [] }

			const targets = buildMatchTargets(epics)

			const authorEmails = new Map<string, string>()
			if (userEmails.size > 0) {
				await Promise.all(
					fresh.flatMap((item) =>
						item.branches.map(async (b) => {
							const key = `${b.repoPath}:${b.branchName}`
							try {
								const email = await new GitRepo(b.repoPath).branchAuthorEmail(b.branchName)
								authorEmails.set(key, email)
							} catch {
								debug(`discovery: failed to get author for ${key}`)
							}
						}),
					),
				)
			}

			const projectSet = new Set(config.autoImportProjects.map((p) => p.toUpperCase()))

			const attached: AttachedItem[] = []
			const autoCreate: DiscoverItem[] = []
			const suggest: DiscoverItem[] = []

			for (const item of fresh) {
				const match = matchItem(item, targets)
				if (match) {
					attached.push(match)
					continue
				}
				if (isAutoCreateable(item, userEmails, projectSet, assignedTickets, authorEmails)) {
					autoCreate.push(item)
					continue
				}
				suggest.push(item)
			}

			return { attached, autoCreate, suggest }
		},

		async collectUserEmails(repoPaths) {
			const emails = new Set<string>()
			await Promise.all(
				repoPaths.map(async (path) => {
					const email = await new GitRepo(path).userEmail()
					if (email) emails.add(email)
				}),
			)
			return emails
		},
	}
}

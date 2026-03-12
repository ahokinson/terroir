import { type Epic, type Repository, type Story, StoryType } from "@db/types"
import { LifecycleStage } from "@domain/lifecycle"
import type { GitIntegration, LocalRepo, TicketIntegration, TicketIssue } from "@integrations/types"
import { parseRepoSlug } from "@integrations/types"
import { debug } from "@lib/log"
import type { AttachedItem } from "@monitor/discovery"

const TICKET_KEY_RE = /[A-Z][A-Z0-9]*-\d+/

export function extractTicketKey(s: string): string | null {
	return s.match(TICKET_KEY_RE)?.[0] ?? null
}

export interface DiscoverBranch {
	repoPath: string
	branchName: string
}

export interface DiscoverItem {
	ticketKey: string
	name: string
	epicName: string | null
	branches: DiscoverBranch[]
	source: "branch" | "jira" | "pr"
	selected: boolean
	existing: boolean
	fuzzyMatched: boolean
}

export interface ScanOpts {
	repos: LocalRepo[]
	epics: Epic[]
	ticketIntegration: TicketIntegration | null
	gitIntegration: GitIntegration | null
	excludeBranches: string[]
	fuzzyThreshold: number
	ignoredTokens: string[]
}

export async function scan(opts: ScanOpts): Promise<DiscoverItem[]> {
	const excludeSet = new Set(opts.excludeBranches.map((b) => b.toLowerCase()))

	const allBranches: { repoPath: string; branchName: string; ticketKey: string }[] = []
	for (const repo of opts.repos) {
		for (const branch of repo.branches) {
			if (excludeSet.has(branch.toLowerCase())) continue
			allBranches.push({
				repoPath: repo.path,
				branchName: branch,
				ticketKey: extractTicketKey(branch) ?? "",
			})
		}
	}

	const groupMap = new Map<string, typeof allBranches>()
	const keyOrder: string[] = []
	for (const b of allBranches) {
		const groupKey = b.ticketKey || b.branchName
		if (!groupMap.has(groupKey)) keyOrder.push(groupKey)
		const list = groupMap.get(groupKey) ?? []
		list.push(b)
		groupMap.set(groupKey, list)
	}

	const stories: {
		ticketKey: string
		name: string
		epicName: string | null
		branches: DiscoverBranch[]
		source: "branch" | "jira" | "pr"
		fuzzyMatched: boolean
	}[] = []

	for (const groupKey of keyOrder) {
		const branches = groupMap.get(groupKey)!
		const ticketKey = branches[0].ticketKey
		stories.push({
			ticketKey,
			name: ticketKey || prettifyBranchName(branches[0].branchName),
			epicName: null,
			branches: branches.map((b) => ({ repoPath: b.repoPath, branchName: b.branchName })),
			source: "branch",
			fuzzyMatched: false,
		})
	}

	if (opts.ticketIntegration) {
		await enrichWithTickets(stories, opts.ticketIntegration)
	}

	const branchKeys = new Set(stories.filter((s) => s.ticketKey).map((s) => s.ticketKey))

	let ticketIssues: TicketIssue[] = []
	if (opts.ticketIntegration) {
		try {
			ticketIssues = await opts.ticketIntegration.search()
		} catch (err) {
			debug("ticket search failed:", err)
		}
	}

	if (ticketIssues.length > 0 && opts.fuzzyThreshold > 0) {
		const ignoredSet = new Set(opts.ignoredTokens)
		const candidates = ticketIssues.map((issue) => ({
			issue,
			tokens: tokenize(issue.summary, ignoredSet),
		}))

		for (const story of stories) {
			if (story.ticketKey) continue
			const slugTokens = tokenize(story.name, ignoredSet)
			if (slugTokens.length === 0) continue

			let bestScore = 0
			let bestIdx = -1
			for (let j = 0; j < candidates.length; j++) {
				if (branchKeys.has(candidates[j].issue.key)) continue
				const score = fuzzyScore(slugTokens, candidates[j].tokens)
				if (score > bestScore) {
					bestScore = score
					bestIdx = j
				}
			}

			if (bestScore >= opts.fuzzyThreshold && bestIdx >= 0) {
				const issue = candidates[bestIdx].issue
				story.ticketKey = issue.key
				story.name = issue.summary
				story.epicName = issue.epic || null
				story.fuzzyMatched = true
				branchKeys.add(issue.key)
			}
		}
	}

	for (const issue of ticketIssues) {
		if (branchKeys.has(issue.key)) continue
		stories.push({
			ticketKey: issue.key,
			name: issue.summary || issue.key,
			epicName: issue.epic || null,
			branches: [],
			source: "jira",
			fuzzyMatched: false,
		})
		branchKeys.add(issue.key)
	}

	if (opts.gitIntegration) {
		for (const repo of opts.repos) {
			const slug = parseRepoSlug(repo.remote)
			if (!slug) continue
			try {
				const prs = await opts.gitIntegration.userPRs(slug)
				for (const pr of prs) {
					const prKey = extractTicketKey(pr.title) ?? `PR#${pr.id}`
					if (branchKeys.has(prKey)) continue
					stories.push({
						ticketKey: prKey,
						name: pr.title,
						epicName: null,
						branches: [],
						source: "pr",
						fuzzyMatched: false,
					})
					branchKeys.add(prKey)
				}
			} catch (err) {
				debug("user PR fetch failed:", err)
			}
		}
	}

	const items: DiscoverItem[] = stories.map((s) => ({
		ticketKey: s.ticketKey,
		name: s.name,
		epicName: s.epicName,
		branches: s.branches,
		source: s.source,
		selected: true,
		existing: false,
		fuzzyMatched: s.fuzzyMatched,
	}))

	flagExisting(items, opts.epics)
	return items
}

export function attach(epics: Epic[], attached: AttachedItem[]): { epics: Epic[]; count: number } {
	if (attached.length === 0) return { epics, count: 0 }

	const byStoryName = new Map<string, AttachedItem[]>()
	for (const a of attached) {
		const list = byStoryName.get(a.storyName) ?? []
		list.push(a)
		byStoryName.set(a.storyName, list)
	}

	let count = 0
	const result = epics.map((epic) => ({
		...epic,
		stories: epic.stories.map((story) => {
			const matches = byStoryName.get(story.name)
			if (!matches) return story
			const merged = mergeBranchesIntoRepos(story.repositories, matches)
			if (merged === story.repositories) return story
			count += matches.length
			return { ...story, repositories: merged }
		}),
	}))

	return { epics: result, count }
}

function mergeBranchesIntoRepos(existing: Repository[], items: AttachedItem[]): Repository[] {
	const repoMap = new Map(existing.map((r) => [r.path, { ...r, branches: [...r.branches] }]))
	let changed = false

	for (const a of items) {
		for (const b of a.item.branches) {
			let repo = repoMap.get(b.repoPath)
			if (!repo) {
				repo = { path: b.repoPath, branches: [] }
				repoMap.set(b.repoPath, repo)
				changed = true
			}
			if (!repo.branches.some((br) => br.name === b.branchName)) {
				repo.branches.push({ name: b.branchName, baseBranch: null })
				changed = true
			}
		}
	}

	if (!changed) return existing
	return [...repoMap.values()]
}

export function commit(
	selected: DiscoverItem[],
	epics: Epic[],
	autoImportEpic?: string,
): { epics: Epic[]; imported: number } {
	const now = new Date().toISOString()
	let imported = 0
	const result = epics.map((e) => ({ ...e, stories: [...e.stories] }))
	const autoImport = !!autoImportEpic

	for (const item of selected) {
		if (!item.selected) continue

		let epicIdx: number
		if (!item.epicName) {
			const fallbackName = autoImportEpic ?? ""
			const fallbackSource = autoImportEpic ? "auto" : null
			epicIdx = result.findIndex((e) => e.name === fallbackName)
			if (epicIdx < 0) {
				result.unshift({ name: fallbackName, source: fallbackSource, stories: [] })
				epicIdx = 0
			}
		} else {
			epicIdx = result.findIndex((e) => e.name === item.epicName)
			if (epicIdx < 0) {
				result.push({ name: item.epicName, source: "jira", stories: [] })
				epicIdx = result.length - 1
			}
		}

		const storyType = item.branches.some(
			(b) =>
				b.branchName.startsWith("fix/") ||
				b.branchName.startsWith("bugfix/") ||
				b.branchName.startsWith("hotfix/"),
		)
			? StoryType.Bug
			: StoryType.Feature

		const story: Story = {
			name: item.name,
			type: storyType,
			ticket: item.ticketKey || null,
			source: item.source === "branch" ? null : item.source,
			createdAt: now,
			completedAt: null,
			lifecycleStage: LifecycleStage.Active,
			autoImported: autoImport,
			tasks: [],
			repositories: [],
		}

		const byRepo = new Map<string, string[]>()
		for (const b of item.branches) {
			const list = byRepo.get(b.repoPath) ?? []
			list.push(b.branchName)
			byRepo.set(b.repoPath, list)
		}
		for (const [path, branches] of byRepo) {
			story.repositories.push({
				path,
				branches: branches.map((name) => ({ name, baseBranch: null })),
			})
		}

		result[epicIdx].stories.push(story)
		imported++
	}

	return { epics: result, imported }
}

async function enrichWithTickets(
	stories: { ticketKey: string; name: string; epicName: string | null }[],
	tp: TicketIntegration,
) {
	await Promise.all(
		stories
			.filter((s) => s.ticketKey)
			.map(async (s) => {
				try {
					const issue = await tp.getIssue(s.ticketKey)
					if (issue) {
						if (issue.summary) s.name = issue.summary
						if (issue.epic) s.epicName = issue.epic
					}
				} catch (err) {
					debug("ticket enrichment failed:", err)
				}
			}),
	)
}

function flagExisting(items: DiscoverItem[], epics: Epic[]) {
	const existing = new Set<string>()
	for (const epic of epics) {
		for (const story of epic.stories) {
			for (const repo of story.repositories) {
				for (const branch of repo.branches) {
					existing.add(`${repo.path}:${branch.name}`)
				}
			}
		}
	}
	for (const item of items) {
		if (item.branches.length === 0) continue
		const allExist = item.branches.every((b) => existing.has(`${b.repoPath}:${b.branchName}`))
		if (allExist) {
			item.existing = true
			item.selected = false
		}
	}
}

const BRANCH_PREFIXES = [
	"feat/",
	"feature/",
	"fix/",
	"bugfix/",
	"hotfix/",
	"chore/",
	"refactor/",
	"build/",
	"ci/",
	"docs/",
	"test/",
	"release/",
]

function prettifyBranchName(name: string): string {
	for (const prefix of BRANCH_PREFIXES) {
		if (name.startsWith(prefix)) {
			name = name.slice(prefix.length)
			break
		}
	}
	return name.replace(/[-_]/g, " ")
}

const TOKEN_SPLIT = /[^a-z0-9]+/

function tokenize(s: string, ignored: Set<string>): string[] {
	return s
		.toLowerCase()
		.split(TOKEN_SPLIT)
		.filter((t) => t && !ignored.has(t))
}

function fuzzyScore(slugTokens: string[], summaryTokens: string[]): number {
	if (slugTokens.length === 0) return 0
	const set = new Set(summaryTokens)
	const matches = slugTokens.filter((t) => set.has(t)).length
	return matches / slugTokens.length
}

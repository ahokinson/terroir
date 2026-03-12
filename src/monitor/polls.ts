import type { DiscoverConfig } from "@db/config"
import type { Epic } from "@db/types"
import type { LifecycleStage } from "@domain/lifecycle"
import { GitRepo } from "@integrations/git/client"
import type { LocalRepo, Pipeline, PullRequest, TicketIssue } from "@integrations/types"
import {
	isTicketDone,
	PipelineStatus,
	PR_OPEN_STATES,
	PRState,
	parseRepoSlug,
	Severity,
} from "@integrations/types"
import { branchKey } from "@lib/branches"
import { debug } from "@lib/log"
import {
	createBranchDiffer,
	event as createEvent,
	diffReviewRequests,
	diffTicketAssignments,
	pipelineDiffer,
	prDiffer,
	securityDiffer,
	signalDiffer,
	storyDriftDiffer,
	ticketDiffer,
} from "@monitor/diff"
import { attach, commit, type DiscoverItem, scan } from "@monitor/discover"
import { AttachBand, createDiscoveryPlanner } from "@monitor/discovery"
import type {
	BranchSnapshot,
	MonitorEvent,
	PipelineSnapshot,
	PRSnapshot,
	ReviewRequestSnapshot,
	SecuritySnapshot,
	SignalSnapshot,
	StorySnapshot,
	TicketSnapshot,
} from "@monitor/types"
import { EventType } from "@monitor/types"
import { MediumPollStaggerMs } from "@tui/layout"
import type { useCache } from "@tui/stores/cache"
import type { useIntegrations } from "@tui/stores/integrations"

export interface Suggestion {
	id: string
	item: DiscoverItem
}

export function suggestionId(item: DiscoverItem): string {
	if (item.ticketKey) return `ticket:${item.ticketKey}`
	const first = item.branches[0]
	if (first) return `branch:${first.repoPath}:${first.branchName}`
	return `discover:${item.name}`
}

type Cache = ReturnType<typeof useCache>
type Integrations = ReturnType<typeof useIntegrations>

interface ActiveRepo {
	path: string
	branches: { name: string; baseBranch: string | null }[]
	storyName: string
	slug: string | null
}

interface SnapshotDeps {
	repos: ActiveRepo[]
	integrations?: Integrations
	cache?: Cache
}

interface StoryForSnapshot {
	name: string
	ticket: string | null
	completedAt: string | null
	lifecycleStage: LifecycleStage
	repositories: { path: string; branches: { name: string }[] }[]
}

export class SnapshotBuilder {
	private readonly repos: ActiveRepo[]
	private readonly integrations?: Integrations
	private readonly cache?: Cache

	constructor(deps: SnapshotDeps) {
		this.repos = deps.repos
		this.integrations = deps.integrations
		this.cache = deps.cache
	}

	static storySnapshot(
		story: StoryForSnapshot,
		getPRs: (path: string, branch: string) => PullRequest[],
		getPipeline: (path: string, branch: string) => Pipeline | null,
		getTicket: (key: string) => TicketIssue | null,
	): StorySnapshot {
		let mergedCount = 0
		let openCount = 0
		let allApproved = true
		let allCIGreen = true

		for (const repo of story.repositories) {
			for (const branch of repo.branches) {
				const prs = getPRs(repo.path, branch.name)
				mergedCount += prs.filter((pr) => pr.state === PRState.Merged).length
				const openPRs = prs.filter((pr) => PR_OPEN_STATES.has(pr.state))
				if (openPRs.length > 0) {
					openCount++
					if (openPRs.some((pr) => pr.approvals < 1)) allApproved = false
				}
				const pipeline = getPipeline(repo.path, branch.name)
				if (pipeline && pipeline.status !== PipelineStatus.Success) allCIGreen = false
			}
		}

		if (openCount === 0) {
			allApproved = false
			allCIGreen = mergedCount > 0
		}

		let ticketDone = false
		if (story.ticket) {
			const issue = getTicket(story.ticket)
			if (issue) ticketDone = isTicketDone(issue.status)
		}

		return {
			name: story.name,
			ticket: story.ticket,
			completed: !!story.completedAt,
			allPRsMerged: mergedCount > 0,
			hasOpenPRs: openCount > 0,
			ticketDone,
			allApproved,
			allCIGreen,
			lifecycleStage: story.lifecycleStage,
		}
	}

	private requireIntegrations(): Integrations {
		if (!this.integrations) throw new Error("SnapshotBuilder: integrations not provided")
		return this.integrations
	}

	private requireCache(): Cache {
		if (!this.cache) throw new Error("SnapshotBuilder: cache not provided")
		return this.cache
	}

	buildPRs(): PRSnapshot[] {
		const integrations = this.requireIntegrations()
		const snapshots: PRSnapshot[] = []
		for (const repo of this.repos) {
			for (const branch of repo.branches) {
				const key = branchKey(repo.path, branch.name)
				const prs = integrations.getPRs(repo.path, branch.name)
				snapshots.push({
					key,
					storyName: repo.storyName,
					prs: prs.map((pr) => ({
						id: pr.id,
						state: pr.state,
						approvals: pr.approvals,
						reviewCommentCount: 0,
					})),
				})
			}
		}
		return snapshots
	}

	buildPipelines(): PipelineSnapshot[] {
		const integrations = this.requireIntegrations()
		const snapshots: PipelineSnapshot[] = []
		for (const repo of this.repos) {
			for (const branch of repo.branches) {
				const key = branchKey(repo.path, branch.name)
				const pipeline = integrations.getPipeline(repo.path, branch.name)
				snapshots.push({ key, storyName: repo.storyName, status: pipeline?.status ?? null })
			}
		}
		return snapshots
	}

	buildTickets(tickets: { key: string; storyName: string }[]): TicketSnapshot[] {
		const integrations = this.requireIntegrations()
		const snapshots: TicketSnapshot[] = []
		for (const { key, storyName } of tickets) {
			const issue = integrations.getTicket(key)
			if (!issue) continue
			snapshots.push({ key, status: issue.status, storyName })
		}
		return snapshots
	}

	buildBranches(): BranchSnapshot[] {
		const cache = this.requireCache()
		return this.repos.map((repo) => {
			const behindCounts: Record<string, number> = {}
			for (const branch of repo.branches) {
				const key = branchKey(repo.path, branch.name)
				behindCounts[key] = cache.branches[key]?.aheadBehind?.behind ?? 0
			}
			return {
				repoPath: repo.path,
				branches: repo.branches.map((b) => b.name),
				behindCounts,
			}
		})
	}

	buildStoryDrift(epics: Epic[]): StorySnapshot[] {
		const integrations = this.requireIntegrations()
		return epics.flatMap((epic) =>
			epic.stories.map((story) =>
				SnapshotBuilder.storySnapshot(
					story,
					(p, b) => integrations.getPRs(p, b),
					(p, b) => integrations.getPipeline(p, b),
					(k) => integrations.getTicket(k),
				),
			),
		)
	}

	buildSecurity(): SecuritySnapshot[] {
		const integrations = this.requireIntegrations()
		const snapshots: SecuritySnapshot[] = []
		if (integrations.securityProviders.length === 0) return snapshots

		for (const repo of this.repos) {
			for (const branch of repo.branches) {
				const key = branchKey(repo.path, branch.name)
				const findings = integrations.getBranchFindings(repo.path, branch.name)
				const findingIds = findings.map((f) => f.id).sort()
				const criticalIds = findings
					.filter((f) => f.severity === Severity.Critical)
					.map((f) => f.id)
					.sort()
				const highIds = findings
					.filter((f) => f.severity === Severity.High)
					.map((f) => f.id)
					.sort()
				snapshots.push({
					key,
					storyName: repo.storyName,
					findingIds,
					criticalIds,
					highIds,
					totalCount: findings.length,
				})
			}
		}
		return snapshots
	}

	buildSignals(): SignalSnapshot[] {
		const integrations = this.requireIntegrations()
		const snapshots: SignalSnapshot[] = []
		if (integrations.signalProviders.length === 0) return snapshots

		for (const repo of this.repos) {
			for (const branch of repo.branches) {
				const key = branchKey(repo.path, branch.name)
				const signals = integrations.getBranchSignals(repo.path, branch.name)
				const signalIds = signals.map((s) => s.id).sort()
				const criticalIds = signals
					.filter((s) => s.severity === Severity.Critical)
					.map((s) => s.id)
					.sort()
				const highIds = signals
					.filter((s) => s.severity === Severity.High)
					.map((s) => s.id)
					.sort()
				snapshots.push({
					key,
					storyName: repo.storyName,
					signalIds,
					criticalIds,
					highIds,
					totalCount: signals.length,
				})
			}
		}
		return snapshots
	}
}

function collectActiveRepos(epics: Epic[], slugs: Map<string, string | null>): ActiveRepo[] {
	const repos: ActiveRepo[] = []
	for (const epic of epics) {
		for (const story of epic.stories) {
			if (story.completedAt) continue
			for (const repo of story.repositories) {
				repos.push({
					path: repo.path,
					branches: repo.branches,
					storyName: story.name,
					slug: slugs.get(repo.path) ?? null,
				})
			}
		}
	}
	return repos
}

function collectTicketKeys(epics: Epic[]): { key: string; storyName: string }[] {
	const tickets: { key: string; storyName: string }[] = []
	const seen = new Set<string>()
	for (const epic of epics) {
		for (const story of epic.stories) {
			if (story.completedAt || !story.ticket) continue
			if (seen.has(story.ticket)) continue
			seen.add(story.ticket)
			tickets.push({ key: story.ticket, storyName: story.name })
		}
	}
	return tickets
}

export interface PollState {
	prSnapshots: PRSnapshot[]
	pipelineSnapshots: PipelineSnapshot[]
	ticketSnapshots: TicketSnapshot[]
	branchSnapshots: BranchSnapshot[]
	storySnapshots: StorySnapshot[]
	securitySnapshots: SecuritySnapshot[]
	signalSnapshots: SignalSnapshot[]
	knownTicketKeys: Set<string>
	knownReviewRequestKeys: Set<string>
	repoSlugs: Map<string, string | null>
}

export function emptyPollState(): PollState {
	return {
		prSnapshots: [],
		pipelineSnapshots: [],
		ticketSnapshots: [],
		branchSnapshots: [],
		storySnapshots: [],
		securitySnapshots: [],
		signalSnapshots: [],
		knownTicketKeys: new Set(),
		knownReviewRequestKeys: new Set(),
		repoSlugs: new Map(),
	}
}

export async function initSlugs(epics: Epic[]): Promise<Map<string, string | null>> {
	const slugs = new Map<string, string | null>()
	const paths = new Set<string>()
	for (const epic of epics) {
		for (const story of epic.stories) {
			for (const repo of story.repositories) {
				paths.add(repo.path)
			}
		}
	}
	await Promise.all(
		[...paths].map(async (path) => {
			try {
				const remote = await new GitRepo(path).remoteUrl()
				slugs.set(path, parseRepoSlug(remote))
			} catch (err) {
				debug(`monitor: remoteUrl failed for ${path}: ${err}`)
				slugs.set(path, null)
			}
		}),
	)
	return slugs
}

export async function pollFast(
	epics: Epic[],
	cache: Cache,
	prev: PollState,
): Promise<{ events: MonitorEvent[]; branchSnapshots: BranchSnapshot[] }> {
	debug("monitor: fast poll")
	const repos = collectActiveRepos(epics, prev.repoSlugs)

	await Promise.all(repos.map((r) => cache.refreshRepo(r.path)))

	for (const repo of repos) {
		const base = cache.repos[repo.path]?.defaultBranch ?? "main"
		await Promise.all(repo.branches.map((b) => cache.refreshBranch(repo.path, b.name, base)))
	}

	const builder = new SnapshotBuilder({ repos, cache })
	const nextBranches = builder.buildBranches()
	const events = createBranchDiffer(10).diff(prev.branchSnapshots, nextBranches)
	return { events, branchSnapshots: nextBranches }
}

export async function pollMedium(
	epics: Epic[],
	integrations: Integrations,
	prev: PollState,
): Promise<{
	events: MonitorEvent[]
	prSnapshots: PRSnapshot[]
	pipelineSnapshots: PipelineSnapshot[]
	ticketSnapshots: TicketSnapshot[]
	storySnapshots: StorySnapshot[]
}> {
	debug("monitor: medium poll")
	const repos = collectActiveRepos(epics, prev.repoSlugs)
	const tickets = collectTicketKeys(epics)

	for (const t of tickets) integrations.fetchTicket(t.key)
	if (integrations.git) {
		for (const repo of repos) {
			if (!repo.slug) continue
			for (const b of repo.branches) {
				integrations.fetchPRs(repo.path, b.name, repo.slug)
				integrations.fetchPipeline(repo.path, b.name, repo.slug)
			}
		}
	}

	await new Promise((r) => setTimeout(r, MediumPollStaggerMs))

	const builder = new SnapshotBuilder({ repos, integrations })
	const nextPRs = builder.buildPRs()
	const nextPipelines = builder.buildPipelines()
	const nextTickets = builder.buildTickets(tickets)
	const nextStories = builder.buildStoryDrift(epics)

	const events =
		prev.prSnapshots.length > 0 || prev.ticketSnapshots.length > 0
			? [
					...prDiffer.diff(prev.prSnapshots, nextPRs),
					...pipelineDiffer.diff(prev.pipelineSnapshots, nextPipelines),
					...ticketDiffer.diff(prev.ticketSnapshots, nextTickets),
					...storyDriftDiffer.diff(prev.storySnapshots, nextStories),
				]
			: []

	return {
		events,
		prSnapshots: nextPRs,
		pipelineSnapshots: nextPipelines,
		ticketSnapshots: nextTickets,
		storySnapshots: nextStories,
	}
}

export interface SlowPollDeps {
	epics: Epic[]
	cache: Cache
	integrations: Integrations
	localRepos: LocalRepo[]
	discoverConfig: DiscoverConfig
}

export interface SlowPollResult {
	events: MonitorEvent[]
	knownTicketKeys: Set<string>
	knownReviewRequestKeys: Set<string>
	repoSlugs: Map<string, string | null>
	securitySnapshots: SecuritySnapshot[]
	signalSnapshots: SignalSnapshot[]
	epics: Epic[]
	storeChanged: boolean
	suggestions: Suggestion[]
}

export interface PollerDeps {
	cache: Cache
	integrations: Integrations
	localRepos: () => LocalRepo[]
	discoverConfig: () => DiscoverConfig
}

export class Poller {
	constructor(private readonly deps: PollerDeps) {}

	pollFast(epics: Epic[], prev: PollState) {
		return pollFast(epics, this.deps.cache, prev)
	}

	pollMedium(epics: Epic[], prev: PollState) {
		return pollMedium(epics, this.deps.integrations, prev)
	}

	pollSlow(epics: Epic[], prev: PollState) {
		return pollSlow(
			{
				epics,
				cache: this.deps.cache,
				integrations: this.deps.integrations,
				localRepos: this.deps.localRepos(),
				discoverConfig: this.deps.discoverConfig(),
			},
			prev,
		)
	}
}

export async function pollSlow(deps: SlowPollDeps, prev: PollState): Promise<SlowPollResult> {
	const { epics, cache, integrations, localRepos, discoverConfig } = deps
	debug("monitor: slow poll")

	const activeRepos = collectActiveRepos(epics, prev.repoSlugs)
	const paths = new Set(activeRepos.map((r) => r.path))
	await Promise.all(
		[...paths].map((path) =>
			new GitRepo(path).fetch().catch((err) => debug(`monitor: fetch failed for ${path}: ${err}`)),
		),
	)

	await cache.refreshAll()
	integrations.refreshAll()

	await new Promise((r) => setTimeout(r, MediumPollStaggerMs))

	const newSlugs = await initSlugs(epics)

	const events: MonitorEvent[] = []
	let knownTicketKeys = prev.knownTicketKeys

	const reviewPRs = integrations.getReviewRequests()
	const nextReview: ReviewRequestSnapshot[] = reviewPRs.map((pr) => ({
		key: `${pr.repoSlug ?? "?"}#${pr.id}`,
		id: pr.id,
		title: pr.title,
		repoSlug: pr.repoSlug ?? null,
	}))
	const knownReviewRequestKeys = new Set(nextReview.map((r) => r.key))
	if (prev.knownReviewRequestKeys.size > 0) {
		events.push(...diffReviewRequests(prev.knownReviewRequestKeys, nextReview))
	}

	const builder = new SnapshotBuilder({ repos: activeRepos, integrations, cache })
	const nextSecurity = builder.buildSecurity()
	if (prev.securitySnapshots.length > 0) {
		events.push(...securityDiffer.diff(prev.securitySnapshots, nextSecurity))
	}
	const nextSignals = builder.buildSignals()
	if (prev.signalSnapshots.length > 0) {
		events.push(...signalDiffer.diff(prev.signalSnapshots, nextSignals))
	}

	if (integrations.tickets) {
		try {
			const searchResults = await integrations.tickets.search()
			events.push(
				...diffTicketAssignments(
					prev.knownTicketKeys,
					searchResults.map((t) => ({ key: t.key, summary: t.summary })),
				),
			)
			knownTicketKeys = new Set(searchResults.map((t) => t.key))
		} catch {
			debug("monitor: ticket search failed")
		}
	}

	let resultEpics = epics
	let storeChanged = false
	const suggestions: Suggestion[] = []
	try {
		const discovered = await scan({
			repos: localRepos,
			epics,
			ticketIntegration: integrations.tickets,
			gitIntegration: integrations.git,
			excludeBranches: discoverConfig.excludeBranches,
			fuzzyThreshold: discoverConfig.fuzzyThreshold,
			ignoredTokens: discoverConfig.ignoredTokens,
		})

		const planner = createDiscoveryPlanner(discoverConfig)
		const repoPaths = [...new Set(localRepos.map((r) => r.path))]
		const userEmails = await planner.collectUserEmails(repoPaths)
		const decision = await planner.partition(discovered, epics, userEmails, knownTicketKeys)

		if (decision.attached.length > 0) {
			const result = attach(resultEpics, decision.attached)
			resultEpics = result.epics
			storeChanged = storeChanged || result.count > 0
			for (const a of decision.attached) {
				const type =
					a.band === AttachBand.Probable
						? EventType.DiscoveryAttachedProbable
						: EventType.DiscoveryAttached
				events.push(createEvent(type, `Attached to ${a.storyName}: ${a.item.name}`, a.storyName))
			}
		}

		if (decision.autoCreate.length > 0) {
			debug(`monitor: auto-importing ${decision.autoCreate.length} items`)
			for (const item of decision.autoCreate) item.selected = true
			const result = commit(decision.autoCreate, resultEpics, discoverConfig.autoImportEpic)
			resultEpics = result.epics
			storeChanged = storeChanged || result.imported > 0
			for (const item of decision.autoCreate) {
				events.push(
					createEvent(EventType.DiscoveryAutoImport, `Auto-imported: ${item.name}`, item.name),
				)
			}
		}

		for (const item of decision.suggest) {
			suggestions.push({ id: suggestionId(item), item })
		}
	} catch (err) {
		debug(`monitor: discovery scan failed: ${err}`)
	}

	return {
		events,
		knownTicketKeys,
		knownReviewRequestKeys,
		repoSlugs: newSlugs,
		securitySnapshots: nextSecurity,
		signalSnapshots: nextSignals,
		epics: resultEpics,
		storeChanged,
		suggestions,
	}
}

import type { Config } from "@db/config"
import { createAikidoIntegration } from "@integrations/aikido"
import { createDatadogIntegration, datadogMinPollSeconds } from "@integrations/datadog"
import { GitRepo } from "@integrations/git/client"
import { createGitHubIntegration } from "@integrations/github"
import { createGitLabIntegration } from "@integrations/gitlab"
import { createJiraIntegration } from "@integrations/jira"
import { createOrcaIntegration } from "@integrations/orca"
import { createSentryIntegration } from "@integrations/sentry"
import { createSumoIntegration } from "@integrations/sumo"
import type {
	GitIntegration,
	LinkedIssue,
	Pipeline,
	PullRequest,
	SecurityFinding,
	SecurityIntegration,
	Signal,
	SignalProvider,
	TicketIntegration,
	TicketIssue,
} from "@integrations/types"
import { detectRemote, PR_OPEN_STATES, parseRepoSlug, RemoteType } from "@integrations/types"
import { branchKey } from "@lib/branches"
import { isInstalledSync } from "@lib/cli"
import { debug } from "@lib/log"
import { useAppStore } from "@tui/contexts/store"
import { createCachedResource } from "@tui/lib/resource"
import type { EpicsState } from "@tui/stores/epics"
import { createEffect, on } from "solid-js"

export interface IntegrationsState {
	git: GitIntegration | null
	tickets: TicketIntegration | null
	securityProviders: SecurityIntegration[]
	signalProviders: SignalProvider[]
	gitFor(remoteUrl: string): GitIntegration | null
	getTicket(key: string): TicketIssue | null
	getPRs(repoPath: string, branch: string): PullRequest[]
	getPipeline(repoPath: string, branch: string): Pipeline | null
	getLinkedIssues(repoPath: string, branch: string): LinkedIssue[]
	getReviewRequests(): PullRequest[]
	getMyOpenPRs(): PullRequest[]
	getRepoFindings(repoPath: string): SecurityFinding[]
	getBranchFindings(repoPath: string, branch: string): SecurityFinding[]
	getRepoSignals(repoPath: string): Signal[]
	getBranchSignals(repoPath: string, branch: string): Signal[]
	hasOpenPR(repoPath: string, branch: string): boolean
	fetchTicket(key: string): void
	fetchPRs(repoPath: string, branch: string, slug: string): void
	fetchPipeline(repoPath: string, branch: string, slug: string): void
	fetchReviewRequests(): void
	fetchMyOpenPRs(): void
	fetchRepoSecurity(repoPath: string): void
	fetchBranchSecurity(repoPath: string, branch: string): void
	fetchRepoSignals(repoPath: string): void
	fetchBranchSignals(repoPath: string, branch: string): void
	refreshAll(): void
}

export interface IntegrationsStateDeps {
	store: EpicsState
	config: () => Config
}

interface SignalProviderEntry {
	provider: SignalProvider
	minPollSeconds: number
}

function buildSignalProviders(config: () => Config): SignalProviderEntry[] {
	const entries: SignalProviderEntry[] = []
	const sig = config().signals

	if (sig.sentry.enabled && process.env.SENTRY_API_TOKEN && sig.sentry.organization) {
		entries.push({
			provider: createSentryIntegration({
				apiToken: process.env.SENTRY_API_TOKEN,
				organization: sig.sentry.organization,
				projectMap: sig.sentry.projectMap,
			}),
			minPollSeconds: 60,
		})
	}

	if (sig.datadog.enabled && process.env.DATADOG_API_KEY && process.env.DATADOG_APP_KEY) {
		const ddCfg = {
			apiKey: process.env.DATADOG_API_KEY,
			appKey: process.env.DATADOG_APP_KEY,
			site: sig.datadog.site,
			projectMap: sig.datadog.projectMap,
			minPollSeconds: sig.datadog.minPollSeconds,
		}
		entries.push({
			provider: createDatadogIntegration(ddCfg),
			minPollSeconds: datadogMinPollSeconds(ddCfg),
		})
	}

	debug(`signal providers: ${entries.map((e) => e.provider.source).join(",") || "(none)"}`)
	return entries
}

function buildSecurityProviders(config: () => Config): SecurityIntegration[] {
	const providers: SecurityIntegration[] = []
	const sec = config().security

	const hasAikido = isInstalledSync("aikido-api-client")
	const hasOrca = isInstalledSync("orca-cli")
	const hasSumo = isInstalledSync("sumocli")

	if (sec.aikidoEnabled && hasAikido && process.env.AIKIDO_API_KEY) {
		providers.push(createAikidoIntegration({ apiKey: process.env.AIKIDO_API_KEY }))
	}
	if (sec.orcaEnabled && hasOrca && process.env.ORCA_API_TOKEN) {
		providers.push(createOrcaIntegration({ apiToken: process.env.ORCA_API_TOKEN }))
	}
	if (sec.sumoEnabled && hasSumo) {
		providers.push(
			createSumoIntegration({
				repoQueries: sec.sumoRepoQueries,
				resultLimit: sec.sumoResultLimit,
			}),
		)
	}

	debug(
		`security providers: ${providers.map((p) => p.scanner).join(",") || "(none)"} ` +
			`(cli: aikido=${hasAikido} orca=${hasOrca} sumo=${hasSumo})`,
	)
	return providers
}

async function getRemoteUrl(path: string): Promise<string> {
	try {
		return await new GitRepo(path).remoteUrl()
	} catch {
		return ""
	}
}

export function createIntegrationsState(deps: IntegrationsStateDeps): IntegrationsState {
	const { store, config } = deps

	const hasGh = isInstalledSync("gh")
	const hasGlab = isInstalledSync("glab")
	const hasAcli = isInstalledSync("acli")

	const ghIntegration = hasGh ? createGitHubIntegration() : null
	const glabIntegration = hasGlab ? createGitLabIntegration() : null
	const git = ghIntegration ?? glabIntegration
	const tickets = hasAcli ? createJiraIntegration({ jql: process.env.JIRA_JQL }) : null
	const securityProviders = buildSecurityProviders(config)
	const signalEntries = buildSignalProviders(config)
	const signalProviders = signalEntries.map((e) => e.provider)

	debug(`integrations: gh=${hasGh} glab=${hasGlab} acli=${hasAcli}`)

	const ticketCache = createCachedResource<TicketIssue | null>(null)
	const prCache = createCachedResource<PullRequest[]>([])
	const pipelineCache = createCachedResource<Pipeline | null>(null)
	const linkedIssueCache = createCachedResource<LinkedIssue[]>([])
	const reviewRequestCache = createCachedResource<PullRequest[]>([])
	const myOpenPRsCache = createCachedResource<PullRequest[]>([])
	const repoSecurityCache = createCachedResource<SecurityFinding[]>([])
	const branchSecurityCache = createCachedResource<SecurityFinding[]>([])
	const repoSignalCache = createCachedResource<Signal[]>([])
	const branchSignalCache = createCachedResource<Signal[]>([])
	const signalLastFetched = new Map<string, number>()

	function withinTtl(key: string, minSeconds: number): boolean {
		const last = signalLastFetched.get(key) ?? 0
		return Date.now() - last < minSeconds * 1000
	}

	function recordFetch(key: string): void {
		signalLastFetched.set(key, Date.now())
	}

	function gitFor(remote: string): GitIntegration | null {
		const host = detectRemote(remote)
		if (host === RemoteType.GitHub) return ghIntegration
		if (host === RemoteType.GitLab) return glabIntegration
		return git
	}

	function fetchReviewRequests(): void {
		if (!git) return
		reviewRequestCache.fetch("me", () => git.listMrsForReview())
	}

	function fetchMyOpenPRs(): void {
		if (!git) return
		myOpenPRsCache.fetch("me", () => git.listMyOpenPRs())
	}

	function fetchTicket(key: string): void {
		if (!tickets) return
		ticketCache.fetch(key, () => tickets.getIssue(key))
	}

	function fetchLinkedIssues(repoPath: string, branch: string, slug: string, prId: number): void {
		if (!git) return
		const key = branchKey(repoPath, branch)
		linkedIssueCache.fetch(key, () => git.linkedIssues(slug, prId))
	}

	function fetchPRs(repoPath: string, branch: string, slug: string): void {
		if (!git) return
		const key = branchKey(repoPath, branch)
		prCache.fetch(key, async () => {
			const prs = await git.prsForBranch(slug, branch)
			const openPR = prs.find((pr) => PR_OPEN_STATES.has(pr.state))
			if (openPR) fetchLinkedIssues(repoPath, branch, slug, openPR.id)
			return prs
		})
	}

	function fetchPipeline(repoPath: string, branch: string, slug: string): void {
		if (!git) return
		const key = branchKey(repoPath, branch)
		pipelineCache.fetch(key, () => git.pipelineForBranch(slug, branch))
	}

	function fetchRepoSecurity(repoPath: string): void {
		if (securityProviders.length === 0) return
		repoSecurityCache.fetch(repoPath, async () => {
			const results = await Promise.all(
				securityProviders.map((p) =>
					p.scanRepo(repoPath).catch((err) => {
						debug(`security ${p.scanner} scanRepo failed: ${err}`)
						return null
					}),
				),
			)
			return results.flatMap((r) => r?.findings ?? [])
		})
	}

	function fetchBranchSecurity(repoPath: string, branch: string): void {
		if (securityProviders.length === 0) return
		const key = branchKey(repoPath, branch)
		branchSecurityCache.fetch(key, async () => {
			const results = await Promise.all(
				securityProviders.map((p) =>
					p.scanBranch(repoPath, branch).catch((err) => {
						debug(`security ${p.scanner} scanBranch failed: ${err}`)
						return null
					}),
				),
			)
			return results.flatMap((r) => r?.findings ?? [])
		})
	}

	function eligibleSignalEntries(scopeKey: string): SignalProviderEntry[] {
		return signalEntries.filter((entry) => {
			const ttlKey = `${entry.provider.source}:${scopeKey}`
			if (withinTtl(ttlKey, entry.minPollSeconds)) {
				debug(`signal ${entry.provider.source} ${scopeKey}: within TTL, skip`)
				return false
			}
			recordFetch(ttlKey)
			return true
		})
	}

	function fetchRepoSignals(repoPath: string): void {
		if (signalEntries.length === 0) return
		const eligible = eligibleSignalEntries(`repo:${repoPath}`)
		if (eligible.length === 0) return
		repoSignalCache.fetch(repoPath, async () => {
			const results = await Promise.all(
				eligible.map((entry) =>
					entry.provider.scanRepo(repoPath).catch((err) => {
						debug(`signal ${entry.provider.source} scanRepo failed: ${err}`)
						return null
					}),
				),
			)
			const fresh = results.flatMap((r) => r?.signals ?? [])
			const sourcesFetched = new Set(eligible.map((e) => e.provider.source))
			const carry = repoSignalCache.get(repoPath).filter((s) => !sourcesFetched.has(s.source))
			return [...carry, ...fresh]
		})
	}

	function fetchBranchSignals(repoPath: string, branch: string): void {
		if (signalEntries.length === 0) return
		const cacheKey = branchKey(repoPath, branch)
		const eligible = eligibleSignalEntries(`branch:${cacheKey}`)
		if (eligible.length === 0) return
		branchSignalCache.fetch(cacheKey, async () => {
			const results = await Promise.all(
				eligible.map((entry) =>
					entry.provider.scanBranch(repoPath, branch).catch((err) => {
						debug(`signal ${entry.provider.source} scanBranch failed: ${err}`)
						return null
					}),
				),
			)
			const fresh = results.flatMap((r) => r?.signals ?? [])
			const sourcesFetched = new Set(eligible.map((e) => e.provider.source))
			const carry = branchSignalCache.get(cacheKey).filter((s) => !sourcesFetched.has(s.source))
			return [...carry, ...fresh]
		})
	}

	async function refreshAll(): Promise<void> {
		fetchReviewRequests()
		fetchMyOpenPRs()
		const seen = new Set<string>()
		debug(`refreshAll: ${store.epics.length} epics`)
		for (const epic of store.epics) {
			for (const story of epic.stories) {
				if (story.ticket && !seen.has(story.ticket)) {
					seen.add(story.ticket)
					debug(`fetching ticket: ${story.ticket}`)
					fetchTicket(story.ticket)
				}
				for (const repo of story.repositories) {
					if (securityProviders.length > 0) fetchRepoSecurity(repo.path)
					if (signalEntries.length > 0) fetchRepoSignals(repo.path)
					if (git) {
						const remote = await getRemoteUrl(repo.path)
						const slug = parseRepoSlug(remote)
						for (const branch of repo.branches) {
							if (slug) {
								fetchPRs(repo.path, branch.name, slug)
								fetchPipeline(repo.path, branch.name, slug)
							}
							if (securityProviders.length > 0) fetchBranchSecurity(repo.path, branch.name)
							if (signalEntries.length > 0) fetchBranchSignals(repo.path, branch.name)
						}
					} else {
						for (const branch of repo.branches) {
							if (securityProviders.length > 0) fetchBranchSecurity(repo.path, branch.name)
							if (signalEntries.length > 0) fetchBranchSignals(repo.path, branch.name)
						}
					}
				}
			}
		}
	}

	const state: IntegrationsState = {
		git,
		tickets,
		securityProviders,
		signalProviders,
		gitFor,
		getTicket: (key) => ticketCache.get(key),
		getPRs: (repoPath, branch) => prCache.get(branchKey(repoPath, branch)),
		getPipeline: (repoPath, branch) => pipelineCache.get(branchKey(repoPath, branch)),
		getLinkedIssues: (repoPath, branch) => linkedIssueCache.get(branchKey(repoPath, branch)),
		getReviewRequests: () => reviewRequestCache.get("me"),
		getMyOpenPRs: () => myOpenPRsCache.get("me"),
		getRepoFindings: (repoPath) => repoSecurityCache.get(repoPath),
		getBranchFindings: (repoPath, branch) => branchSecurityCache.get(branchKey(repoPath, branch)),
		getRepoSignals: (repoPath) => repoSignalCache.get(repoPath),
		getBranchSignals: (repoPath, branch) => branchSignalCache.get(branchKey(repoPath, branch)),
		hasOpenPR: (repoPath, branch) =>
			prCache.get(branchKey(repoPath, branch)).some((pr) => PR_OPEN_STATES.has(pr.state)),
		fetchTicket,
		fetchPRs,
		fetchPipeline,
		fetchReviewRequests,
		fetchMyOpenPRs,
		fetchRepoSecurity,
		fetchBranchSecurity,
		fetchRepoSignals,
		fetchBranchSignals,
		refreshAll,
	}

	createEffect(
		on(
			() => store.epics.length,
			() => {
				debug(`effect: store.epics.length=${store.epics.length}`)
				if (store.epics.length > 0) refreshAll()
			},
		),
	)

	return state
}

export function useIntegrations() {
	return useAppStore().integrations
}

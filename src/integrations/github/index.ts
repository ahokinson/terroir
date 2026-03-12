import { parseEnum } from "@db/types"
import {
	type GitIntegration,
	type LinkedIssue,
	type Pipeline,
	PipelineStatus,
	PRState,
	type PullRequest,
	type ReviewComment,
} from "@integrations/types"
import { exec, execJson } from "@lib/cli"

const CLI = "gh"

function normalizePipelineStatus(raw: string): PipelineStatus {
	const s = raw.toLowerCase()
	if (s === "in_progress") return PipelineStatus.Running
	if (s === "queued") return PipelineStatus.Pending
	if (s === "cancelled") return PipelineStatus.Canceled
	if (s === "completed") return PipelineStatus.Success
	return parseEnum(PipelineStatus, s, PipelineStatus.Pending)
}

interface GhPR {
	number: number
	title: string
	state: string
	url: string
	author: { login: string }
	isDraft: boolean
	createdAt: string
	updatedAt: string
	body: string
	reviewRequests: { login?: string; slug?: string; name?: string }[]
}

interface GhRun {
	databaseId: number
	status: string
	conclusion: string
	url: string
	headBranch: string
	createdAt: string
}

interface GhTimelineEvent {
	event: string
	source?: {
		issue?: {
			number: number
			title: string
			state: string
			html_url: string
			pull_request?: unknown
		}
	}
}

interface GhReviewComment {
	id: number
	user: { login: string }
	body: string
	path: string | null
	line: number | null
	created_at: string
}

interface GhJob {
	name: string
	conclusion: string
	steps: { name: string; conclusion: string }[]
}

interface GhSearchPR {
	number: number
	title: string
	state: string
	url: string
	author: { login: string }
	isDraft: boolean
	createdAt: string
	updatedAt: string
	body: string
	repository: { nameWithOwner: string }
}

const PR_FIELDS = "number,title,state,url,author,isDraft,createdAt,updatedAt,body,reviewRequests"

function mapPR(pr: GhPR): PullRequest {
	return {
		id: pr.number,
		title: pr.title,
		state: parseEnum(PRState, pr.state.toLowerCase(), PRState.Closed),
		url: pr.url,
		author: pr.author.login,
		draft: pr.isDraft,
		approvals: 0,
		createdAt: pr.createdAt,
		updatedAt: pr.updatedAt,
		body: pr.body,
		requestedReviewers: pr.reviewRequests
			.map((r) => r.login ?? r.slug ?? r.name ?? "")
			.filter(Boolean),
	}
}

export function createGitHubIntegration(): GitIntegration {
	let cachedUser: { username: string } | null = null
	let userFetched = false

	const gh = (args: string[]) => exec(CLI, args)
	const ghJson = <T>(args: string[]) => execJson<T>(CLI, args)

	async function currentUser(): Promise<{ username: string } | null> {
		if (userFetched) return cachedUser
		userFetched = true
		try {
			const u = await ghJson<{ login: string }>(["api", "user"])
			cachedUser = { username: u.login }
		} catch {
			cachedUser = null
		}
		return cachedUser
	}

	async function prsForBranch(slug: string, branch: string): Promise<PullRequest[]> {
		const prs = await ghJson<GhPR[]>([
			"pr",
			"list",
			"--repo",
			slug,
			"--head",
			branch,
			"--state",
			"all",
			"--json",
			PR_FIELDS,
		])
		return prs.map(mapPR)
	}

	async function pipelineForBranch(slug: string, branch: string): Promise<Pipeline | null> {
		const runs = await ghJson<GhRun[]>([
			"run",
			"list",
			"--repo",
			slug,
			"--branch",
			branch,
			"--limit",
			"1",
			"--json",
			"databaseId,status,conclusion,url,headBranch,createdAt",
		])
		if (runs.length === 0) return null
		const run = runs[0]
		return {
			id: run.databaseId,
			status: normalizePipelineStatus(run.conclusion || run.status),
			url: run.url,
			ref: run.headBranch,
			createdAt: run.createdAt,
		}
	}

	async function linkedIssues(slug: string, prId: number): Promise<LinkedIssue[]> {
		const raw = await gh(["api", `repos/${slug}/issues/${prId}/timeline`, "--paginate"])

		let events: GhTimelineEvent[]
		try {
			events = JSON.parse(raw)
		} catch {
			return []
		}

		const issues: LinkedIssue[] = []
		const seen = new Set<number>()

		for (const ev of events) {
			if (ev.event === "cross-referenced" && ev.source?.issue && !ev.source.issue.pull_request) {
				const issue = ev.source.issue
				if (seen.has(issue.number)) continue
				seen.add(issue.number)
				issues.push({
					key: `#${issue.number}`,
					title: issue.title,
					status: issue.state,
					url: issue.html_url,
				})
			}
		}

		return issues
	}

	async function userPRs(slug: string): Promise<PullRequest[]> {
		const prs = await ghJson<GhPR[]>([
			"pr",
			"list",
			"--repo",
			slug,
			"--state",
			"open",
			"--author",
			"@me",
			"--json",
			PR_FIELDS,
		])
		return prs.map(mapPR)
	}

	async function reviewComments(slug: string, prId: number): Promise<ReviewComment[]> {
		const comments = await ghJson<GhReviewComment[]>([
			"api",
			`repos/${slug}/pulls/${prId}/comments`,
			"--paginate",
		])
		return comments.map((c) => ({
			id: c.id,
			author: c.user.login,
			body: c.body,
			path: c.path,
			line: c.line,
			createdAt: c.created_at,
		}))
	}

	async function listMyOpenPRs(): Promise<PullRequest[]> {
		const prs = await ghJson<GhSearchPR[]>([
			"search",
			"prs",
			"--author",
			"@me",
			"--state",
			"open",
			"--limit",
			"50",
			"--json",
			"number,title,state,url,author,isDraft,createdAt,updatedAt,body,repository",
		])
		return prs.map((pr) => ({
			id: pr.number,
			title: pr.title,
			state: parseEnum(PRState, pr.state.toLowerCase(), PRState.Closed),
			url: pr.url,
			author: pr.author.login,
			draft: pr.isDraft,
			approvals: 0,
			createdAt: pr.createdAt,
			updatedAt: pr.updatedAt,
			body: pr.body,
			requestedReviewers: [],
			repoSlug: pr.repository.nameWithOwner,
		}))
	}

	async function listMrsForReview(): Promise<PullRequest[]> {
		const prs = await ghJson<GhSearchPR[]>([
			"search",
			"prs",
			"--review-requested",
			"@me",
			"--state",
			"open",
			"--limit",
			"50",
			"--json",
			"number,title,state,url,author,isDraft,createdAt,updatedAt,body,repository",
		])
		return prs.map((pr) => ({
			id: pr.number,
			title: pr.title,
			state: parseEnum(PRState, pr.state.toLowerCase(), PRState.Closed),
			url: pr.url,
			author: pr.author.login,
			draft: pr.isDraft,
			approvals: 0,
			createdAt: pr.createdAt,
			updatedAt: pr.updatedAt,
			body: pr.body,
			requestedReviewers: [],
			repoSlug: pr.repository.nameWithOwner,
		}))
	}

	async function ciFailureSummary(slug: string, runId: number): Promise<string> {
		const result = await ghJson<{ jobs: GhJob[] }>([
			"run",
			"view",
			String(runId),
			"--repo",
			slug,
			"--json",
			"jobs",
		])

		const failures: string[] = []
		for (const job of result.jobs) {
			if (job.conclusion === PipelineStatus.Failure) {
				const failedSteps =
					job.steps?.filter((s) => s.conclusion === PipelineStatus.Failure).map((s) => s.name) ?? []
				if (failedSteps.length > 0) {
					failures.push(`${job.name}: ${failedSteps.join(", ")}`)
				} else {
					failures.push(job.name)
				}
			}
		}

		return failures.join("; ") || "Unknown failure"
	}

	return {
		currentUser,
		prsForBranch,
		pipelineForBranch,
		linkedIssues,
		userPRs,
		reviewComments,
		listAssignedIssues: async () => [],
		listMrsForReview,
		listMyOpenPRs,
		ciFailureSummary,
	}
}

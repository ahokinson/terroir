import { parseEnum } from "@db/types"
import {
	type GitIntegration,
	type LinkedIssue,
	type Pipeline,
	PipelineStatus,
	PRState,
	type PullRequest,
	type RemoteIssue,
} from "@integrations/types"
import { exec, execJson } from "@lib/cli"

const CLI = "glab"

interface GlabMR {
	iid: number
	title: string
	state: string
	web_url: string
	author: { username: string } | null
	draft: boolean
	created_at: string
	updated_at: string
	description: string | null
	reviewers: { username: string }[]
	references?: { full?: string }
}

interface GlabPipeline {
	id: number
	status: string
	web_url: string
	ref: string
	created_at: string
}

interface GlabIssue {
	iid: number
	title: string
	state: string
	web_url: string
	description?: string | null
	assignees?: { username: string }[]
	labels?: string[]
	references?: { full?: string }
	project_id?: number
}

interface GlabUser {
	username: string
	id: number
}

function encode(slug: string): string {
	return encodeURIComponent(slug)
}

function mapMR(mr: GlabMR): PullRequest {
	return {
		id: mr.iid,
		title: mr.title,
		state: parseEnum(PRState, mr.state, PRState.Closed),
		url: mr.web_url,
		author: mr.author?.username ?? "",
		draft: mr.draft ?? false,
		approvals: 0,
		createdAt: mr.created_at,
		updatedAt: mr.updated_at,
		body: mr.description ?? "",
		requestedReviewers: mr.reviewers?.map((r) => r.username) ?? [],
	}
}

export function createGitLabIntegration(): GitIntegration {
	let cachedUser: { username: string } | null = null
	let userFetched = false

	const glabJson = <T>(args: string[]) => execJson<T>(CLI, args)
	const api = <T>(path: string): Promise<T> => glabJson<T>(["api", path])

	async function currentUser(): Promise<{ username: string } | null> {
		if (userFetched) return cachedUser
		userFetched = true
		try {
			const u = await api<GlabUser>("/user")
			cachedUser = { username: u.username }
		} catch {
			cachedUser = null
		}
		return cachedUser
	}

	async function prsForBranch(slug: string, branch: string): Promise<PullRequest[]> {
		const mrs = await api<GlabMR[]>(
			`/projects/${encode(slug)}/merge_requests?source_branch=${encodeURIComponent(branch)}&state=opened`,
		)
		return mrs.map(mapMR)
	}

	async function pipelineForBranch(slug: string, branch: string): Promise<Pipeline | null> {
		const pipelines = await api<GlabPipeline[]>(
			`/projects/${encode(slug)}/pipelines?ref=${encodeURIComponent(branch)}&per_page=1`,
		)
		if (pipelines.length === 0) return null
		const p = pipelines[0]
		return {
			id: p.id,
			status: parseEnum(PipelineStatus, p.status.toLowerCase(), PipelineStatus.Pending),
			url: p.web_url,
			ref: p.ref,
			createdAt: p.created_at,
		}
	}

	async function linkedIssues(slug: string, prId: number): Promise<LinkedIssue[]> {
		try {
			const issues = await api<GlabIssue[]>(
				`/projects/${encode(slug)}/merge_requests/${prId}/closes_issues`,
			)
			return issues.map(
				(i): LinkedIssue => ({
					key: `#${i.iid}`,
					title: i.title,
					status: i.state,
					url: i.web_url,
				}),
			)
		} catch {
			return []
		}
	}

	async function userPRs(slug: string): Promise<PullRequest[]> {
		const mrs = await api<GlabMR[]>(
			`/projects/${encode(slug)}/merge_requests?state=opened&scope=created_by_me`,
		)
		return mrs.map(mapMR)
	}

	async function listAssignedIssues(): Promise<RemoteIssue[]> {
		const user = await currentUser()
		if (!user) return []
		const issues = await api<GlabIssue[]>(`/issues?scope=assigned_to_me&state=opened&per_page=50`)
		return issues.map(
			(i): RemoteIssue => ({
				key: i.references?.full ?? `#${i.iid}`,
				title: i.title,
				state: i.state,
				url: i.web_url,
				body: i.description ?? "",
				assignee: i.assignees?.[0]?.username ?? null,
				labels: i.labels ?? [],
				projectPath: i.references?.full?.split("#")[0] ?? "",
			}),
		)
	}

	async function listMyOpenPRs(): Promise<PullRequest[]> {
		const user = await currentUser()
		if (!user) return []
		const mrs = await api<GlabMR[]>(`/merge_requests?scope=created_by_me&state=opened&per_page=50`)
		return mrs.map((mr) => ({
			...mapMR(mr),
			repoSlug: mr.references?.full?.split("!")[0],
		}))
	}

	async function listMrsForReview(): Promise<PullRequest[]> {
		const user = await currentUser()
		if (!user) return []
		const mrs = await api<GlabMR[]>(
			`/merge_requests?reviewer_username=${encodeURIComponent(user.username)}&state=opened&per_page=50`,
		)
		return mrs.map((mr) => ({
			...mapMR(mr),
			repoSlug: mr.references?.full?.split("!")[0],
		}))
	}

	return {
		currentUser,
		prsForBranch,
		pipelineForBranch,
		linkedIssues,
		userPRs,
		reviewComments: async () => [],
		listAssignedIssues,
		listMrsForReview,
		listMyOpenPRs,
		ciFailureSummary: async () => "Unknown failure",
	}
}

import type { TicketIntegration, TicketIssue, TicketTransition } from "@integrations/types"
import { exec, execJson } from "@lib/cli"

const CLI = "gh"

interface GitHubIssuesConfig {
	repo: string
	labels?: string[]
}

interface GhIssue {
	number: number
	title: string
	state: string
	url: string
	body: string
	assignees: { login: string }[]
	labels: { name: string }[]
}

function mapIssue(i: GhIssue): TicketIssue {
	return {
		key: `#${i.number}`,
		summary: i.title,
		description: i.body ?? "",
		status: i.state,
		type: i.labels.map((l) => l.name).join(", "),
		epic: "",
		assignee: i.assignees[0]?.login ?? null,
		url: i.url,
	}
}

export function createGitHubIssuesIntegration(config: GitHubIssuesConfig): TicketIntegration {
	const { repo, labels = [] } = config
	const transitionCache = new Map<string, TicketTransition[]>()

	const gh = (args: string[]) => exec(CLI, args)
	const ghJson = <T>(args: string[]) => execJson<T>(CLI, args)

	async function search(): Promise<TicketIssue[]> {
		const args = [
			"issue",
			"list",
			"--repo",
			repo,
			"--state",
			"open",
			"--limit",
			"50",
			"--json",
			"number,title,state,url,body,assignees,labels",
		]
		for (const label of labels) args.push("--label", label)

		const issues = await ghJson<GhIssue[]>(args)
		return issues.map(mapIssue)
	}

	async function getIssue(key: string): Promise<TicketIssue | null> {
		const num = key.replace("#", "")
		try {
			const issue = await ghJson<GhIssue>([
				"issue",
				"view",
				num,
				"--repo",
				repo,
				"--json",
				"number,title,state,url,body,assignees,labels",
			])
			return mapIssue(issue)
		} catch {
			return null
		}
	}

	async function getTransitions(key: string): Promise<TicketTransition[]> {
		const cached = transitionCache.get(key)
		if (cached) return cached
		transitionCache.set(key, [])
		return []
	}

	async function addComment(key: string, body: string): Promise<void> {
		const num = key.replace("#", "")
		await gh(["issue", "comment", num, "--repo", repo, "--body", body])
	}

	async function updateDescription(key: string, body: string): Promise<void> {
		const num = key.replace("#", "")
		await gh(["issue", "edit", num, "--repo", repo, "--body", body])
	}

	async function assignToMe(key: string): Promise<void> {
		const num = key.replace("#", "")
		await gh(["issue", "edit", num, "--repo", repo, "--add-assignee", "@me"])
	}

	return {
		search,
		getIssue,
		getTransitions,
		transitionIssue: async () => {},
		addComment,
		updateDescription,
		assignToMe,
	}
}

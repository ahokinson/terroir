import type { TicketIntegration, TicketIssue, TicketTransition } from "@integrations/types"
import { exec, execJson } from "@lib/cli"

const CLI = "acli"
const DEFAULT_JQL = "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC"

interface JiraConfig {
	jql?: string
}

interface AcliIssue {
	key: string
	summary: string
	status: string
	type: string
	assignee: string
	parent: string
}

interface AcliTransition {
	id: string
	name: string
}

function mapIssue(i: AcliIssue): TicketIssue {
	return {
		key: i.key,
		summary: i.summary,
		description: "",
		status: i.status,
		type: i.type,
		epic: i.parent ?? "",
		assignee: i.assignee || null,
		url: "",
	}
}

export function createJiraIntegration(config: JiraConfig = {}): TicketIntegration {
	const jql = config.jql ?? DEFAULT_JQL
	const transitionCache = new Map<string, TicketTransition[]>()

	const acli = (args: string[]) => exec(CLI, ["jira", ...args])
	const acliJson = <T>(args: string[]) => execJson<T>(CLI, ["jira", ...args])

	async function search(): Promise<TicketIssue[]> {
		const issues = await acliJson<AcliIssue[]>([
			"--action",
			"getIssueList",
			"--jql",
			jql,
			"--outputFormat",
			"2",
		])
		return issues.map(mapIssue)
	}

	async function getIssue(key: string): Promise<TicketIssue | null> {
		try {
			const issue = await acliJson<AcliIssue>([
				"--action",
				"getIssue",
				"--issue",
				key,
				"--outputFormat",
				"2",
			])
			return mapIssue(issue)
		} catch {
			return null
		}
	}

	async function getTransitions(key: string): Promise<TicketTransition[]> {
		const cached = transitionCache.get(key)
		if (cached) return cached
		const transitions = await acliJson<AcliTransition[]>([
			"--action",
			"getTransitionList",
			"--issue",
			key,
			"--outputFormat",
			"2",
		])
		const mapped = transitions.map((t) => ({ id: t.id, name: t.name }))
		transitionCache.set(key, mapped)
		return mapped
	}

	async function transitionIssue(key: string, transitionId: string): Promise<void> {
		await acli(["--action", "transitionIssue", "--issue", key, "--transition", transitionId])
	}

	async function addComment(key: string, body: string): Promise<void> {
		await acli(["--action", "addComment", "--issue", key, "--comment", body])
	}

	async function updateDescription(key: string, body: string): Promise<void> {
		await acli(["--action", "editIssue", "--issue", key, "--description", body])
	}

	async function assignToMe(key: string): Promise<void> {
		await acli(["--action", "assignIssue", "--issue", key, "--assignee", "currentUser()"])
	}

	return {
		search,
		getIssue,
		getTransitions,
		transitionIssue,
		addComment,
		updateDescription,
		assignToMe,
	}
}

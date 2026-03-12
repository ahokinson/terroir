import { GitRepo } from "@integrations/git/client"
import { captureStdout, parseJson, pickArray } from "@integrations/providers/parsing"
import { errorResult, successResult } from "@integrations/providers/security-result"
import type {
	SecurityFinding,
	SecurityIntegration,
	SecurityScanResult,
	Severity,
} from "@integrations/types"
import { parseRepoSlug, SecurityScanner, Severity as Sev } from "@integrations/types"
import { exec } from "@lib/cli"

const CLI = "aikido-api-client"
const SCAN_TIMEOUT_MS = 180_000

interface AikidoIssue {
	id?: string | number
	issue_id?: string | number
	rule_id?: string | number
	severity?: string
	severity_score?: number
	title?: string
	name?: string
	message?: string
	file?: string
	path?: string
	location?: string
	line?: number
	url?: string
	link?: string
}

export interface AikidoConfig {
	apiKey: string
}

function normalizeSeverity(raw: unknown): Severity {
	if (typeof raw === "number") {
		if (raw >= 4) return Sev.Critical
		if (raw === 3) return Sev.High
		if (raw === 2) return Sev.Medium
		if (raw === 1) return Sev.Low
		return Sev.Info
	}
	const s = String(raw ?? "").toLowerCase()
	if (s.startsWith("crit")) return Sev.Critical
	if (s === "high") return Sev.High
	if (s === "medium" || s === "moderate") return Sev.Medium
	if (s === "low") return Sev.Low
	return Sev.Info
}

function extractIssues(payload: unknown): AikidoIssue[] {
	return pickArray<AikidoIssue>(payload, ["new_issues", "open_issues", "issues", "findings"])
}

function issueKey(issue: AikidoIssue, fallbackIdx: number): string {
	const id = issue.id ?? issue.issue_id ?? issue.rule_id
	if (id !== undefined) return `aikido:${id}`
	const loc = issue.location ?? issue.file ?? issue.path ?? ""
	const title = issue.title ?? issue.name ?? issue.message ?? ""
	if (loc || title) return `aikido:${title}:${loc}`
	return `aikido:idx:${fallbackIdx}`
}

function mapIssue(
	issue: AikidoIssue,
	repoPath: string,
	branch: string | null,
	idx: number,
): SecurityFinding {
	const sev = normalizeSeverity(issue.severity ?? issue.severity_score)
	const title = issue.title ?? issue.name ?? issue.message ?? "(untitled finding)"
	const file = issue.file ?? issue.path ?? issue.location ?? null
	const loc = file && issue.line !== undefined ? `${file}:${issue.line}` : file
	return {
		id: issueKey(issue, idx),
		scanner: SecurityScanner.Aikido,
		severity: sev,
		title,
		location: loc,
		url: issue.url ?? issue.link ?? null,
		repoPath,
		branch,
	}
}

export function createAikidoIntegration(config: AikidoConfig): SecurityIntegration {
	const scanner = SecurityScanner.Aikido

	async function runScan(args: string[]): Promise<string> {
		process.env.AIKIDO_API_KEY = config.apiKey
		return exec(CLI, args, { timeout: SCAN_TIMEOUT_MS })
	}

	async function resolveRepoRef(repoPath: string): Promise<string | null> {
		const remote = await new GitRepo(repoPath).remoteUrl()
		if (!remote) return null
		return parseRepoSlug(remote)
	}

	async function scanRepo(repoPath: string): Promise<SecurityScanResult> {
		const ref = await resolveRepoRef(repoPath)
		if (!ref) return errorResult(scanner, repoPath, null, new Error("no repo slug"))

		const head = await new GitRepo(repoPath).revParse("HEAD")
		if (!head) return errorResult(scanner, repoPath, null, new Error("no HEAD commit"))

		let stdout = ""
		try {
			stdout = await runScan(["scan-release", ref, head])
		} catch (err) {
			const salvaged = captureStdout(err)
			if (salvaged === null) return errorResult(scanner, repoPath, null, err)
			stdout = salvaged
		}

		const issues = parseJson(stdout, extractIssues)
		return successResult(
			scanner,
			repoPath,
			null,
			issues.map((i, idx) => mapIssue(i, repoPath, null, idx)),
		)
	}

	async function scanBranch(repoPath: string, branch: string): Promise<SecurityScanResult> {
		const ref = await resolveRepoRef(repoPath)
		if (!ref) return errorResult(scanner, repoPath, branch, new Error("no repo slug"))

		const repo = new GitRepo(repoPath)
		const base = await repo.defaultBase()
		const baseSha = await repo.mergeBase(base, branch)
		const headSha = await repo.revParse(branch)
		if (!baseSha || !headSha) {
			return errorResult(scanner, repoPath, branch, new Error("unable to resolve commits"))
		}

		let stdout = ""
		try {
			stdout = await runScan(["scan", ref, baseSha, headSha, branch])
		} catch (err) {
			const salvaged = captureStdout(err)
			if (salvaged === null) return errorResult(scanner, repoPath, branch, err)
			stdout = salvaged
		}

		const issues = parseJson(stdout, extractIssues)
		return successResult(
			scanner,
			repoPath,
			branch,
			issues.map((i, idx) => mapIssue(i, repoPath, branch, idx)),
		)
	}

	return { scanner, scanRepo, scanBranch }
}

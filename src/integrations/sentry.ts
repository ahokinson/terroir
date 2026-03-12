import { GitRepo, repoName } from "@integrations/git/client"
import { pickArray } from "@integrations/providers/parsing"
import { createBackoff } from "@integrations/providers/signal-rate-limit"
import {
	capBySeverity,
	errorResult,
	successResult,
	unconfiguredResult,
} from "@integrations/providers/signal-result"
import type { Severity, Signal, SignalProvider, SignalScanResult } from "@integrations/types"
import { Severity as Sev, SignalKind, SignalSource } from "@integrations/types"
import { debug } from "@lib/log"

const SENTRY_BASE = "https://sentry.io"
const SENTRY_MAX_PER_SEC = 40
const TOP_N = 20
const REQUEST_TIMEOUT_MS = 30_000

interface SentryIssue {
	id: string
	shortId?: string
	title?: string
	culprit?: string
	level?: string
	count?: string | number
	firstSeen?: string
	lastSeen?: string
	permalink?: string
}

export interface SentryConfig {
	apiToken: string
	organization: string
	projectMap?: Record<string, string>
	baseUrl?: string
	maxPerSec?: number
}

function levelToSeverity(level: string | undefined): Severity {
	switch ((level ?? "").toLowerCase()) {
		case "fatal":
			return Sev.Critical
		case "error":
			return Sev.High
		case "warning":
			return Sev.Medium
		case "info":
			return Sev.Low
		default:
			return Sev.Info
	}
}

function toEpoch(iso: string | undefined, fallback: number): number {
	if (!iso) return fallback
	const t = Date.parse(iso)
	return Number.isNaN(t) ? fallback : t
}

function mapIssue(issue: SentryIssue, repoPath: string, branch: string | null): Signal {
	const now = Date.now()
	const firstSeen = toEpoch(issue.firstSeen, now)
	const lastSeen = toEpoch(issue.lastSeen, firstSeen)
	const count =
		typeof issue.count === "number" ? issue.count : parseInt(issue.count ?? "0", 10) || 0
	const title = issue.title ?? issue.culprit ?? "(untitled sentry issue)"
	return {
		id: `sentry:${issue.id}`,
		source: SignalSource.Sentry,
		kind: SignalKind.RuntimeError,
		severity: levelToSeverity(issue.level),
		title,
		url: issue.permalink ?? null,
		repoPath,
		branch,
		count,
		firstSeen,
		lastSeen,
	}
}

export function createSentryIntegration(config: SentryConfig): SignalProvider {
	const source = SignalSource.Sentry
	const base = (config.baseUrl ?? SENTRY_BASE).replace(/\/$/, "")
	const backoff = createBackoff({
		maxPerSec: config.maxPerSec ?? SENTRY_MAX_PER_SEC,
	})

	function projectSlug(repoPath: string): string {
		return config.projectMap?.[repoPath] ?? repoName(repoPath)
	}

	async function request(path: string): Promise<SentryIssue[]> {
		await backoff.acquire()
		const ctrl = new AbortController()
		const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
		try {
			const res = await fetch(`${base}${path}`, {
				headers: { Authorization: `Bearer ${config.apiToken}` },
				signal: ctrl.signal,
			})
			if (res.status === 429) {
				const retryAfter = parseInt(res.headers.get("retry-after") ?? "1", 10) || 1
				backoff.onRetryAfter(retryAfter)
				throw new Error(`sentry rate limited; retry-after ${retryAfter}s`)
			}
			if (!res.ok) {
				throw new Error(`sentry HTTP ${res.status}: ${await res.text()}`)
			}
			return pickArray<SentryIssue>(await res.json(), ["data"])
		} finally {
			clearTimeout(timer)
		}
	}

	function buildPath(slug: string, query: string): string {
		const params = new URLSearchParams({ query, limit: String(TOP_N) })
		return `/api/0/projects/${encodeURIComponent(config.organization)}/${encodeURIComponent(slug)}/issues/?${params.toString()}`
	}

	async function scanRepo(repoPath: string): Promise<SignalScanResult> {
		const slug = projectSlug(repoPath)
		try {
			const issues = await request(buildPath(slug, "is:unresolved"))
			const signals = capBySeverity(
				issues.map((i) => mapIssue(i, repoPath, null)),
				TOP_N,
			)
			return successResult(source, repoPath, null, signals)
		} catch (err) {
			debug(`sentry scanRepo ${repoPath} failed: ${err}`)
			return errorResult(source, repoPath, null, err)
		}
	}

	async function scanBranch(repoPath: string, branch: string): Promise<SignalScanResult> {
		const head = await new GitRepo(repoPath).revParse(branch)
		if (!head) {
			return unconfiguredResult(
				source,
				repoPath,
				branch,
				`unable to resolve HEAD sha for ${branch}; release:HEAD_SHA filter requires it`,
			)
		}

		const slug = projectSlug(repoPath)
		try {
			const issues = await request(buildPath(slug, `is:unresolved release:${head}`))
			const signals = capBySeverity(
				issues.map((i) => mapIssue(i, repoPath, branch)),
				TOP_N,
			)
			return successResult(source, repoPath, branch, signals)
		} catch (err) {
			debug(`sentry scanBranch ${repoPath}@${branch} failed: ${err}`)
			return errorResult(source, repoPath, branch, err)
		}
	}

	return { source, scanRepo, scanBranch }
}

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

const DATADOG_DEFAULT_SITE = "datadoghq.com"
const DATADOG_DEFAULT_MAX_PER_SEC = 10
const DATADOG_DEFAULT_MIN_POLL_SECONDS = 600
const TOP_N = 20
const REQUEST_TIMEOUT_MS = 30_000

interface DatadogErrorEvent {
	id?: string
	attributes?: {
		message?: string
		title?: string
		service?: string
		status?: string
		timestamp?: string
		first_seen?: string
		last_seen?: string
		occurrences?: number
		count?: number
		tags?: string[]
		url?: string
	}
}

export interface DatadogConfig {
	apiKey: string
	appKey: string
	site?: string
	projectMap?: Record<string, string>
	minPollSeconds?: number
	maxPerSec?: number
}

function statusToSeverity(status: string | undefined): Severity {
	switch ((status ?? "").toLowerCase()) {
		case "emergency":
		case "alert":
		case "critical":
			return Sev.Critical
		case "error":
			return Sev.High
		case "warning":
		case "warn":
			return Sev.Medium
		case "notice":
		case "info":
			return Sev.Low
		default:
			return Sev.High
	}
}

function toEpoch(iso: string | undefined, fallback: number): number {
	if (!iso) return fallback
	const t = Date.parse(iso)
	return Number.isNaN(t) ? fallback : t
}

function mapEvent(event: DatadogErrorEvent, repoPath: string, branch: string | null): Signal {
	const a = event.attributes ?? {}
	const now = Date.now()
	const firstSeen = toEpoch(a.first_seen ?? a.timestamp, now)
	const lastSeen = toEpoch(a.last_seen ?? a.timestamp, firstSeen)
	const count = a.occurrences ?? a.count ?? 1
	const title = a.title ?? a.message ?? "(untitled datadog event)"
	return {
		id: `datadog:${event.id ?? `${repoPath}:${title}`}`,
		source: SignalSource.Datadog,
		kind: SignalKind.RuntimeError,
		severity: statusToSeverity(a.status),
		title,
		url: a.url ?? null,
		repoPath,
		branch,
		count,
		firstSeen,
		lastSeen,
	}
}

export function createDatadogIntegration(config: DatadogConfig): SignalProvider {
	const source = SignalSource.Datadog
	const site = config.site ?? DATADOG_DEFAULT_SITE
	const base = `https://api.${site}`
	const backoff = createBackoff({
		maxPerSec: config.maxPerSec ?? DATADOG_DEFAULT_MAX_PER_SEC,
	})

	function serviceTag(repoPath: string): string {
		return config.projectMap?.[repoPath] ?? repoName(repoPath)
	}

	async function request(query: string): Promise<DatadogErrorEvent[]> {
		await backoff.acquire()
		const ctrl = new AbortController()
		const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
		try {
			const params = new URLSearchParams({
				"filter[query]": query,
				"page[limit]": String(TOP_N),
				sort: "-timestamp",
			})
			const res = await fetch(`${base}/api/v2/error-tracking/events?${params.toString()}`, {
				headers: {
					"DD-API-KEY": config.apiKey,
					"DD-APPLICATION-KEY": config.appKey,
					Accept: "application/json",
				},
				signal: ctrl.signal,
			})
			if (res.status === 429) {
				const retryAfter = parseInt(res.headers.get("retry-after") ?? "1", 10) || 1
				backoff.onRetryAfter(retryAfter)
				throw new Error(`datadog rate limited; retry-after ${retryAfter}s`)
			}
			if (!res.ok) {
				throw new Error(`datadog HTTP ${res.status}: ${await res.text()}`)
			}
			return pickArray<DatadogErrorEvent>(await res.json(), ["data"])
		} finally {
			clearTimeout(timer)
		}
	}

	async function scanRepo(repoPath: string): Promise<SignalScanResult> {
		const service = serviceTag(repoPath)
		try {
			const events = await request(`service:${service}`)
			const signals = capBySeverity(
				events.map((e) => mapEvent(e, repoPath, null)),
				TOP_N,
			)
			return successResult(source, repoPath, null, signals)
		} catch (err) {
			debug(`datadog scanRepo ${repoPath} failed: ${err}`)
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
				`unable to resolve HEAD sha for ${branch}; version:HEAD_SHA filter requires it`,
			)
		}

		const service = serviceTag(repoPath)
		try {
			const events = await request(`service:${service} version:${head}`)
			const signals = capBySeverity(
				events.map((e) => mapEvent(e, repoPath, branch)),
				TOP_N,
			)
			return successResult(source, repoPath, branch, signals)
		} catch (err) {
			debug(`datadog scanBranch ${repoPath}@${branch} failed: ${err}`)
			return errorResult(source, repoPath, branch, err)
		}
	}

	return { source, scanRepo, scanBranch }
}

export function datadogMinPollSeconds(config: DatadogConfig): number {
	return config.minPollSeconds ?? DATADOG_DEFAULT_MIN_POLL_SECONDS
}

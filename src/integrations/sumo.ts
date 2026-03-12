import { captureStdout, parseJson, pickArray } from "@integrations/providers/parsing"
import { errorResult, successResult } from "@integrations/providers/security-result"
import type {
	SecurityFinding,
	SecurityIntegration,
	SecurityScanResult,
	Severity,
} from "@integrations/types"
import { ScanStatus, SecurityScanner, Severity as Sev } from "@integrations/types"
import { exec } from "@lib/cli"
import { debug } from "@lib/log"

const CLI = "sumocli"
const SCAN_TIMEOUT_MS = 120_000
const DEFAULT_RESULT_LIMIT = 100

interface SumoRecord {
	_raw?: string
	_messagetime?: string
	message?: string
	severity?: string
	level?: string
	[k: string]: unknown
}

export interface SumoConfig {
	repoQueries: Record<string, string>
	resultLimit?: number
}

function normalizeSeverity(raw: unknown): Severity {
	const s = String(raw ?? "").toLowerCase()
	if (s === "critical" || s === "fatal" || s === "emergency" || s === "alert") return Sev.Critical
	if (s === "high" || s === "error" || s === "err") return Sev.High
	if (s === "medium" || s === "warn" || s === "warning") return Sev.Medium
	if (s === "low" || s === "notice") return Sev.Low
	return Sev.Info
}

function extractRecords(payload: unknown): SumoRecord[] {
	return pickArray<SumoRecord>(payload, ["messages", "records", "results"])
}

function mapRecord(
	rec: SumoRecord,
	repoPath: string,
	branch: string | null,
	idx: number,
): SecurityFinding {
	const sev = normalizeSeverity(rec.severity ?? rec.level)
	const title = String(rec.message ?? rec._raw ?? "(no message)").slice(0, 160)
	const ts = rec._messagetime ?? ""
	return {
		id: `sumo:${ts}:${idx}`,
		scanner: SecurityScanner.Sumo,
		severity: sev,
		title,
		location: ts || null,
		url: null,
		repoPath,
		branch,
	}
}

export function createSumoIntegration(config: SumoConfig): SecurityIntegration {
	const scanner = SecurityScanner.Sumo

	async function runSearch(query: string, limit: number): Promise<string> {
		return exec(CLI, ["search", "--query", query, "--limit", String(limit)], {
			timeout: SCAN_TIMEOUT_MS,
		})
	}

	async function runScan(repoPath: string, branch: string | null): Promise<SecurityScanResult> {
		const query = config.repoQueries[repoPath]
		if (!query) {
			return {
				scanner,
				repoPath,
				branch,
				findings: [],
				scannedAt: Date.now(),
				status: ScanStatus.Unconfigured,
			}
		}

		const limit = config.resultLimit ?? DEFAULT_RESULT_LIMIT

		let stdout = ""
		try {
			stdout = await runSearch(query, limit)
		} catch (err) {
			const salvaged = captureStdout(err)
			if (salvaged === null) {
				debug(`sumo: search failed: ${err instanceof Error ? err.message : String(err)}`)
				return errorResult(scanner, repoPath, branch, err)
			}
			stdout = salvaged
		}

		const records = parseJson(stdout, extractRecords)
		return successResult(
			scanner,
			repoPath,
			branch,
			records.map((r, i) => mapRecord(r, repoPath, branch, i)),
		)
	}

	return {
		scanner,
		scanRepo: (repoPath) => runScan(repoPath, null),
		scanBranch: (repoPath, branch) => runScan(repoPath, branch),
	}
}

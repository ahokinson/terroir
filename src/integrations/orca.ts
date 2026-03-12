import { captureStdout, parseJson, pickArray } from "@integrations/providers/parsing"
import type {
	SecurityFinding,
	SecurityIntegration,
	SecurityScanResult,
	Severity,
} from "@integrations/types"
import { ScanStatus, SecurityScanner, Severity as Sev } from "@integrations/types"
import { exec } from "@lib/cli"
import { debug, errMsg } from "@lib/log"

const CLI = "orca-cli"
const SCAN_TIMEOUT_MS = 240_000

enum OrcaSubcommand {
	IaC = "iac",
	Secret = "secret",
}

interface OrcaFinding {
	id?: string
	rule?: string
	check_id?: string
	severity?: string
	priority?: string
	title?: string
	description?: string
	file?: string
	path?: string
	file_path?: string
	line?: number
	line_number?: number
	url?: string
}

export interface OrcaConfig {
	apiToken: string
}

function normalizeSeverity(raw: unknown): Severity {
	const s = String(raw ?? "").toLowerCase()
	if (s === "critical" || s === "crit") return Sev.Critical
	if (s === "high") return Sev.High
	if (s === "medium" || s === "moderate") return Sev.Medium
	if (s === "low") return Sev.Low
	return Sev.Info
}

function extractFindings(payload: unknown): OrcaFinding[] {
	return pickArray<OrcaFinding>(payload, ["results", "findings", "violations", "secrets"])
}

function mapFinding(
	subcommand: OrcaSubcommand,
	finding: OrcaFinding,
	repoPath: string,
	branch: string | null,
	idx: number,
): SecurityFinding {
	const id = finding.id ?? finding.rule ?? finding.check_id ?? `${subcommand}:${idx}`
	const sev = normalizeSeverity(finding.severity ?? finding.priority)
	const title =
		finding.title ??
		finding.description ??
		`${subcommand === OrcaSubcommand.IaC ? "IaC violation" : "secret"}: ${finding.rule ?? finding.check_id ?? "unknown"}`
	const file = finding.file ?? finding.path ?? finding.file_path ?? null
	const line = finding.line ?? finding.line_number
	const loc = file && line !== undefined ? `${file}:${line}` : file
	return {
		id: `orca:${subcommand}:${id}`,
		scanner: SecurityScanner.Orca,
		severity: sev,
		title,
		location: loc,
		url: finding.url ?? null,
		repoPath,
		branch,
	}
}

export function createOrcaIntegration(config: OrcaConfig): SecurityIntegration {
	const scanner = SecurityScanner.Orca

	async function runSubcommand(subcommand: OrcaSubcommand, repoPath: string): Promise<string> {
		process.env.ORCA_API_TOKEN = config.apiToken
		return exec(CLI, [subcommand, "scan", repoPath, "--format", "json"], {
			timeout: SCAN_TIMEOUT_MS,
		})
	}

	async function runBoth(repoPath: string, branch: string | null): Promise<SecurityScanResult> {
		const subcommands: OrcaSubcommand[] = [OrcaSubcommand.IaC, OrcaSubcommand.Secret]
		const all: SecurityFinding[] = []
		const errors: string[] = []

		for (const sub of subcommands) {
			let stdout = ""
			try {
				stdout = await runSubcommand(sub, repoPath)
			} catch (err) {
				const salvaged = captureStdout(err)
				if (salvaged === null) {
					const msg = errMsg(err)
					debug(`orca: ${sub} scan failed: ${msg}`)
					errors.push(`${sub}: ${msg}`)
					continue
				}
				stdout = salvaged
			}
			const findings = parseJson(stdout, extractFindings)
			for (let i = 0; i < findings.length; i++) {
				all.push(mapFinding(sub, findings[i], repoPath, branch, i))
			}
		}

		return {
			scanner,
			repoPath,
			branch,
			findings: all,
			scannedAt: Date.now(),
			status: errors.length === subcommands.length ? ScanStatus.Error : ScanStatus.Ok,
			error: errors.length > 0 ? errors.join("; ") : undefined,
		}
	}

	return {
		scanner,
		scanRepo: (repoPath) => runBoth(repoPath, null),
		scanBranch: (repoPath, branch) => runBoth(repoPath, branch),
	}
}

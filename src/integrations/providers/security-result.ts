import type { SecurityFinding, SecurityScanner, SecurityScanResult } from "@integrations/types"
import { ScanStatus } from "@integrations/types"
import { debug, errMsg } from "@lib/log"

export function errorResult(
	scanner: SecurityScanner,
	repoPath: string,
	branch: string | null,
	err: unknown,
): SecurityScanResult {
	const msg = errMsg(err)
	debug(`${scanner}: scan failed: ${msg}`)
	return {
		scanner,
		repoPath,
		branch,
		findings: [],
		scannedAt: Date.now(),
		status: ScanStatus.Error,
		error: msg,
	}
}

export function successResult(
	scanner: SecurityScanner,
	repoPath: string,
	branch: string | null,
	findings: SecurityFinding[],
): SecurityScanResult {
	return {
		scanner,
		repoPath,
		branch,
		findings,
		scannedAt: Date.now(),
		status: ScanStatus.Ok,
	}
}

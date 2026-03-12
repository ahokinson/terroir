import type { Signal, SignalScanResult, SignalSource } from "@integrations/types"
import { SignalStatus } from "@integrations/types"
import { debug, errMsg } from "@lib/log"

export function errorResult(
	source: SignalSource,
	repoPath: string,
	branch: string | null,
	err: unknown,
): SignalScanResult {
	const msg = errMsg(err)
	debug(`${source}: scan failed: ${msg}`)
	return {
		source,
		repoPath,
		branch,
		signals: [],
		scannedAt: Date.now(),
		status: SignalStatus.Error,
		error: msg,
	}
}

export function successResult(
	source: SignalSource,
	repoPath: string,
	branch: string | null,
	signals: Signal[],
): SignalScanResult {
	return {
		source,
		repoPath,
		branch,
		signals,
		scannedAt: Date.now(),
		status: SignalStatus.Ok,
	}
}

export function unconfiguredResult(
	source: SignalSource,
	repoPath: string,
	branch: string | null,
	reason: string,
): SignalScanResult {
	return {
		source,
		repoPath,
		branch,
		signals: [],
		scannedAt: Date.now(),
		status: SignalStatus.Unconfigured,
		error: reason,
	}
}

export function capBySeverity(signals: Signal[], limit: number): Signal[] {
	const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const
	return [...signals]
		.sort((a, b) => {
			const sa = order[a.severity as keyof typeof order] ?? 5
			const sb = order[b.severity as keyof typeof order] ?? 5
			if (sa !== sb) return sa - sb
			return b.count - a.count
		})
		.slice(0, limit)
}

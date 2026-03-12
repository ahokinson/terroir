import { CliExecError } from "@lib/cli"

export function captureStdout(err: unknown): string | null {
	if (err instanceof CliExecError) return err.stderr
	return null
}

export function parseJson<T>(stdout: string, extract: (payload: unknown) => T[]): T[] {
	try {
		return extract(JSON.parse(stdout))
	} catch {
		return []
	}
}

export function pickArray<T = unknown>(payload: unknown, keys: string[]): T[] {
	if (Array.isArray(payload)) return payload as T[]
	if (!payload || typeof payload !== "object") return []
	const obj = payload as Record<string, unknown>
	for (const k of keys) {
		const v = obj[k]
		if (Array.isArray(v)) return v as T[]
	}
	return []
}

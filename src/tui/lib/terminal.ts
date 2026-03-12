import type { CliRenderer } from "@opentui/core"

export type TerminalHandover = <T>(fn: () => Promise<T>) => Promise<T>

export function createTerminalHandover(renderer: CliRenderer): TerminalHandover {
	return async (fn) => {
		renderer.suspend()
		try {
			return await fn()
		} finally {
			renderer.resume()
		}
	}
}

import { createSimpleContext } from "@tui/lib/context"
import { onCleanup } from "solid-js"

export const { provider: ExitProvider, use: useExit } = createSimpleContext({
	name: "Exit",
	init: () => {
		const cleanupFns: (() => void)[] = []

		function onExit(fn: () => void) {
			cleanupFns.push(fn)
		}

		function exit(code = 0) {
			for (const fn of cleanupFns) {
				try {
					fn()
				} catch {}
			}
			process.exit(code)
		}

		process.on("SIGINT", () => exit(0))
		process.on("SIGTERM", () => exit(0))

		return { onExit, exit }
	},
})

import { spawn } from "node:child_process"
import { platform } from "node:os"
import { debug } from "@lib/log"

const DEBOUNCE_WINDOW_MS = 5000

export interface NotifyPayload {
	title: string
	body: string
}

export interface Notifier {
	send(payload: NotifyPayload): void
	flush(): void
	teardown(): void
}

export function createNotifier(): Notifier {
	const backend = pickBackend()
	let pending: NotifyPayload[] = []
	let timer: ReturnType<typeof setTimeout> | null = null

	function flush() {
		if (pending.length === 0) return
		const payload = pending.length === 1 ? pending[0] : groupPayloads(pending)
		pending = []
		if (timer) {
			clearTimeout(timer)
			timer = null
		}
		backend(payload).catch((err) => debug(`notify: send failed: ${err}`))
	}

	function send(payload: NotifyPayload) {
		pending.push(payload)
		if (timer) return
		timer = setTimeout(() => {
			timer = null
			flush()
		}, DEBOUNCE_WINDOW_MS)
	}

	function teardown() {
		if (timer) {
			clearTimeout(timer)
			timer = null
		}
		pending = []
	}

	return { send, flush, teardown }
}

function groupPayloads(payloads: NotifyPayload[]): NotifyPayload {
	const titles = new Set(payloads.map((p) => p.title))
	const title = titles.size === 1 ? [...titles][0] : `Terroir (${payloads.length} updates)`
	const body = payloads.map((p) => `• ${p.body}`).join("\n")
	return { title, body }
}

type Backend = (p: NotifyPayload) => Promise<void>

function pickBackend(): Backend {
	switch (platform()) {
		case "darwin":
			return darwinBackend
		case "linux":
			return linuxBackend
		default:
			return noopBackend
	}
}

function darwinBackend(p: NotifyPayload): Promise<void> {
	const script = `display notification ${quote(p.body)} with title ${quote(p.title)}`
	return runCli("osascript", ["-e", script])
}

function linuxBackend(p: NotifyPayload): Promise<void> {
	return runCli("notify-send", [p.title, p.body])
}

function noopBackend(p: NotifyPayload): Promise<void> {
	debug(`notify (noop): ${p.title} — ${p.body}`)
	return Promise.resolve()
}

function quote(s: string): string {
	return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function runCli(cmd: string, args: string[]): Promise<void> {
	return new Promise((resolve) => {
		const child = spawn(cmd, args, { stdio: "ignore", detached: false })
		child.on("error", () => resolve())
		child.on("exit", () => resolve())
	})
}

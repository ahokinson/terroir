export interface BackoffOptions {
	maxPerSec: number
	burst?: number
}

export interface Backoff {
	acquire(): Promise<void>
	onRetryAfter(seconds: number): void
}

export function createBackoff(opts: BackoffOptions): Backoff {
	const refillPerMs = opts.maxPerSec / 1000
	const capacity = opts.burst ?? opts.maxPerSec
	let tokens = capacity
	let lastRefill = Date.now()
	let cooldownUntil = 0

	function refill(): void {
		const now = Date.now()
		tokens = Math.min(capacity, tokens + (now - lastRefill) * refillPerMs)
		lastRefill = now
	}

	async function acquire(): Promise<void> {
		const now = Date.now()
		if (now < cooldownUntil) {
			await sleep(cooldownUntil - now)
		}
		refill()
		while (tokens < 1) {
			const wait = Math.max(1, Math.ceil((1 - tokens) / refillPerMs))
			await sleep(wait)
			refill()
		}
		tokens -= 1
	}

	function onRetryAfter(seconds: number): void {
		cooldownUntil = Math.max(cooldownUntil, Date.now() + seconds * 1000)
	}

	return { acquire, onRetryAfter }
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms))
}

import { type FSWatcher, watch } from "node:fs"
import type { Epic } from "@db/types"
import { debug } from "@lib/log"
import type { MonitorConfig } from "@monitor/types"

export interface SchedulerConfig {
	monitor: MonitorConfig
	startupDelayMs: number
	mediumStartupDelayMs: number
	slowStartupDelayMs: number
	fsWatchDebounceMs: number
}

export interface PollCallbacks {
	fast(): Promise<void>
	medium(): Promise<void>
	slow(): Promise<void>
	hasHotStories(): boolean
}

export enum Tier {
	Fast = "fast",
	Medium = "medium",
	Slow = "slow",
}

export class PollScheduler {
	private running: Record<Tier, boolean> = {
		[Tier.Fast]: false,
		[Tier.Medium]: false,
		[Tier.Slow]: false,
	}
	private paused = false
	private started = false
	private cleanups: (() => void)[] = []
	private watchers: FSWatcher[] = []

	constructor(
		private config: SchedulerConfig,
		private callbacks: PollCallbacks,
		private onPollingChange: (polling: boolean) => void,
	) {}

	start(epics: Epic[]) {
		if (this.started) return
		const mc = this.config.monitor
		if (!mc.enabled) {
			debug("monitor: disabled by config")
			return
		}

		debug("monitor: starting polling")
		this.started = true

		this.initTimers(mc)
		this.setupWatchers(epics)
	}

	private initTimers(mc: MonitorConfig) {
		const fastTimer = setInterval(() => this.runGuarded(Tier.Fast), mc.fastIntervalMs)
		this.cleanups.push(() => clearInterval(fastTimer))

		const mediumTimer = setTimeout(() => {
			this.runGuarded(Tier.Medium)
			const t = setInterval(() => this.runGuarded(Tier.Medium), mc.mediumIntervalMs)
			this.cleanups.push(() => clearInterval(t))
		}, this.config.mediumStartupDelayMs)
		this.cleanups.push(() => clearTimeout(mediumTimer))

		const slowTimer = setTimeout(() => {
			this.runGuarded(Tier.Slow)
			const t = setInterval(() => this.runGuarded(Tier.Slow), mc.slowIntervalMs)
			this.cleanups.push(() => clearInterval(t))
		}, this.config.slowStartupDelayMs)
		this.cleanups.push(() => clearTimeout(slowTimer))

		if (mc.reviewBoostFactor > 1) {
			const boostedInterval = Math.floor(mc.mediumIntervalMs / mc.reviewBoostFactor)
			const boostTimer = setInterval(() => {
				if (this.callbacks.hasHotStories()) {
					debug("monitor: boosted medium poll for hot stories")
					this.runGuarded(Tier.Medium)
				}
			}, boostedInterval)
			this.cleanups.push(() => clearInterval(boostTimer))
		}
	}

	private setupWatchers(epics: Epic[]) {
		const seen = new Set<string>()
		for (const epic of epics) {
			for (const story of epic.stories) {
				if (story.completedAt) continue
				for (const repo of story.repositories) {
					if (seen.has(repo.path)) continue
					seen.add(repo.path)
					try {
						const refsPath = `${repo.path}/.git/refs/heads`
						const w = watch(refsPath, { recursive: true }, (eventType, filename) => {
							if (filename) {
								debug(`monitor: fs event in ${repo.path}: ${eventType} ${filename}`)
								setTimeout(() => this.runGuarded(Tier.Fast), this.config.fsWatchDebounceMs)
							}
						})
						this.watchers.push(w)
					} catch {
						debug(`monitor: could not watch ${repo.path}/.git/refs/heads`)
					}
					try {
						const indexPath = `${repo.path}/.git/index`
						const w = watch(indexPath, (eventType) => {
							debug(`monitor: index change in ${repo.path}: ${eventType}`)
							setTimeout(() => this.runGuarded(Tier.Fast), this.config.fsWatchDebounceMs)
						})
						this.watchers.push(w)
					} catch {
						debug(`monitor: could not watch ${repo.path}/.git/index`)
					}
				}
			}
		}
	}

	private async runGuarded(tier: Tier) {
		if (this.running[tier] || this.paused) return
		this.running[tier] = true
		this.onPollingChange(true)
		try {
			await this.callbacks[tier]()
		} catch (err) {
			debug(`monitor: ${tier} poll error: ${err}`)
		} finally {
			this.running[tier] = false
			const anyRunning =
				this.running[Tier.Fast] || this.running[Tier.Medium] || this.running[Tier.Slow]
			if (!anyRunning) this.onPollingChange(false)
		}
	}

	pause() {
		this.paused = true
	}

	resume() {
		this.paused = false
	}

	pollNow() {
		this.runGuarded(Tier.Fast)
		this.runGuarded(Tier.Medium)
		this.runGuarded(Tier.Slow)
	}

	pollNowFor(storyName: string) {
		debug(`monitor: immediate poll for "${storyName}"`)
		this.runGuarded(Tier.Fast)
		this.runGuarded(Tier.Medium)
	}

	teardown() {
		for (const fn of this.cleanups) fn()
		this.cleanups.length = 0
		for (const w of this.watchers) w.close()
		this.watchers.length = 0
		this.started = false
	}
}

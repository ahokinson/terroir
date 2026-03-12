import type { Config } from "@db/config"
import type { Repos } from "@db/queries/repos"
import { LifecycleStage } from "@domain/lifecycle"
import { createNotifier, type Notifier } from "@lib/notify"
import { type AutomationDeps, createAutomationEngine } from "@monitor/engine"
import { feedbackHandler } from "@monitor/feedback"
import { lifecycleHandler } from "@monitor/lifecycle"
import { emptyPollState, initSlugs, Poller } from "@monitor/polls"
import { PollScheduler } from "@monitor/scheduler"
import { PollTracker } from "@monitor/state"
import type { MonitorEvent } from "@monitor/types"
import { EventType, MAX_EVENTS, NOTIFIABLE_EVENTS } from "@monitor/types"
import { useAppStore } from "@tui/contexts/store"
import {
	FsWatchDebounceMs,
	HighPriorityStatusMs,
	MediumPollStartupDelayMs,
	MonitorStartupDelayMs,
	SlowPollStartupDelayMs,
} from "@tui/layout"
import type { CacheState } from "@tui/stores/cache"
import type { DialogState } from "@tui/stores/dialog"
import type { EpicsState } from "@tui/stores/epics"
import type { IntegrationsState } from "@tui/stores/integrations"
import type { ReposState } from "@tui/stores/repos"
import type { RouteState } from "@tui/stores/route"
import type { StatusState } from "@tui/stores/status"
import type { SuggestionsState } from "@tui/stores/suggestions"
import { createMemo, createSignal, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"

export interface MonitorState {
	readonly events: MonitorEvent[]
	readonly unreadCount: number
	readonly polling: boolean
	unackedCountForStory(storyName: string): number
	markRead(id: number): void
	markAllRead(): void
	markStoryRead(storyName: string): void
	dismiss(id: number): void
	dismissAllForStory(storyName: string): void
	pause(): void
	resume(): void
	pollNow(): void
	pollNowFor(storyName: string): void
}

export interface MonitorStateDeps {
	store: EpicsState
	cache: CacheState
	integrations: IntegrationsState
	suggestions: SuggestionsState
	localRepos: ReposState
	config: () => Config
	route: RouteState
	status: StatusState
	dialog: DialogState
	repos: Repos
	onExit: (fn: () => void) => void
}

const HIGH_PRIORITY_TYPES: ReadonlySet<EventType> = new Set([
	EventType.CIStatusChange,
	EventType.PRStateChange,
	EventType.TicketStatusChange,
	EventType.TicketNewAssigned,
	EventType.StoryReadyCleanup,
	EventType.FeedbackReadyToMerge,
	EventType.LifecycleStageChange,
])

export function createMonitorState(deps: MonitorStateDeps): MonitorState {
	const {
		store,
		cache,
		integrations,
		suggestions,
		localRepos,
		config,
		route,
		status,
		dialog,
		repos,
		onExit,
	} = deps

	const [events, setEvents] = createStore<MonitorEvent[]>([])
	const [polling, setPolling] = createSignal(false)

	const notifier: Notifier = createNotifier()

	const unreadCount = createMemo(() => events.filter((e) => !e.read && !e.dismissed).length)

	function currentlyOpenStoryName(): string | null {
		const idx = route.indices
		const epicIdx = idx[0]
		const storyIdx = idx[1]
		if (epicIdx == null || storyIdx == null) return null
		return store.epics[epicIdx]?.stories[storyIdx]?.name ?? null
	}

	const noopResult = { toasts: [], secondaryEvents: [], storeChanged: false }
	const engine = createAutomationEngine([
		async (ev, ctx) => {
			if (!config().monitor.reactiveFeedback) return noopResult
			return feedbackHandler(ev, ctx)
		},
		async (ev, ctx) => {
			if (!config().monitor.lifecyclePipeline) return noopResult
			return lifecycleHandler(ev, ctx)
		},
	])

	function pushEvents(newEvents: MonitorEvent[]) {
		if (newEvents.length === 0) return
		const openStory = currentlyOpenStoryName()
		const stamped = newEvents.map((ev) => {
			if (openStory && ev.storyName === openStory) {
				return { ...ev, read: true }
			}
			return ev
		})

		setEvents(
			produce((draft) => {
				draft.unshift(...stamped)
				if (draft.length > MAX_EVENTS) draft.length = MAX_EVENTS
			}),
		)

		for (let i = 0; i < stamped.length; i++) {
			const ev = stamped[i]
			const insertedId = repos.events.insert(ev)
			if (insertedId !== ev.id) {
				const slot = stamped[i]
				setEvents((e) => e.id === slot.id, "id", insertedId)
				stamped[i] = { ...slot, id: insertedId }
			}

			if (HIGH_PRIORITY_TYPES.has(ev.type)) {
				status.show(ev.summary, HighPriorityStatusMs)
			}

			const cfg = config()
			const sameStoryOpen = openStory != null && ev.storyName === openStory
			if (
				cfg.notifications.enabled &&
				NOTIFIABLE_EVENTS.has(ev.type) &&
				!ev.dismissed &&
				!sameStoryOpen
			) {
				notifier.send({
					title: ev.storyName ?? "Terroir",
					body: ev.summary,
				})
			}

			if (!dialog.active) {
				const ctx: AutomationDeps = {
					store,
					integrations,
					repos,
					epics: store.epics,
					repoSlugs: pollState.current.repoSlugs,
				}
				engine.process(ev, ctx).then((result) => {
					for (const msg of result.toasts) status.show(msg, HighPriorityStatusMs)
					if (result.secondaryEvents.length > 0) pushEvents(result.secondaryEvents)
				})
			}
		}
	}

	const pollState = new PollTracker(emptyPollState())

	function hasHotStories(): boolean {
		for (const epic of store.epics) {
			for (const story of epic.stories) {
				if (
					story.lifecycleStage === LifecycleStage.Review ||
					story.lifecycleStage === LifecycleStage.Approved
				) {
					return true
				}
			}
		}
		return false
	}

	const scheduler = new PollScheduler(
		{
			monitor: config().monitor,
			startupDelayMs: MonitorStartupDelayMs,
			mediumStartupDelayMs: MediumPollStartupDelayMs,
			slowStartupDelayMs: SlowPollStartupDelayMs,
			fsWatchDebounceMs: FsWatchDebounceMs,
		},
		(() => {
			const poller = new Poller({
				cache,
				integrations,
				localRepos: () => localRepos.repos,
				discoverConfig: () => config().discover,
			})
			return {
				async fast() {
					const result = await poller.pollFast(store.epics, pollState.current)
					pollState.updateFast(result)
					pushEvents(result.events)
				},
				async medium() {
					const result = await poller.pollMedium(store.epics, pollState.current)
					pollState.updateMedium(result)
					pushEvents(result.events)
				},
				async slow() {
					const result = await poller.pollSlow(store.epics, pollState.current)
					pollState.updateSlow(result)
					pushEvents(result.events)
					suggestions.setItems(result.suggestions)
					if (result.storeChanged) {
						store.setState("epics", result.epics)
						store.save()
					}
				},
				hasHotStories,
			}
		})(),
		setPolling,
	)

	const startTimer = setTimeout(async () => {
		const slugs = await initSlugs(store.epics)
		pollState.initSlugs(slugs)
		scheduler.start(store.epics)
	}, MonitorStartupDelayMs)

	const cleanups = [() => clearTimeout(startTimer), () => notifier.teardown()]

	function teardown() {
		for (const fn of cleanups) fn()
		scheduler.teardown()
	}

	onCleanup(teardown)
	onExit(teardown)

	return {
		get events() {
			return events
		},
		get unreadCount() {
			return unreadCount()
		},
		get polling() {
			return polling()
		},
		unackedCountForStory(storyName: string) {
			let count = 0
			for (const ev of events) {
				if (ev.storyName === storyName && !ev.read && !ev.dismissed) count++
			}
			return count
		},
		markRead(id: number) {
			setEvents((e) => e.id === id, "read", true)
			repos.events.markRead(id)
		},
		markAllRead() {
			setEvents({}, "read", true)
		},
		markStoryRead(storyName: string) {
			setEvents((e) => e.storyName === storyName && !e.read, "read", true)
			repos.events.markAllReadForStory(storyName)
		},
		dismiss(id: number) {
			setEvents((e) => e.id === id, { dismissed: true, read: true })
			repos.events.dismiss(id)
		},
		dismissAllForStory(storyName: string) {
			setEvents((e) => e.storyName === storyName, { dismissed: true, read: true })
			repos.events.dismissAllForStory(storyName)
		},
		pause() {
			scheduler.pause()
		},
		resume() {
			scheduler.resume()
		},
		pollNow() {
			scheduler.pollNow()
		},
		pollNowFor(storyName: string) {
			scheduler.pollNowFor(storyName)
		},
	}
}

export function useMonitor() {
	return useAppStore().monitor
}

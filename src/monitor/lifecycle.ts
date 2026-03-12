import { LifecycleStage } from "@domain/lifecycle"
import { GitRepo } from "@integrations/git/client"
import { isTicketDone, PRState } from "@integrations/types"
import { debug } from "@lib/log"
import { event as createEvent } from "@monitor/diff"
import type { AutomationDeps, AutomationHandler, AutomationResult } from "@monitor/engine"
import { SnapshotBuilder } from "@monitor/polls"
import type { MonitorEvent, StorySnapshot } from "@monitor/types"
import { EventType } from "@monitor/types"

type Story = AutomationDeps["epics"][0]["stories"][0]

interface SideEffectResult {
	toast: string | null
	storeChanged: boolean
}

const NO_EFFECT: SideEffectResult = { toast: null, storeChanged: false }

const TRIGGER_EVENTS: ReadonlySet<EventType> = new Set([
	EventType.PRStateChange,
	EventType.PRNewReview,
	EventType.CIStatusChange,
	EventType.TicketStatusChange,
	EventType.StoryReadyCleanup,
	EventType.FeedbackReadyToMerge,
])

export function evaluateStage(
	snapshot: StorySnapshot,
	currentStage: LifecycleStage,
): LifecycleStage {
	if (currentStage === LifecycleStage.Archived) return LifecycleStage.Archived
	if (snapshot.completed) return LifecycleStage.Archived

	if (snapshot.hasOpenPRs && currentStage === LifecycleStage.Merged) return LifecycleStage.Review

	const hasPRActivity = snapshot.hasOpenPRs || snapshot.allPRsMerged
	if (!hasPRActivity) {
		if (snapshot.ticketDone) return LifecycleStage.Transitioned
		return LifecycleStage.Active
	}

	if (snapshot.allPRsMerged && !snapshot.hasOpenPRs) {
		if (snapshot.ticketDone) return LifecycleStage.Transitioned
		return LifecycleStage.Merged
	}

	if (snapshot.allApproved && snapshot.allCIGreen && snapshot.hasOpenPRs)
		return LifecycleStage.Approved
	if (snapshot.hasOpenPRs) return LifecycleStage.Review

	return currentStage
}

async function onMerged(story: Story, ctx: AutomationDeps): Promise<SideEffectResult> {
	if (!story.ticket || !ctx.integrations.tickets) return NO_EFFECT

	try {
		const transitions = await ctx.integrations.tickets.getTransitions(story.ticket)
		const doneTransition = transitions.find((t) => isTicketDone(t.name))
		if (!doneTransition) return NO_EFFECT

		debug(`lifecycle: transitioning ${story.ticket} to "${doneTransition.name}"`)
		await ctx.integrations.tickets.transitionIssue(story.ticket, doneTransition.id)
		return {
			toast: `Transitioned ${story.ticket} → ${doneTransition.name}`,
			storeChanged: false,
		}
	} catch (err) {
		debug(`lifecycle: transition failed for ${story.ticket}: ${err}`)
		return NO_EFFECT
	}
}

async function onTransitioned(story: Story, ctx: AutomationDeps): Promise<SideEffectResult> {
	let cleaned = 0

	for (const repo of story.repositories) {
		for (const branch of repo.branches) {
			const prs = ctx.integrations.getPRs(repo.path, branch.name)
			const allMerged = prs.length > 0 && prs.every((pr) => pr.state === PRState.Merged)
			if (!allMerged) continue
			try {
				debug(`lifecycle: deleting branch ${branch.name} in ${repo.path}`)
				await new GitRepo(repo.path).deleteBranch(branch.name)
				cleaned++
			} catch (err) {
				debug(`lifecycle: failed to delete branch ${branch.name}: ${err}`)
			}
		}
	}

	if (cleaned === 0) return NO_EFFECT
	return {
		toast: `Cleaned ${cleaned} merged branch${cleaned > 1 ? "es" : ""}`,
		storeChanged: false,
	}
}

async function onCleaned(
	story: Story,
	ctx: AutomationDeps,
	ei: number,
	si: number,
): Promise<SideEffectResult> {
	ctx.store.setState("epics", ei, "stories", si, "completedAt", new Date().toISOString())
	return { toast: `Completed: ${story.name}`, storeChanged: true }
}

function transition(
	newStage: LifecycleStage,
	story: Story,
	ctx: AutomationDeps,
	ei: number,
	si: number,
): Promise<SideEffectResult> {
	switch (newStage) {
		case LifecycleStage.Merged:
			return onMerged(story, ctx)
		case LifecycleStage.Transitioned:
			return onTransitioned(story, ctx)
		case LifecycleStage.Cleaned:
			return onCleaned(story, ctx, ei, si)
		default:
			return Promise.resolve(NO_EFFECT)
	}
}

export const lifecycleHandler: AutomationHandler = async (
	ev: MonitorEvent,
	ctx: AutomationDeps,
): Promise<AutomationResult> => {
	const toasts: string[] = []
	const secondaryEvents: MonitorEvent[] = []
	let storeChanged = false

	if (!TRIGGER_EVENTS.has(ev.type)) {
		return { toasts, secondaryEvents, storeChanged }
	}

	for (let ei = 0; ei < ctx.epics.length; ei++) {
		for (let si = 0; si < ctx.epics[ei].stories.length; si++) {
			const story = ctx.epics[ei].stories[si]
			if (story.completedAt) continue

			const snapshot = SnapshotBuilder.storySnapshot(
				story,
				(p, b) => ctx.integrations.getPRs(p, b),
				(p, b) => ctx.integrations.getPipeline(p, b),
				(k) => ctx.integrations.getTicket(k),
			)
			const newStage = evaluateStage(snapshot, story.lifecycleStage)

			if (newStage === story.lifecycleStage) continue

			debug(`lifecycle: ${story.name}: ${story.lifecycleStage} → ${newStage}`)
			ctx.store.setState("epics", ei, "stories", si, "lifecycleStage", newStage)
			storeChanged = true

			secondaryEvents.push(
				createEvent(
					EventType.LifecycleStageChange,
					`${story.name}: ${story.lifecycleStage} → ${newStage}`,
					story.name,
				),
			)

			const effect = await transition(newStage, story, ctx, ei, si)
			if (effect.toast) toasts.push(effect.toast)
			if (effect.storeChanged) storeChanged = true
		}
	}

	if (storeChanged) ctx.store.save()

	return { toasts, secondaryEvents, storeChanged }
}

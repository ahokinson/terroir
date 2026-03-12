import { FeedbackSource, Status } from "@db/types"
import { PipelineStatus, PR_OPEN_STATES } from "@integrations/types"
import { debug } from "@lib/log"
import { event as createEvent } from "@monitor/diff"
import type { AutomationDeps, AutomationHandler, AutomationResult } from "@monitor/engine"
import type { MonitorEvent } from "@monitor/types"
import { EventType } from "@monitor/types"

const CommentPreviewLength = 80

function findStoryByName(
	epics: AutomationDeps["epics"],
	name: string,
): { storyIdx: [number, number] } | null {
	for (let ei = 0; ei < epics.length; ei++) {
		for (let si = 0; si < epics[ei].stories.length; si++) {
			if (epics[ei].stories[si].name === name) {
				return { storyIdx: [ei, si] }
			}
		}
	}
	return null
}

export const feedbackHandler: AutomationHandler = async (
	ev: MonitorEvent,
	ctx: AutomationDeps,
): Promise<AutomationResult> => {
	const empty: AutomationResult = { toasts: [], secondaryEvents: [], storeChanged: false }

	if (ev.type === EventType.PRNewReview) {
		return handleNewReview(ev, ctx)
	}

	if (ev.type === EventType.CIStatusChange && ev.summary.includes("failed")) {
		return handleCIFailure(ev, ctx)
	}

	return empty
}

async function handleNewReview(ev: MonitorEvent, ctx: AutomationDeps): Promise<AutomationResult> {
	const toasts: string[] = []
	const secondaryEvents: MonitorEvent[] = []
	let storeChanged = false

	if (!ctx.integrations.git || !ev.storyName) {
		return { toasts, secondaryEvents, storeChanged }
	}

	const match = findStoryByName(ctx.epics, ev.storyName)
	if (!match) return { toasts, secondaryEvents, storeChanged }

	const [ei, si] = match.storyIdx
	const story = ctx.epics[ei].stories[si]

	for (const repo of story.repositories) {
		const slug = ctx.repoSlugs.get(repo.path)
		if (!slug) continue

		for (const branch of repo.branches) {
			const prs = ctx.integrations.getPRs(repo.path, branch.name)
			for (const pr of prs) {
				if (!PR_OPEN_STATES.has(pr.state)) continue

				try {
					const comments = await ctx.integrations.git.reviewComments(slug, pr.id)
					for (const comment of comments) {
						const extId = `review-${comment.id}`
						if (ctx.repos.feedback.hasItem(story.name, FeedbackSource.Review, extId)) continue

						const truncated =
							comment.body.length > CommentPreviewLength
								? `${comment.body.slice(0, CommentPreviewLength - 3)}...`
								: comment.body
						const location = comment.path
							? ` (${comment.path}${comment.line ? `:${comment.line}` : ""})`
							: ""
						const title = `Review: ${truncated}${location}`

						ctx.repos.feedback.addItem(story.name, FeedbackSource.Review, extId, truncated)

						const now = new Date().toISOString()
						ctx.store.setState("epics", ei, "stories", si, "tasks", (prev) => [
							...prev,
							{
								id: extId,
								title,
								status: Status.Todo,
								createdAt: now,
								updatedAt: now,
								completedAt: null,
							},
						])
						storeChanged = true

						secondaryEvents.push(
							createEvent(
								EventType.FeedbackReviewComment,
								`New review comment on ${story.name}`,
								story.name,
							),
						)
					}
				} catch (err) {
					debug(`feedback: failed to fetch review comments for PR #${pr.id}: ${err}`)
				}
			}
		}
	}

	if (storeChanged) {
		ctx.store.save()
		toasts.push(`Added review tasks to ${story.name}`)
	}

	return { toasts, secondaryEvents, storeChanged }
}

async function handleCIFailure(ev: MonitorEvent, ctx: AutomationDeps): Promise<AutomationResult> {
	const toasts: string[] = []
	const secondaryEvents: MonitorEvent[] = []
	let storeChanged = false

	if (!ctx.integrations.git || !ev.storyName) {
		return { toasts, secondaryEvents, storeChanged }
	}

	const match = findStoryByName(ctx.epics, ev.storyName)
	if (!match) return { toasts, secondaryEvents, storeChanged }

	const [ei, si] = match.storyIdx
	const story = ctx.epics[ei].stories[si]

	for (const repo of story.repositories) {
		const slug = ctx.repoSlugs.get(repo.path)
		if (!slug) continue

		for (const branch of repo.branches) {
			const pipeline = ctx.integrations.getPipeline(repo.path, branch.name)
			if (!pipeline || pipeline.status === PipelineStatus.Success) continue

			const extId = `ci-${pipeline.id}`
			if (ctx.repos.feedback.hasItem(story.name, FeedbackSource.CI, extId)) continue

			try {
				const summary = await ctx.integrations.git.ciFailureSummary(slug, pipeline.id)
				const title = `Fix CI: ${summary}`

				ctx.repos.feedback.addItem(story.name, FeedbackSource.CI, extId, summary)

				const now = new Date().toISOString()
				ctx.store.setState("epics", ei, "stories", si, "tasks", (prev) => [
					...prev,
					{
						id: extId,
						title,
						status: Status.Todo,
						createdAt: now,
						updatedAt: now,
						completedAt: null,
					},
				])
				storeChanged = true

				secondaryEvents.push(
					createEvent(
						EventType.FeedbackCIFailure,
						`CI failure on ${story.name}: ${summary}`,
						story.name,
					),
				)
			} catch (err) {
				debug(`feedback: failed to get CI summary for pipeline ${pipeline.id}: ${err}`)
			}
		}
	}

	if (storeChanged) {
		ctx.store.save()
		toasts.push(`Added CI fix task to ${story.name}`)
	}

	return { toasts, secondaryEvents, storeChanged }
}

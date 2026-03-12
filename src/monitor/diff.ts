import { repoName } from "@integrations/git/client"
import { PIPELINE_FAILURE_STATES, PipelineStatus } from "@integrations/types"
import type {
	BranchSnapshot,
	MonitorEvent,
	PipelineSnapshot,
	PRSnapshot,
	ReviewRequestSnapshot,
	SecuritySnapshot,
	SignalSnapshot,
	StorySnapshot,
	TicketSnapshot,
} from "@monitor/types"
import { EventType } from "@monitor/types"

export function createEventIdSource() {
	let n = 0
	return () => ++n
}

const nextDefaultId = createEventIdSource()

export function event(
	type: EventType,
	summary: string,
	storyName: string | null = null,
): MonitorEvent {
	return {
		id: nextDefaultId(),
		type,
		timestamp: Date.now(),
		storyName,
		summary,
		read: false,
		dismissed: false,
	}
}

export interface Differ<TSnap> {
	diff(prev: TSnap[], next: TSnap[]): MonitorEvent[]
}

function createDiffer<TSnap, TKey>(
	keyOf: (s: TSnap) => TKey,
	compare: (prev: TSnap, next: TSnap, out: MonitorEvent[]) => void,
): Differ<TSnap> {
	return {
		diff(prev, next) {
			const out: MonitorEvent[] = []
			const prevMap = new Map(prev.map((s) => [keyOf(s), s]))
			for (const n of next) {
				const p = prevMap.get(keyOf(n))
				if (p) compare(p, n, out)
			}
			return out
		},
	}
}

export const prDiffer = createDiffer<PRSnapshot, string>(
	(s) => s.key,
	(prev, next, out) => {
		const prevById = new Map(prev.prs.map((pr) => [pr.id, pr]))
		for (const npr of next.prs) {
			const ppr = prevById.get(npr.id)
			if (!ppr) {
				out.push(event(EventType.PRStateChange, `New PR #${npr.id} (${npr.state})`, next.storyName))
				continue
			}
			if (ppr.state !== npr.state) {
				out.push(
					event(
						EventType.PRStateChange,
						`PR #${npr.id}: ${ppr.state} → ${npr.state}`,
						next.storyName,
					),
				)
			}
			if (npr.approvals > ppr.approvals) {
				out.push(
					event(
						EventType.PRNewReview,
						`PR #${npr.id} approved (${npr.approvals} approvals)`,
						next.storyName,
					),
				)
			}
		}
	},
)

export const pipelineDiffer = createDiffer<PipelineSnapshot, string>(
	(s) => s.key,
	(prev, next, out) => {
		if (prev.status !== next.status && next.status !== null) {
			const label =
				next.status === PipelineStatus.Success
					? "passed"
					: PIPELINE_FAILURE_STATES.has(next.status)
						? "failed"
						: next.status
			out.push(event(EventType.CIStatusChange, `CI ${label} (${next.key})`, next.storyName))
		}
	},
)

export const ticketDiffer = createDiffer<TicketSnapshot, string>(
	(s) => s.key,
	(prev, next, out) => {
		if (prev.status !== next.status) {
			out.push(
				event(
					EventType.TicketStatusChange,
					`${next.key}: ${prev.status} → ${next.status}`,
					next.storyName,
				),
			)
		}
	},
)

export function createBranchDiffer(staleThreshold: number): Differ<BranchSnapshot> {
	return createDiffer<BranchSnapshot, string>(
		(s) => s.repoPath,
		(prev, next, out) => {
			const prevSet = new Set(prev.branches)
			for (const branch of next.branches) {
				if (!prevSet.has(branch)) {
					out.push(
						event(EventType.BranchNew, `New branch: ${branch} in ${repoName(next.repoPath)}`),
					)
				}
			}
			for (const [key, behind] of Object.entries(next.behindCounts)) {
				const prevBehind = prev.behindCounts[key] ?? 0
				if (behind >= staleThreshold && prevBehind < staleThreshold) {
					out.push(event(EventType.BranchStale, `${key} is ${behind} commits behind`))
				}
			}
		},
	)
}

export const securityDiffer = createDiffer<SecuritySnapshot, string>(
	(s) => s.key,
	(prev, next, out) => {
		const prevCriticals = new Set(prev.criticalIds)
		for (const id of next.criticalIds) {
			if (!prevCriticals.has(id)) {
				out.push(
					event(
						EventType.SecurityNewCritical,
						`Critical finding: ${id} (${next.key})`,
						next.storyName,
					),
				)
			}
		}

		const prevHighs = new Set(prev.highIds)
		for (const id of next.highIds) {
			if (!prevHighs.has(id)) {
				out.push(
					event(EventType.SecurityNewHigh, `High finding: ${id} (${next.key})`, next.storyName),
				)
			}
		}

		const nextAll = new Set(next.findingIds)
		let resolved = 0
		for (const id of prev.findingIds) {
			if (!nextAll.has(id)) resolved++
		}
		if (resolved > 0) {
			out.push(
				event(
					EventType.SecurityResolved,
					`${resolved} security finding(s) resolved (${next.key})`,
					next.storyName,
				),
			)
		}
	},
)

export const storyDriftDiffer = createDiffer<StorySnapshot, string>(
	(s) => s.name,
	(prev, next, out) => {
		if (next.completed) return

		const nowReady = next.allPRsMerged && !next.hasOpenPRs && next.ticketDone
		const wasReady = prev.allPRsMerged && !prev.hasOpenPRs && prev.ticketDone
		if (nowReady && !wasReady) {
			out.push(event(EventType.StoryReadyCleanup, `${next.name}: ready for cleanup`, next.name))
		}

		const nowMergeable = next.allApproved && next.allCIGreen && next.hasOpenPRs
		const wasMergeable = prev.allApproved && prev.allCIGreen && prev.hasOpenPRs
		if (nowMergeable && !wasMergeable) {
			out.push(event(EventType.FeedbackReadyToMerge, `${next.name}: ready to merge`, next.name))
		}
	},
)

export const signalDiffer = createDiffer<SignalSnapshot, string>(
	(s) => s.key,
	(prev, next, out) => {
		const prevCriticals = new Set(prev.criticalIds)
		for (const id of next.criticalIds) {
			if (!prevCriticals.has(id)) {
				out.push(
					event(
						EventType.SignalNewCritical,
						`Critical runtime error: ${id} (${next.key})`,
						next.storyName,
					),
				)
			}
		}

		const prevHighs = new Set(prev.highIds)
		for (const id of next.highIds) {
			if (!prevHighs.has(id)) {
				out.push(
					event(EventType.SignalNewHigh, `High runtime error: ${id} (${next.key})`, next.storyName),
				)
			}
		}

		const nextAll = new Set(next.signalIds)
		let resolved = 0
		for (const id of prev.signalIds) {
			if (!nextAll.has(id)) resolved++
		}
		if (resolved > 0) {
			out.push(
				event(
					EventType.SignalResolved,
					`${resolved} runtime error(s) resolved (${next.key})`,
					next.storyName,
				),
			)
		}
	},
)

export function diffReviewRequests(
	prevKeys: Set<string>,
	next: ReviewRequestSnapshot[],
): MonitorEvent[] {
	const events: MonitorEvent[] = []
	for (const r of next) {
		if (!prevKeys.has(r.key)) {
			const where = r.repoSlug ? ` (${r.repoSlug})` : ""
			events.push(
				event(EventType.PRReviewRequested, `Review requested: !${r.id} ${r.title}${where}`),
			)
		}
	}
	return events
}

export function diffTicketAssignments(
	prevKeys: Set<string>,
	nextTickets: { key: string; summary: string }[],
): MonitorEvent[] {
	const events: MonitorEvent[] = []
	for (const t of nextTickets) {
		if (!prevKeys.has(t.key)) {
			events.push(event(EventType.TicketNewAssigned, `New ticket: ${t.key} — ${t.summary}`))
		}
	}
	return events
}

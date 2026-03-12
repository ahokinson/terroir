import { parseEnum } from "@db/types"
import type { LifecycleStage } from "@domain/lifecycle"
import type { PipelineStatus, PRState } from "@integrations/types"

export enum EventType {
	PRStateChange = "pr:state-change",
	PRNewReview = "pr:new-review",
	PRReviewRequested = "pr:review-requested",
	CIStatusChange = "ci:status-change",
	TicketStatusChange = "ticket:status-change",
	TicketNewAssigned = "ticket:new-assigned",
	BranchNew = "branch:new",
	BranchStale = "branch:stale",
	StoryReadyCleanup = "story:ready-cleanup",
	DiscoveryAutoImport = "discovery:auto-import",
	DiscoveryAttached = "discovery:attached",
	DiscoveryAttachedProbable = "discovery:attached-probable",
	FeedbackReviewComment = "feedback:review-comment",
	FeedbackCIFailure = "feedback:ci-failure",
	FeedbackReadyToMerge = "feedback:ready-to-merge",
	LifecycleStageChange = "lifecycle:stage-change",
	SecurityNewCritical = "security:new-critical",
	SecurityNewHigh = "security:new-high",
	SecurityResolved = "security:resolved",
	SecurityScanError = "security:scan-error",
	SignalNewCritical = "signal:new-critical",
	SignalNewHigh = "signal:new-high",
	SignalResolved = "signal:resolved",
}

export interface MonitorEvent {
	id: number
	type: EventType
	timestamp: number
	storyName: string | null
	summary: string
	read: boolean
	dismissed: boolean
}

export const NOTIFIABLE_EVENTS: ReadonlySet<EventType> = new Set([
	EventType.PRReviewRequested,
	EventType.FeedbackCIFailure,
	EventType.FeedbackReadyToMerge,
	EventType.TicketNewAssigned,
	EventType.LifecycleStageChange,
	EventType.SecurityNewCritical,
	EventType.SignalNewCritical,
	EventType.DiscoveryAttachedProbable,
])

export interface MonitorConfig {
	enabled: boolean
	fastIntervalMs: number
	mediumIntervalMs: number
	slowIntervalMs: number
	reactiveFeedback: boolean
	lifecyclePipeline: boolean
	reviewBoostFactor: number
}

export interface PRSnapshot {
	key: string
	storyName: string
	prs: { id: number; state: PRState; approvals: number; reviewCommentCount: number }[]
}

export interface PipelineSnapshot {
	key: string
	storyName: string
	status: PipelineStatus | null
}

export interface TicketSnapshot {
	key: string
	status: string
	storyName: string | null
}

export interface BranchSnapshot {
	repoPath: string
	branches: string[]
	behindCounts: Record<string, number>
}

export interface ReviewRequestSnapshot {
	key: string
	id: number
	title: string
	repoSlug: string | null
}

export interface StorySnapshot {
	name: string
	ticket: string | null
	completed: boolean
	allPRsMerged: boolean
	hasOpenPRs: boolean
	ticketDone: boolean
	allApproved: boolean
	allCIGreen: boolean
	lifecycleStage: LifecycleStage
}

export interface SecuritySnapshot {
	key: string
	storyName: string
	findingIds: string[]
	criticalIds: string[]
	highIds: string[]
	totalCount: number
}

export interface SignalSnapshot {
	key: string
	storyName: string
	signalIds: string[]
	criticalIds: string[]
	highIds: string[]
	totalCount: number
}

export function toEventType(s: string): EventType {
	return parseEnum(EventType, s, EventType.PRStateChange)
}

export const MAX_EVENTS = 200

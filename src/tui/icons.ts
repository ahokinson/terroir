import type { PipelineStatus } from "@integrations/types"
import { PipelineStatus as PS, RemoteType } from "@integrations/types"
import type { EventType } from "@monitor/types"
import { EventType as ET } from "@monitor/types"

interface Icon {
	readonly char: string
	readonly columns: number
}

function icon(char: string, columns: number): Icon {
	return { char, columns }
}

export const Icon = {
	// Status glyphs
	circleFilled: icon("●", 1), // ●  active / selected / running
	circleHalf: icon("◑", 1), // ◑  in-progress / review
	circleEmpty: icon("○", 1), // ○  empty / default
	diamond: icon("◆", 1), // ◆  drift / dirty
	square: icon("■", 1), // ■  epic indicator

	// Selection / navigation
	cursor: icon("▸", 1), // ▸  list cursor
	check: icon("✓", 1), // ✓  installed / success
	cross: icon("✗", 1), // ✗  missing / failure

	// Separators
	dot: icon("·", 1), // ·  middle dot separator
	chevron: icon("›", 1), // ›  breadcrumb separator
	trail: icon("┄", 1), // ┄  status trail animation

	// Nerd Font
	pipeline: icon("\u{F0713}", 2), // 󰜓  CI pipeline
	pipelineRef: icon("\u{F07C0}", 2), // 󰟀  pipeline ref / branch link
	checkmark: icon("\u{F044C}", 2), // 󰑌  done / idle
	warning: icon("", 1), //   alert / tracked
} as const

// ── Remote provider icons (Nerd Font) ──

export const RemoteIcon: Record<RemoteType, string> = {
	[RemoteType.GitHub]: "", //   GitHub
	[RemoteType.GitLab]: "", //   GitLab
	[RemoteType.Unknown]: "", //   generic git
} as const

// ── Activity event icons ──

export const EventIcon: Record<EventType, string> = {
	[ET.PRStateChange]: "⬆", // ⬆
	[ET.PRNewReview]: "💬", // 💬
	[ET.PRReviewRequested]: "★", // ★
	[ET.CIStatusChange]: "●", // ●
	[ET.TicketStatusChange]: "→", // →
	[ET.TicketNewAssigned]: "+",
	[ET.BranchNew]: "⎇", // ⎇
	[ET.BranchStale]: "▾", // ▾
	[ET.StoryReadyCleanup]: "✓", // ✓
	[ET.DiscoveryAutoImport]: "↓", // ↓
	[ET.DiscoveryAttached]: "+", // attached to existing
	[ET.DiscoveryAttachedProbable]: "?", // probable attach
	[ET.FeedbackReviewComment]: "✎", // ✎
	[ET.FeedbackCIFailure]: "✗", // ✗
	[ET.FeedbackReadyToMerge]: "★", // ★
	[ET.LifecycleStageChange]: "◆", // ◆
	[ET.SecurityNewCritical]: "⚠", // ⚠
	[ET.SecurityNewHigh]: "⚠", // ⚠
	[ET.SecurityResolved]: "✓", // ✓
	[ET.SecurityScanError]: "✗", // ✗
	[ET.SignalNewCritical]: "⚡", // ⚡
	[ET.SignalNewHigh]: "⚡", // ⚡
	[ET.SignalResolved]: "✓", // ✓
}

// ── Pipeline status icons ──

export const PipelineIcon: Record<PipelineStatus | "unknown", string> = {
	[PS.Success]: "✓", // ✓
	[PS.Failure]: "✗", // ✗
	[PS.Failed]: "✗", // ✗
	[PS.Error]: "✗", // ✗
	[PS.Running]: "●", // ●
	[PS.Pending]: "◐", // ◐
	[PS.Canceled]: "⊘", // ⊘
	unknown: "○", // ○
} as const

// ── Drift tag icons ──

export const DriftIcon = {
	ticketDone: "●", // ●
	prsMerged: "⬆", // ⬆
	behind: "▾", // ▾
	dirty: "◌", // ◌
} as const

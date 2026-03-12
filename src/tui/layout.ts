import { MacOSScrollAccel } from "@opentui/core"
import type { ThemeColors } from "@tui/contexts/theme"

export const ReposPanelHeight = "25%"
export const ListDetailListWidth = "50%"
export const ListDetailContextWidth = "40%"
export const FullPanelWidth = "100%"

export const GlyphWidth = 3
export const LabelWidth = 14
export const ColumnPadding = 2
export const NestedIndent = 4
export const KeyLabelWidth = 16

export const DialogSmall = { top: "35%", left: "20%", width: "60%", padL: 1, padR: 1 } as const
export const DialogLarge = {
	top: "10%",
	left: "10%",
	width: "80%",
	height: "80%",
	padL: 2,
	padR: 2,
	padT: 1,
} as const

export const StatusDismissMs = 3_000
export const TrailLength = 3
export const HighPriorityStatusMs = 5_000
export const FsWatchDebounceMs = 500
export const MonitorStartupDelayMs = 5_000
export const SpinnerFrameMs = 80
export const MediumPollStaggerMs = 2_000
export const MediumPollStartupDelayMs = 10_000
export const SlowPollStartupDelayMs = 30_000

export function createScrollboxOptions(theme: ThemeColors) {
	return {
		verticalScrollbarOptions: {
			showArrows: false,
			trackOptions: {
				backgroundColor: theme.bgElement,
				foregroundColor: theme.bgOverlay,
			},
		},
		scrollAcceleration: new MacOSScrollAccel(),
	} as const
}

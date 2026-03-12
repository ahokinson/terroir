import { PIPELINE_FAILURE_STATES, PipelineStatus } from "@integrations/types"
import type { RGBA } from "@opentui/core"
import type { ThemeColors } from "@tui/contexts/theme"
import { PipelineIcon } from "@tui/icons"

export interface PipelineIndicator {
	icon: string
	color: RGBA
}

export function pipelineIndicator(status: PipelineStatus, theme: ThemeColors): PipelineIndicator {
	if (status === PipelineStatus.Success) {
		return { icon: PipelineIcon[PipelineStatus.Success], color: theme.taskDone }
	}
	if (PIPELINE_FAILURE_STATES.has(status)) {
		return { icon: PipelineIcon[PipelineStatus.Failure], color: theme.danger }
	}
	if (status === PipelineStatus.Running) {
		return { icon: PipelineIcon[PipelineStatus.Running], color: theme.warning }
	}
	if (status === PipelineStatus.Canceled) {
		return { icon: PipelineIcon[PipelineStatus.Canceled], color: theme.textDim }
	}
	return { icon: PipelineIcon.unknown, color: theme.textDim }
}

import type { RGBA } from "@opentui/core"
import type { useTheme } from "@tui/contexts/theme"
import type { useCache } from "@tui/stores/cache"
import type { useIntegrations } from "@tui/stores/integrations"

export enum ActionTargetKind {
	Url = "url",
	Ticket = "ticket",
	Pipeline = "pipeline",
	Branch = "branch",
}

export type ActionTarget =
	| { type: ActionTargetKind.Url; url: string }
	| { type: ActionTargetKind.Ticket; key: string; url: string }
	| { type: ActionTargetKind.Pipeline; url: string }
	| { type: ActionTargetKind.Branch; repoPath: string; branchName: string }

export type DetailRow = {
	label: string
	value: string
	indent?: boolean
	valueColor?: RGBA
	action?: ActionTarget
}
export type DetailData = { title: string; sections: { rows: DetailRow[] }[] }

export type Theme = ReturnType<typeof useTheme>
export type Cache = ReturnType<typeof useCache>
export type IntegrationsCtx = ReturnType<typeof useIntegrations>

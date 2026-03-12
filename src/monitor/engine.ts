import type { Repos } from "@db/queries/repos"
import type { Epic } from "@db/types"
import { debug } from "@lib/log"
import type { MonitorEvent } from "@monitor/types"
import type { useEpics } from "@tui/stores/epics"
import type { useIntegrations } from "@tui/stores/integrations"

type Store = ReturnType<typeof useEpics>
type Integrations = ReturnType<typeof useIntegrations>

export interface AutomationDeps {
	store: Store
	integrations: Integrations
	repos: Repos
	epics: Epic[]
	repoSlugs: Map<string, string | null>
}

export interface AutomationResult {
	toasts: string[]
	secondaryEvents: MonitorEvent[]
	storeChanged: boolean
}

export type AutomationHandler = (
	event: MonitorEvent,
	ctx: AutomationDeps,
) => Promise<AutomationResult>

export interface AutomationEngine {
	process(event: MonitorEvent, ctx: AutomationDeps): Promise<AutomationResult>
}

export function createAutomationEngine(handlers: AutomationHandler[]): AutomationEngine {
	return {
		async process(event, ctx) {
			const merged: AutomationResult = { toasts: [], secondaryEvents: [], storeChanged: false }

			for (const handler of handlers) {
				try {
					const result = await handler(event, ctx)
					merged.toasts.push(...result.toasts)
					merged.secondaryEvents.push(...result.secondaryEvents)
					if (result.storeChanged) merged.storeChanged = true
				} catch (err) {
					debug(`engine: handler error: ${err}`)
				}
			}

			return merged
		},
	}
}

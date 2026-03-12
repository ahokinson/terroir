import type { Repos } from "@db/queries/repos"
import type { Suggestion } from "@monitor/polls"
import { useAppStore } from "@tui/contexts/store"
import { createSignal } from "solid-js"

export interface SuggestionsState {
	readonly items: readonly Suggestion[]
	setItems(items: Suggestion[]): void
	dismiss(id: string): void
	isDismissed(id: string): boolean
}

export interface SuggestionsStateDeps {
	repos: Repos
}

export function createSuggestionsState(deps: SuggestionsStateDeps): SuggestionsState {
	const initial = deps.repos.suggestions.loadDismissedKeys()
	const [dismissed, setDismissed] = createSignal<Set<string>>(initial)
	const [raw, setRaw] = createSignal<Suggestion[]>([])

	function visible(): Suggestion[] {
		const d = dismissed()
		return raw().filter((s) => !d.has(s.id))
	}

	return {
		get items() {
			return visible()
		},
		setItems(items: Suggestion[]) {
			setRaw(items)
		},
		dismiss(id: string) {
			deps.repos.suggestions.dismiss(id)
			setDismissed((prev) => {
				if (prev.has(id)) return prev
				const next = new Set(prev)
				next.add(id)
				return next
			})
		},
		isDismissed(id: string) {
			return dismissed().has(id)
		},
	}
}

export function useSuggestions(): SuggestionsState {
	return useAppStore().suggestions
}

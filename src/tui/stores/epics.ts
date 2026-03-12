import type { Repos } from "@db/queries/repos"
import type { Epic } from "@db/types"
import { sync as syncContext } from "@monitor/story-sync"
import { useAppStore } from "@tui/contexts/store"
import { createStore, type SetStoreFunction } from "solid-js/store"

interface StoreShape {
	epics: Epic[]
}

export interface EpicsState {
	readonly epics: Epic[]
	setState: SetStoreFunction<StoreShape>
	save: () => void
	reload: () => void
}

export function createEpicsState(repos: Repos): EpicsState {
	const [state, setState] = createStore<StoreShape>({
		epics: repos.epics.loadAll(),
	})

	function save() {
		repos.epics.saveAll(state.epics)
		syncContext(state.epics)
	}

	function reload() {
		setState("epics", repos.epics.loadAll())
	}

	return {
		get epics() {
			return state.epics
		},
		setState,
		save,
		reload,
	}
}

export function useEpics() {
	return useAppStore().store
}

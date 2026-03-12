import type { Config } from "@db/config"
import {
	type BranchStatus,
	GitRepo,
	type LogEntry,
	type RepositoryStatus,
} from "@integrations/git/client"
import { branchKey } from "@lib/branches"
import { useAppStore } from "@tui/contexts/store"
import type { EpicsState } from "@tui/stores/epics"
import { createStore } from "solid-js/store"

export interface RepoCache {
	status: RepositoryStatus | null
	defaultBranch: string | null
}

export interface BranchCache {
	aheadBehind: BranchStatus | null
	session: boolean
}

export interface CacheState {
	readonly repos: Record<string, RepoCache>
	readonly branches: Record<string, BranchCache>
	readonly logs: Record<string, LogEntry[]>
	readonly sessions: Record<string, boolean>
	readonly fetching: boolean
	refreshAll: () => Promise<void>
	fetchAll: () => Promise<void>
	refreshRepo: (path: string) => Promise<void>
	refreshBranch: (path: string, branch: string, base: string) => Promise<void>
	refreshLog: (path: string, branch?: string) => Promise<void>
	branchKey: typeof branchKey
}

export interface CacheStateDeps {
	store: EpicsState
	config: () => Config
}

export function createCacheState(deps: CacheStateDeps): CacheState {
	const { store, config } = deps

	const [cache, setCache] = createStore({
		repos: {} as Record<string, RepoCache>,
		branches: {} as Record<string, BranchCache>,
		logs: {} as Record<string, LogEntry[]>,
		sessions: {} as Record<string, boolean>,
		fetching: false,
	})

	async function refreshRepo(path: string) {
		const repo = new GitRepo(path)
		try {
			const [status, defaultBranch] = await Promise.all([repo.status(), repo.defaultBase()])
			setCache("repos", path, { status, defaultBranch })
		} catch {
			setCache("repos", path, { status: null, defaultBranch: null })
		}
	}

	async function refreshBranch(path: string, branch: string, base: string) {
		const key = branchKey(path, branch)
		try {
			const aheadBehind = await new GitRepo(path).aheadBehind(branch, base)
			setCache("branches", key, (prev) => ({
				...(prev ?? { session: false }),
				aheadBehind,
			}))
		} catch {
			setCache("branches", key, (prev) => ({
				...(prev ?? { session: false }),
				aheadBehind: null,
			}))
		}
	}

	async function refreshLog(path: string, branch?: string) {
		const key = branch ? branchKey(path, branch) : path
		try {
			const entries = await new GitRepo(path).log(config().logLimit, branch)
			setCache("logs", key, entries)
		} catch {
			setCache("logs", key, [])
		}
	}

	function collectRepos(): { path: string; branches: string[] }[] {
		const allRepos: { path: string; branches: string[] }[] = []
		for (const epic of store.epics) {
			for (const story of epic.stories) {
				for (const repo of story.repositories) {
					allRepos.push({
						path: repo.path,
						branches: repo.branches.map((b) => b.name),
					})
				}
			}
		}
		return allRepos
	}

	async function refreshRepos(allRepos: { path: string; branches: string[] }[]) {
		await Promise.all(
			allRepos.map(async ({ path, branches }) => {
				await refreshRepo(path)
				const base = cache.repos[path]?.defaultBranch ?? "main"
				await Promise.all([
					refreshLog(path),
					...branches.map(async (b) => {
						await refreshBranch(path, b, base)
						await refreshLog(path, b)
					}),
				])
			}),
		)
	}

	async function refreshAll() {
		if (cache.fetching) return
		setCache("fetching", true)
		try {
			await refreshRepos(collectRepos())
		} finally {
			setCache("fetching", false)
		}
	}

	async function fetchAll() {
		if (cache.fetching) return
		setCache("fetching", true)
		try {
			const allRepos = collectRepos()
			const paths = new Set(allRepos.map((r) => r.path))
			await Promise.all([...paths].map((path) => new GitRepo(path).fetch().catch(() => {})))
			await refreshRepos(allRepos)
		} finally {
			setCache("fetching", false)
		}
	}

	refreshAll().catch(() => {})

	return {
		get repos() {
			return cache.repos
		},
		get branches() {
			return cache.branches
		},
		get logs() {
			return cache.logs
		},
		get sessions() {
			return cache.sessions
		},
		get fetching() {
			return cache.fetching
		},
		refreshAll,
		fetchAll,
		refreshRepo,
		refreshBranch,
		refreshLog,
		branchKey,
	}
}

export function useCache() {
	return useAppStore().cache
}

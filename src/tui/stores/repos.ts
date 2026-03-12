import { homedir } from "node:os"
import { GitRepo, repoName } from "@integrations/git/client"
import { detectRemote, type LocalRepo, parseRepoSlug, RemoteType } from "@integrations/types"
import { debug } from "@lib/log"
import { useAppStore } from "@tui/contexts/store"
import { createSignal, onMount } from "solid-js"

const SCAN_DEPTH = 5

const SKIP_DIRS = new Set([
	"node_modules",
	"Library",
	"Applications",
	"Music",
	"Movies",
	"Pictures",
	"Downloads",
	"Documents",
	"Desktop",
	"Public",
	"dist",
	"build",
	"target",
	"vendor",
	"__pycache__",
	".Trash",
])

async function findGitRepos(): Promise<string[]> {
	const home = homedir()
	const proc = Bun.spawn(
		["find", home, "-maxdepth", String(SCAN_DEPTH), "-name", ".git", "-type", "d", "-prune"],
		{ stdout: "pipe", stderr: "ignore" },
	)
	const output = await new Response(proc.stdout).text()
	await proc.exited

	return output
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((p) => p.replace(/\/.git$/, ""))
		.filter((p) => !p.split("/").some((part) => SKIP_DIRS.has(part)))
		.sort()
}

async function loadRepoInfo(path: string): Promise<LocalRepo> {
	const name = repoName(path)
	const repo = new GitRepo(path)
	let remote = ""
	let host: RemoteType = RemoteType.Unknown
	let slug: string | null = null
	let branch = ""
	let branches: string[] = []

	try {
		remote = await repo.remoteUrl()
		host = detectRemote(remote)
		slug = parseRepoSlug(remote)
	} catch (err) {
		debug("remote detection failed:", path, err)
	}

	try {
		const status = await repo.status()
		branch = status.currentBranch
	} catch (err) {
		debug("status check failed:", path, err)
	}

	try {
		branches = await repo.listBranches()
	} catch (err) {
		debug("branch listing failed:", path, err)
	}

	return { name, path, remote, host, slug, branch, branches }
}

export interface ReposState {
	readonly repos: LocalRepo[]
	readonly scanning: boolean
	readonly cursor: number
	readonly expanded: number
	setCursor: (v: number | ((prev: number) => number)) => void
	toggle: (index: number) => void
	refresh: () => Promise<void>
}

export function createReposState(): ReposState {
	const [repos, setRepos] = createSignal<LocalRepo[]>([])
	const [scanning, setScanning] = createSignal(true)
	const [cursor, setCursor] = createSignal(0)
	const [expanded, setExpanded] = createSignal<number>(-1)

	async function scanAndLoad() {
		setScanning(true)
		try {
			const paths = await findGitRepos()
			const loaded = await Promise.all(paths.map(loadRepoInfo))
			setRepos(loaded.sort((a, b) => a.name.localeCompare(b.name)))
		} catch (err) {
			debug("repo scan failed:", err)
			setRepos([])
		} finally {
			setScanning(false)
		}
	}

	onMount(() => scanAndLoad())

	function toggle(index: number) {
		setExpanded((prev) => (prev === index ? -1 : index))
	}

	return {
		get repos() {
			return repos()
		},
		get scanning() {
			return scanning()
		},
		get cursor() {
			return cursor()
		},
		get expanded() {
			return expanded()
		},
		setCursor,
		toggle,
		refresh: scanAndLoad,
	}
}

export function useRepos() {
	return useAppStore().localRepos
}

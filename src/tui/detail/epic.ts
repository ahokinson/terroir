import type { Epic } from "@db/types"
import { detailSection } from "@tui/detail/builder"
import type { Cache, DetailData } from "@tui/detail/types"

export function epicDetail(epic: Epic, cache: Cache): DetailData {
	const totalRepos = epic.stories.reduce((n, s) => n + s.repositories.length, 0)
	const totalTasks = epic.stories.reduce((n, s) => n + s.tasks.length, 0)

	let cleanCount = 0
	let dirtyCount = 0
	let aheadCount = 0
	for (const s of epic.stories) {
		for (const repo of s.repositories) {
			const rs = cache.repos[repo.path]?.status
			if (rs) {
				if (rs.dirty) dirtyCount++
				else cleanCount++
			}
			for (const b of repo.branches) {
				const bs = cache.branches[cache.branchKey(repo.path, b.name)]
				if (bs?.aheadBehind?.ahead) aheadCount += bs.aheadBehind.ahead
			}
		}
	}

	const gitParts: string[] = []
	if (cleanCount > 0) gitParts.push(`${cleanCount} clean`)
	if (dirtyCount > 0) gitParts.push(`${dirtyCount} dirty`)
	if (aheadCount > 0) gitParts.push(`${aheadCount} ahead`)

	const rows = detailSection()
		.row("Stories", String(epic.stories.length))
		.rowIf(totalRepos > 0, "Repositories", String(totalRepos))
		.rowIf(totalTasks > 0, "Tasks", String(totalTasks))
		.rowIf(gitParts.length > 0, "Git", gitParts.join(", "))
		.rowIf(epic.source, "Source", epic.source ?? "")

	return { title: epic.name, sections: [{ rows: rows.rows }] }
}

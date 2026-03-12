import type { Repository } from "@db/types"
import { repoName } from "@integrations/git/client"
import { detailSection } from "@tui/detail/builder"
import type { Cache, DetailData, DetailRow, Theme } from "@tui/detail/types"
import { ActionTargetKind } from "@tui/detail/types"

export function repoDetail(repo: Repository, cache: Cache, theme: Theme): DetailData {
	const rs = cache.repos[repo.path]?.status

	const info = detailSection()
		.row("Path", repo.path)
		.rowIf(rs, "Branch", rs?.currentBranch ?? "")
		.rowIf(
			rs,
			"Status",
			rs?.dirty ? `dirty (${rs.modified} modified, ${rs.untracked} untracked)` : "clean",
			{ valueColor: rs?.dirty ? theme.gitDirty : theme.gitClean },
		)
		.row("Branches", String(repo.branches.length))

	const rows: DetailRow[] = [...info.rows]
	for (const b of repo.branches) {
		const bs = cache.branches[cache.branchKey(repo.path, b.name)]
		let ab = ""
		if (bs?.aheadBehind) {
			ab = ` +${bs.aheadBehind.ahead}/-${bs.aheadBehind.behind}`
		}
		const isCurrent = rs?.currentBranch === b.name
		rows.push({
			label: "",
			value: `${isCurrent ? "●" : "○"} ${b.name}${ab}`,
			indent: true,
			valueColor: isCurrent ? theme.accent : theme.textDim,
			action: { type: ActionTargetKind.Branch, repoPath: repo.path, branchName: b.name },
		})
	}
	return { title: repoName(repo.path), sections: [{ rows }] }
}

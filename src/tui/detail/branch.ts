import type { Branch, Repository } from "@db/types"
import { repoName } from "@integrations/git/client"
import type { PullRequest } from "@integrations/types"
import { PRState, Severity } from "@integrations/types"
import type { RGBA } from "@opentui/core"
import { detailSection } from "@tui/detail/builder"
import type { Cache, DetailData, DetailRow, IntegrationsCtx, Theme } from "@tui/detail/types"
import { ActionTargetKind } from "@tui/detail/types"
import { pipelineIndicator } from "@tui/stores/pipeline"

function prStateColor(pr: PullRequest, theme: Theme): RGBA {
	if (pr.state === PRState.Merged) return theme.gitClean
	return theme.warning
}

export function branchDetail(
	repo: Repository,
	branch: Branch,
	cache: Cache,
	integrations: IntegrationsCtx,
	theme: Theme,
): DetailData {
	const rs = cache.repos[repo.path]?.status
	const bs = cache.branches[cache.branchKey(repo.path, branch.name)]
	const isCurrent = rs?.currentBranch === branch.name

	const info = detailSection()
		.row("Branch", branch.name)
		.rowIf(branch.baseBranch, "Base", branch.baseBranch ?? "")
		.row("Repo", repoName(repo.path))
		.rowIf(
			rs && isCurrent,
			"Status",
			rs?.dirty ? `dirty (${rs.modified} modified, ${rs.untracked} untracked)` : "clean",
			{ valueColor: rs?.dirty ? theme.gitDirty : theme.gitClean },
		)
		.rowIf(rs && !isCurrent, "Checked out", `no (${rs?.currentBranch} is current)`, {
			valueColor: theme.textDim,
		})
		.rowIf(bs?.aheadBehind, "Ahead", `+${bs?.aheadBehind?.ahead ?? 0}`, {
			valueColor: theme.gitAhead,
		})
		.rowIf(bs?.aheadBehind, "Behind", `-${bs?.aheadBehind?.behind ?? 0}`, {
			valueColor: (bs?.aheadBehind?.behind ?? 0) > 0 ? theme.gitBehind : theme.textDim,
		})

	const prs = integrations.getPRs(repo.path, branch.name)
	const prRows: DetailRow[] = []
	if (prs.length > 0) {
		const pr = prs[0]
		const state = pr.draft ? "draft" : pr.state
		prRows.push({
			label: "PR",
			value: `#${pr.id} ${pr.title} (${state})`,
			valueColor: prStateColor(pr, theme),
			action: { type: ActionTargetKind.Url, url: pr.url },
		})
		if (pr.body === "") {
			prRows.push({
				label: "Description",
				value: "⚠ empty (P to generate)",
				valueColor: theme.warning,
			})
		}
	}

	const pipeline = integrations.getPipeline(repo.path, branch.name)
	const pipelineRows: DetailRow[] = []
	if (pipeline) {
		const pi = pipelineIndicator(pipeline.status, theme)
		pipelineRows.push({
			label: "Pipeline",
			value: `#${pipeline.id} 󰟀 ${pi.icon} ${pipeline.status}`,
			valueColor: pi.color,
			action: { type: ActionTargetKind.Pipeline, url: pipeline.url },
		})
	}

	const linked = integrations.getLinkedIssues(repo.path, branch.name)
	const linkedRows: DetailRow[] = []
	if (linked.length > 0) {
		linkedRows.push({ label: "Linked", value: String(linked.length) })
		for (const issue of linked) {
			linkedRows.push({
				label: "",
				value: `${issue.key} [${issue.status}] ${issue.title}`,
				indent: true,
				action: { type: ActionTargetKind.Url, url: issue.url },
			})
		}
	}

	const findings = integrations.getBranchFindings(repo.path, branch.name)
	const securityRows: DetailRow[] = []
	if (findings.length > 0) {
		const criticalCount = findings.filter((f) => f.severity === Severity.Critical).length
		const highCount = findings.filter((f) => f.severity === Severity.High).length
		const summaryColor =
			criticalCount > 0 ? theme.danger : highCount > 0 ? theme.warning : theme.textDim
		securityRows.push({
			label: "Security",
			value: `${findings.length} finding(s) — ${criticalCount} critical, ${highCount} high`,
			valueColor: summaryColor,
		})
		const sorted = [...findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
		for (const f of sorted.slice(0, 5)) {
			const loc = f.location ? ` @ ${f.location}` : ""
			securityRows.push({
				label: "",
				value: `[${f.scanner}/${f.severity}] ${f.title}${loc}`,
				indent: true,
				valueColor: severityColor(f.severity, theme),
				action: f.url ? { type: ActionTargetKind.Url, url: f.url } : undefined,
			})
		}
	}

	const signals = integrations.getBranchSignals(repo.path, branch.name)
	const signalRows: DetailRow[] = []
	if (signals.length > 0) {
		const criticalCount = signals.filter((s) => s.severity === Severity.Critical).length
		const highCount = signals.filter((s) => s.severity === Severity.High).length
		const summaryColor =
			criticalCount > 0 ? theme.danger : highCount > 0 ? theme.warning : theme.textDim
		signalRows.push({
			label: "Runtime",
			value: `⚡ ${signals.length} error(s) — ${criticalCount} critical, ${highCount} high`,
			valueColor: summaryColor,
		})
		const sorted = [...signals].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
		for (const s of sorted.slice(0, 5)) {
			const occurrences = s.count > 1 ? ` (×${s.count})` : ""
			signalRows.push({
				label: "",
				value: `[${s.source}/${s.severity}] ${s.title}${occurrences}`,
				indent: true,
				valueColor: severityColor(s.severity, theme),
				action: s.url ? { type: ActionTargetKind.Url, url: s.url } : undefined,
			})
		}
	}

	return {
		title: branch.name,
		sections: [
			{ rows: info.rows },
			...(prRows.length > 0 ? [{ rows: prRows }] : []),
			...(pipelineRows.length > 0 ? [{ rows: pipelineRows }] : []),
			...(linkedRows.length > 0 ? [{ rows: linkedRows }] : []),
			...(securityRows.length > 0 ? [{ rows: securityRows }] : []),
			...(signalRows.length > 0 ? [{ rows: signalRows }] : []),
		],
	}
}

function severityRank(sev: Severity): number {
	switch (sev) {
		case Severity.Critical:
			return 4
		case Severity.High:
			return 3
		case Severity.Medium:
			return 2
		case Severity.Low:
			return 1
		default:
			return 0
	}
}

function severityColor(sev: Severity, theme: Theme): RGBA {
	if (sev === Severity.Critical || sev === Severity.High) return theme.danger
	if (sev === Severity.Medium) return theme.warning
	return theme.textDim
}

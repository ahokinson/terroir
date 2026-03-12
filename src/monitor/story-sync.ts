import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import { type Epic, Status, type Story } from "@db/types"

const MARKER = "<!-- terroir:auto-generated — task status edits are synced back -->"
const TASK_RE = /^- \[([ x-])\] .+ <!-- terroir:([a-f0-9]+) -->$/

const GITIGNORE_ENTRIES = [".terroir/", ".claude/"]

const CLAUDE_INSTRUCTIONS = `# Terroir Context

When you see a \`.terroir/context.md\` file in a repository, it contains your current story, tasks, and branch context managed by Terroir.

- Read \`.terroir/context.md\` to understand what you're working on
- Update task checkboxes to reflect progress: \`[ ]\` = todo, \`[-]\` = in-progress, \`[x]\` = done
- Do not modify anything outside the task checkboxes (story name, branch info, etc.)
- Task IDs in \`<!-- terroir:ID -->\` comments are for sync — do not remove them
`

export interface TaskUpdate {
	id: string
	status: Status
}

function statusCheckbox(s: Status): string {
	switch (s) {
		case Status.Todo:
			return "[ ]"
		case Status.InProgress:
			return "[-]"
		case Status.Done:
			return "[x]"
	}
}

function checkboxToStatus(ch: string): Status {
	switch (ch) {
		case "x":
			return Status.Done
		case "-":
			return Status.InProgress
		default:
			return Status.Todo
	}
}

function buildContextMarkdown(
	story: Story,
	branchName: string,
	baseBranch: string | null,
	otherRepos: { name: string; branch: string }[],
): string {
	const lines: string[] = [MARKER, `# Story: ${story.name}`, ""]

	lines.push(`- **Type:** ${story.type}`)
	if (story.ticket) {
		lines.push(`- **Ticket:** ${story.ticket}`)
	}
	lines.push("")

	if (story.tasks.length > 0) {
		lines.push("## Tasks", "")
		for (const task of story.tasks) {
			lines.push(`- ${statusCheckbox(task.status)} ${task.title} <!-- terroir:${task.id} -->`)
		}
		lines.push("")
	}

	lines.push("## Context", "")
	lines.push(`- **Branch:** ${branchName}`)
	if (baseBranch) {
		lines.push(`- **Base:** ${baseBranch}`)
	}

	if (otherRepos.length > 0) {
		lines.push("- **Related:**")
		for (const r of otherRepos) {
			lines.push(`  - ${r.name} (${r.branch})`)
		}
	}

	lines.push("")
	return lines.join("\n")
}

function ensureGitignore(repoPath: string): void {
	const gitignorePath = join(repoPath, ".gitignore")
	let content = ""
	if (existsSync(gitignorePath)) {
		content = readFileSync(gitignorePath, "utf-8")
	}

	const missing = GITIGNORE_ENTRIES.filter((entry) => !content.includes(entry))
	if (missing.length === 0) return

	const suffix = content.endsWith("\n") || content === "" ? "" : "\n"
	writeFileSync(gitignorePath, content + suffix + missing.join("\n") + "\n")
}

function writeContextFile(repoPath: string, markdown: string): void {
	const dir = join(repoPath, ".terroir")
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, "context.md"), markdown)
}

function writeClaudeFile(repoPath: string): void {
	const dir = join(repoPath, ".claude")
	mkdirSync(dir, { recursive: true })
	const filePath = join(dir, "terroir.md")
	if (existsSync(filePath)) return
	writeFileSync(filePath, CLAUDE_INSTRUCTIONS)
}

export function sync(epics: Epic[]): void {
	for (const epic of epics) {
		for (const story of epic.stories) {
			for (const repo of story.repositories) {
				if (!existsSync(repo.path)) continue

				for (const branch of repo.branches) {
					const otherRepos = story.repositories
						.filter((r) => r.path !== repo.path)
						.flatMap((r) =>
							r.branches.map((b) => ({
								name: basename(r.path),
								branch: b.name,
							})),
						)

					const md = buildContextMarkdown(story, branch.name, branch.baseBranch, otherRepos)
					writeContextFile(repo.path, md)
					writeClaudeFile(repo.path)
					ensureGitignore(repo.path)
				}
			}
		}
	}
}

export function readBack(repoPath: string): TaskUpdate[] {
	const filePath = join(repoPath, ".terroir", "context.md")
	if (!existsSync(filePath)) return []

	const content = readFileSync(filePath, "utf-8")
	const updates: TaskUpdate[] = []

	for (const line of content.split("\n")) {
		const match = TASK_RE.exec(line)
		if (match) {
			updates.push({
				id: match[2],
				status: checkboxToStatus(match[1]),
			})
		}
	}

	return updates
}

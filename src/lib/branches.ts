export function branchKey(repoPath: string, branch: string): string {
	return `${repoPath}:${branch}`
}

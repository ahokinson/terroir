const CMD_TIMEOUT = 5_000
const NET_TIMEOUT = 30_000
const LOG_SEP = "†"

const IGNORED_PATHS = [".gitignore", ".terroir/", ".claude/"]

export interface RepositoryStatus {
	currentBranch: string
	dirty: boolean
	staged: number
	modified: number
	untracked: number
}

export interface BranchStatus {
	ahead: number
	behind: number
}

export interface LogEntry {
	hash: string
	subject: string
	authorEpoch: number
	author: string
}

async function gitExec(path: string, args: string[], timeout = CMD_TIMEOUT): Promise<string> {
	const proc = Bun.spawn(["git", "-C", path, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	})

	const result = await Promise.race([
		proc.exited,
		new Promise<never>((_, reject) =>
			setTimeout(() => {
				proc.kill()
				reject(new Error(`git ${args[0]} timed out after ${timeout}ms`))
			}, timeout),
		),
	])

	if (result !== 0) {
		const stderr = await new Response(proc.stderr).text()
		throw new Error(`git ${args[0]} failed (exit ${result}): ${stderr.trim()}`)
	}

	const text = await new Response(proc.stdout).text()
	return text.trim()
}

function parseLogOutput(out: string): LogEntry[] {
	if (!out) return []

	return out
		.split("\n")
		.map((line) => {
			const parts = line.split(LOG_SEP)
			if (parts.length < 3) return null
			return {
				hash: parts[0],
				subject: parts[1],
				authorEpoch: parseInt(parts[2], 10) || 0,
				author: parts[3] ?? "",
			}
		})
		.filter((e): e is LogEntry => e !== null)
}

export class GitRepo {
	constructor(readonly path: string) {}

	private exec(args: string[], timeout = CMD_TIMEOUT): Promise<string> {
		return gitExec(this.path, args, timeout)
	}

	private execNet(args: string[]): Promise<string> {
		return gitExec(this.path, args, NET_TIMEOUT)
	}

	async currentBranch(timeout = CMD_TIMEOUT): Promise<string> {
		try {
			return await this.exec(["rev-parse", "--abbrev-ref", "HEAD"], timeout)
		} catch {
			return ""
		}
	}

	async status(timeout = CMD_TIMEOUT): Promise<RepositoryStatus> {
		const branch = await this.currentBranch(timeout)
		const rs: RepositoryStatus = {
			currentBranch: branch,
			dirty: false,
			staged: 0,
			modified: 0,
			untracked: 0,
		}

		let out: string
		try {
			out = await this.exec(["status", "--porcelain"], timeout)
		} catch {
			return rs
		}

		if (!out) return rs

		for (const line of out.split("\n")) {
			if (line.length < 2) continue
			const file = line.slice(2).trim()
			if (IGNORED_PATHS.some((p) => file === p || file.startsWith(p))) continue

			const x = line[0]
			const y = line[1]

			if (x === "?" && y === "?") {
				rs.untracked++
				rs.dirty = true
				continue
			}
			if ("AMDRC".includes(x)) {
				rs.staged++
				rs.dirty = true
			}
			if (y === "M" || y === "D") {
				rs.modified++
				rs.dirty = true
			}
		}

		return rs
	}

	async aheadBehind(branch: string, base: string, timeout = CMD_TIMEOUT): Promise<BranchStatus> {
		try {
			const out = await this.exec(
				["rev-list", "--left-right", "--count", `${base}...${branch}`],
				timeout,
			)
			const parts = out.split(/\s+/)
			if (parts.length !== 2) return { ahead: 0, behind: 0 }
			return {
				behind: parseInt(parts[0], 10) || 0,
				ahead: parseInt(parts[1], 10) || 0,
			}
		} catch {
			return { ahead: 0, behind: 0 }
		}
	}

	async log(limit: number, branch?: string, timeout = CMD_TIMEOUT): Promise<LogEntry[]> {
		try {
			const ref = branch ?? "HEAD"
			const out = await this.exec(
				["log", ref, `--format=%h${LOG_SEP}%s${LOG_SEP}%ct${LOG_SEP}%ae`, "-n", String(limit)],
				timeout,
			)
			return parseLogOutput(out)
		} catch {
			return []
		}
	}

	async logRange(
		base: string,
		head: string,
		limit?: number,
		timeout = CMD_TIMEOUT,
	): Promise<LogEntry[]> {
		try {
			const args = ["log", `${base}..${head}`, `--format=%h${LOG_SEP}%s${LOG_SEP}%ct${LOG_SEP}%ae`]
			if (limit !== undefined) {
				args.push("-n", String(limit))
			}
			const out = await this.exec(args, timeout)
			return parseLogOutput(out)
		} catch {
			return []
		}
	}

	async fetch(): Promise<void> {
		await this.execNet(["fetch"])
	}

	async checkoutBranch(branch: string, create = false, timeout = CMD_TIMEOUT): Promise<void> {
		if (create) {
			await this.exec(["checkout", "-b", branch], timeout)
		} else {
			await this.exec(["checkout", branch], timeout)
		}
	}

	async deleteBranch(branch: string, timeout = CMD_TIMEOUT): Promise<void> {
		await this.exec(["branch", "-d", branch], timeout)
	}

	async deleteRemoteBranch(branch: string): Promise<void> {
		await this.execNet(["push", "origin", "--delete", branch])
	}

	async defaultBase(timeout = CMD_TIMEOUT): Promise<string> {
		try {
			const out = await this.exec(["symbolic-ref", "refs/remotes/origin/HEAD", "--short"], timeout)
			if (out) {
				const i = out.indexOf("/")
				return i >= 0 ? out.slice(i + 1) : out
			}
		} catch {}

		try {
			await this.exec(["rev-parse", "--verify", "main"], timeout)
			return "main"
		} catch {}

		try {
			await this.exec(["rev-parse", "--verify", "master"], timeout)
			return "master"
		} catch {
			return "main"
		}
	}

	async mergeBase(a: string, b: string, timeout = CMD_TIMEOUT): Promise<string> {
		try {
			return await this.exec(["merge-base", a, b], timeout)
		} catch {
			return ""
		}
	}

	async revParse(ref: string, timeout = CMD_TIMEOUT): Promise<string> {
		try {
			return await this.exec(["rev-parse", ref], timeout)
		} catch {
			return ""
		}
	}

	async listBranches(timeout = CMD_TIMEOUT): Promise<string[]> {
		try {
			const out = await this.exec(["branch", "--format=%(refname:short)"], timeout)
			return out
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
		} catch {
			return []
		}
	}

	async branchExists(branch: string, timeout = CMD_TIMEOUT): Promise<boolean> {
		try {
			await this.exec(["rev-parse", "--verify", branch], timeout)
			return true
		} catch {
			return false
		}
	}

	async createBranch(branch: string, base: string, timeout = CMD_TIMEOUT): Promise<void> {
		await this.exec(["branch", branch, base], timeout)
	}

	async remoteUrl(timeout = CMD_TIMEOUT): Promise<string> {
		try {
			return await this.exec(["remote", "get-url", "origin"], timeout)
		} catch {
			return ""
		}
	}

	async isRepo(timeout = CMD_TIMEOUT): Promise<boolean> {
		try {
			await this.exec(["rev-parse", "--git-dir"], timeout)
			return true
		} catch {
			return false
		}
	}

	async trackingRef(branch: string, timeout = CMD_TIMEOUT): Promise<string> {
		const ref = `origin/${branch}`
		try {
			await this.exec(["rev-parse", "--verify", ref], timeout)
			return ref
		} catch {
			return branch
		}
	}

	async userEmail(timeout = CMD_TIMEOUT): Promise<string> {
		try {
			const out = await this.exec(["config", "user.email"], timeout)
			if (out) return out
		} catch {}
		try {
			return await this.exec(["log", "-1", "--format=%ae", "HEAD"], timeout)
		} catch {
			return ""
		}
	}

	async userName(timeout = CMD_TIMEOUT): Promise<string> {
		try {
			return await this.exec(["config", "user.name"], timeout)
		} catch {
			return ""
		}
	}

	async setConfig(key: string, value: string, timeout = CMD_TIMEOUT): Promise<void> {
		await this.exec(["config", key, value], timeout)
	}

	async branchAuthorEmail(branch: string, timeout = CMD_TIMEOUT): Promise<string> {
		try {
			return await this.exec(["log", "-1", "--format=%ae", branch], timeout)
		} catch {
			return ""
		}
	}

	async latestBranchEpoch(branch: string, base: string, timeout = CMD_TIMEOUT): Promise<number> {
		try {
			const out = await this.exec(["log", `${base}..${branch}`, "--format=%ct", "-n", "1"], timeout)
			return parseInt(out, 10) || 0
		} catch {
			return 0
		}
	}
}

export function repoName(path: string): string {
	return path.split("/").pop() ?? path
}

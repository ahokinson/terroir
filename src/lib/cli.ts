const DEFAULT_TIMEOUT = 30_000

export class CliExecError extends Error {
	constructor(
		public readonly cmd: string,
		public readonly exitCode: number,
		public readonly stderr: string,
	) {
		super(`${cmd} failed (exit ${exitCode}): ${stderr}`)
		this.name = "CliExecError"
	}
}

export class CliNotInstalledError extends Error {
	constructor(public readonly cmd: string) {
		super(`${cmd} is not installed`)
		this.name = "CliNotInstalledError"
	}
}

export async function exec(
	cmd: string,
	args: string[],
	opts?: { timeout?: number },
): Promise<string> {
	const timeout = opts?.timeout ?? DEFAULT_TIMEOUT

	const proc = Bun.spawn([cmd, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	})

	const result = await Promise.race([
		proc.exited,
		new Promise<never>((_, reject) =>
			setTimeout(() => {
				proc.kill()
				reject(new Error(`${cmd} timed out after ${timeout}ms`))
			}, timeout),
		),
	])

	if (result !== 0) {
		const stderr = await new Response(proc.stderr).text()
		throw new CliExecError(cmd, result, stderr.trim())
	}

	const text = await new Response(proc.stdout).text()
	return text.trim()
}

export async function execJson<T>(
	cmd: string,
	args: string[],
	opts?: { timeout?: number },
): Promise<T> {
	const stdout = await exec(cmd, args, opts)
	return JSON.parse(stdout) as T
}

export async function isInstalled(cmd: string): Promise<boolean> {
	try {
		const proc = Bun.spawn(["which", cmd], { stdout: "pipe", stderr: "pipe" })
		const code = await proc.exited
		return code === 0
	} catch {
		return false
	}
}

export function isInstalledSync(cmd: string): boolean {
	try {
		const result = Bun.spawnSync(["which", cmd], { stdout: "pipe", stderr: "pipe" })
		return result.exitCode === 0
	} catch {
		return false
	}
}

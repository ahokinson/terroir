const CMD_TIMEOUT = 5 * 60 * 1000

interface ProviderDef {
	command: string[]
	modelFlag: string
}

const providers: Record<string, ProviderDef> = {
	claude: { command: ["claude", "-p", "--no-session-persistence"], modelFlag: "--model" },
	opencode: { command: ["opencode", "run"], modelFlag: "--model" },
	codex: { command: ["codex", "--quiet"], modelFlag: "--model" },
}

export function commandFor(provider?: string, model?: string): string[] {
	const def = providers[provider ?? "claude"] ?? providers.claude
	const cmd = [...def.command]
	if (model && def.modelFlag) {
		cmd.push(def.modelFlag, model)
	}
	return cmd
}

export async function runCommand(cmdArgs: string[], prompt: string): Promise<string> {
	if (cmdArgs.length === 0) throw new Error("No AI command configured")

	const proc = Bun.spawn(cmdArgs, {
		stdin: new Blob([prompt]).stream(),
		stdout: "pipe",
		stderr: "pipe",
	})

	const result = await Promise.race([
		proc.exited,
		new Promise<never>((_, reject) =>
			setTimeout(() => {
				proc.kill()
				reject(new Error(`${cmdArgs[0]}: timed out`))
			}, CMD_TIMEOUT),
		),
	])

	if (result !== 0) {
		const stderr = await new Response(proc.stderr).text()
		throw new Error(`${cmdArgs[0]}: ${stderr.trim() || `exit code ${result}`}`)
	}

	return (await new Response(proc.stdout).text()).trim()
}

export async function suggest(
	cmdArgs: string[],
	promptDirections: string,
	ticketKey: string,
	summary: string,
	description?: string,
): Promise<string[]> {
	let prompt = `${promptDirections}\n\nTicket: ${ticketKey}\nSummary: ${summary}`
	if (description) {
		const desc = description.length > 2000 ? description.slice(0, 2000) : description
		prompt += `\nDescription:\n${desc}`
	}

	const result = await runCommand(cmdArgs, prompt)

	return result
		.split("\n")
		.map((line) =>
			line
				.trim()
				.replace(/^[\d.\-) ]+/, "")
				.trim(),
		)
		.filter(Boolean)
}

export async function describe(
	cmdArgs: string[],
	promptDirections: string,
	diff: string,
): Promise<string> {
	const prompt = `${promptDirections}\n\n${diff}`
	return runCommand(cmdArgs, prompt)
}

export async function reply(
	cmdArgs: string[],
	promptDirections: string,
	comment: string,
	context: string,
): Promise<string> {
	const prompt = `${promptDirections}\n\nComment:\n${comment}\n\nContext:\n${context}`
	return runCommand(cmdArgs, prompt)
}

export interface RankedCandidate {
	index: number
	rationale: string
}

export async function triage(
	cmdArgs: string[],
	promptDirections: string,
	candidates: { source: string; key: string; title: string; body?: string }[],
): Promise<RankedCandidate[]> {
	if (candidates.length === 0) return []

	const listed = candidates
		.map((c, i) => {
			const head = `${i + 1}. [${c.source}] ${c.key} — ${c.title}`
			const bodyLine = c.body ? `\n   ${c.body.slice(0, 300).replace(/\n/g, " ")}` : ""
			return head + bodyLine
		})
		.join("\n")

	const prompt = `${promptDirections}\n\nCandidates:\n${listed}`
	const result = await runCommand(cmdArgs, prompt)

	const ranked: RankedCandidate[] = []
	for (const raw of result.split("\n")) {
		const line = raw.trim().replace(/^[-*]\s*/, "")
		if (!line) continue
		const m = line.match(/^(\d+)\s*[:.)-]\s*(.*)$/)
		if (!m) continue
		const idx = Number.parseInt(m[1], 10) - 1
		if (idx < 0 || idx >= candidates.length) continue
		ranked.push({ index: idx, rationale: m[2].trim() })
	}
	return ranked
}

export interface IntakePlan {
	summary: string
	tasks: string[]
	descriptionDraft: string
	commentDraft: string
}

export async function plan(
	cmdArgs: string[],
	promptDirections: string,
	candidate: { source: string; key: string; title: string; body?: string },
): Promise<IntakePlan> {
	const context = [
		`Source: ${candidate.source}`,
		`Key: ${candidate.key}`,
		`Title: ${candidate.title}`,
		candidate.body ? `Body:\n${candidate.body}` : "",
	]
		.filter(Boolean)
		.join("\n")

	const prompt = `${promptDirections}\n\n${context}`
	const result = await runCommand(cmdArgs, prompt)

	return parsePlan(result)
}

export function parsePlan(text: string): IntakePlan {
	const sections: Record<string, string> = {}
	let current: string | null = null
	const buf: string[] = []

	const flush = () => {
		if (current) sections[current] = buf.join("\n").trim()
		buf.length = 0
	}

	for (const line of text.split("\n")) {
		const h = line.match(/^##\s+(Summary|Tasks|Description|Comment)\s*$/i)
		if (h) {
			flush()
			current = h[1].toLowerCase()
			continue
		}
		if (current) buf.push(line)
	}
	flush()

	const tasks = (sections.tasks ?? "")
		.split("\n")
		.map((l) =>
			l
				.trim()
				.replace(/^[-*\d.)\s]+/, "")
				.trim(),
		)
		.filter(Boolean)

	return {
		summary: sections.summary ?? "",
		tasks,
		descriptionDraft: sections.description ?? "",
		commentDraft: sections.comment ?? "",
	}
}

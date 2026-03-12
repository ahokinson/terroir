import type { SlackIntegration, SlackMention } from "@integrations/types"
import { exec, execJson } from "@lib/cli"

export interface SlackConfig {
	listMentionsTriggerId: string
	postMessageTriggerId: string
}

interface TriggerMentionsResponse {
	mentions: SlackMention[]
}

async function invokeTrigger<T>(triggerId: string, payload: unknown): Promise<T> {
	return execJson<T>("slack", [
		"trigger",
		"invoke",
		"--trigger-id",
		triggerId,
		"--payload",
		JSON.stringify(payload),
	])
}

async function invokeTriggerVoid(triggerId: string, payload: unknown): Promise<void> {
	await exec("slack", [
		"trigger",
		"invoke",
		"--trigger-id",
		triggerId,
		"--payload",
		JSON.stringify(payload),
	])
}

export function createSlackIntegration(config: SlackConfig): SlackIntegration | null {
	if (!config.listMentionsTriggerId && !config.postMessageTriggerId) return null

	return {
		async listMentions(sinceIso) {
			if (!config.listMentionsTriggerId) return []
			try {
				const result = await invokeTrigger<TriggerMentionsResponse>(config.listMentionsTriggerId, {
					since: sinceIso,
				})
				return result.mentions ?? []
			} catch {
				return []
			}
		},

		async postMessage(target, body) {
			if (!config.postMessageTriggerId) return
			await invokeTriggerVoid(config.postMessageTriggerId, {
				channel: target,
				text: body,
			})
		},
	}
}

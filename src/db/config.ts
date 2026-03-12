import type { Repos } from "@db/queries/repos"
import type { MonitorConfig } from "@monitor/types"

export type { MonitorConfig }

export const defaultSettings: Record<string, string> = {
	staleness_days: "14",
	ticket_ttl: "5",
	log_limit: "15",
	status_timeout: "3",
	http_timeout: "5",
	ai_provider: "claude",
	ai_model: "",
	discover_exclude_branches: "main,master,develop,development,staging,production",
	discover_fuzzy_threshold: "0.6",
	discover_ignored_tokens:
		"add,fix,update,create,remove,delete,change,refactor,improve,implement,move,rename,clean,bump,get,set,use,make,feat,feature,chore,hotfix,bugfix,wip,the,for,and,with,in,on,of,to,a,an",
	monitor_enabled: "true",
	monitor_fast_interval: "30000",
	monitor_medium_interval: "120000",
	monitor_slow_interval: "300000",
	monitor_reactive_feedback: "false",
	monitor_lifecycle_pipeline: "false",
	monitor_review_boost_factor: "2",
	discover_auto_import_projects: "",
	discover_auto_import_epic: "Inbox",
	notifications_enabled: "false",
	security_aikido_enabled: "false",
	security_orca_enabled: "false",
	security_sumo_enabled: "false",
	security_sumo_repo_queries: "",
	security_sumo_result_limit: "100",
	signals_sentry_enabled: "false",
	signals_sentry_organization: "",
	signals_sentry_project_map: "",
	signals_datadog_enabled: "false",
	signals_datadog_site: "datadoghq.com",
	signals_datadog_project_map: "",
	signals_datadog_min_poll_seconds: "600",
}

export const defaultSuggestPrompt =
	"Given this ticket, suggest 3-6 concise development tasks (implementation subtasks, not process steps). " +
	"Output ONLY a plain list, one task per line, no bullets, no numbers, no extra text."

export const defaultDescribePRPrompt =
	"Generate a clear, concise pull request description in markdown. " +
	"Include a brief summary of changes and their purpose. " +
	"Output ONLY the description text, no extra commentary."

export const defaultDescribeTicketPrompt =
	"Generate a clear ticket description based on the branch changes. " +
	"Output ONLY the description text, no extra commentary."

export const defaultReplyPrompt =
	"Write a concise, helpful reply to this code review comment. " + "Output ONLY the reply text."

export const defaultTriagePrompt =
	"You are triaging candidate work items. Rank the candidates by which are the best low-hanging fruit to tackle next, " +
	"considering clarity of ask, estimated effort, and blocking impact. " +
	"Return ONLY a ranked list, one per line, in this exact format:\n" +
	"<index>: <one-line rationale>\n" +
	"where <index> is the number from the input list. " +
	"Include only the top candidates you recommend; omit ones that are unclear, stale, or not worth doing. " +
	"No preamble, no headers, no extra commentary."

export const defaultPlanPrompt =
	"You are planning the work for a single candidate. Produce a plan in this exact markdown format:\n\n" +
	"## Summary\n<two-sentence summary of what needs to be done>\n\n" +
	"## Tasks\n- <task 1>\n- <task 2>\n- ...\n\n" +
	"## Description\n<updated ticket/issue description, markdown>\n\n" +
	"## Comment\n<short comment to post on the ticket announcing the plan>\n\n" +
	"Output ONLY those four sections in that order. Use realistic, scoped tasks."

export interface Config {
	projectsRoot: string | null
	stalenessDays: number
	ticketTtl: number
	logLimit: number
	statusTimeout: number
	httpTimeout: number
	ai: AiConfig
	discover: DiscoverConfig
	monitor: MonitorConfig
	notifications: NotificationsConfig
	security: SecurityConfig
	signals: SignalsConfig
}

export interface NotificationsConfig {
	enabled: boolean
}

export interface SecurityConfig {
	aikidoEnabled: boolean
	orcaEnabled: boolean
	sumoEnabled: boolean
	sumoRepoQueries: Record<string, string>
	sumoResultLimit: number
}

export interface SentryConfigEntry {
	enabled: boolean
	organization: string
	projectMap: Record<string, string>
}

export interface DatadogConfigEntry {
	enabled: boolean
	site: string
	projectMap: Record<string, string>
	minPollSeconds: number
}

export interface SignalsConfig {
	sentry: SentryConfigEntry
	datadog: DatadogConfigEntry
}

export interface AiConfig {
	provider: string
	model: string
}

export interface DiscoverConfig {
	excludeBranches: string[]
	fuzzyThreshold: number
	ignoredTokens: string[]
	autoImportProjects: string[]
	autoImportEpic: string
}

export function loadConfig(repos: Repos): Config {
	const s = repos.settings.all()
	const get = (key: string): string => s[key] ?? defaultSettings[key] ?? ""

	return {
		projectsRoot: s.projects_root ?? null,
		stalenessDays: Number.parseInt(get("staleness_days"), 10),
		ticketTtl: Number.parseInt(get("ticket_ttl"), 10),
		logLimit: Number.parseInt(get("log_limit"), 10),
		statusTimeout: Number.parseInt(get("status_timeout"), 10),
		httpTimeout: Number.parseInt(get("http_timeout"), 10),
		ai: {
			provider: get("ai_provider"),
			model: get("ai_model"),
		},
		discover: {
			excludeBranches: get("discover_exclude_branches").split(",").filter(Boolean),
			fuzzyThreshold: Number.parseFloat(get("discover_fuzzy_threshold")),
			ignoredTokens: get("discover_ignored_tokens").split(",").filter(Boolean),
			autoImportProjects: get("discover_auto_import_projects").split(",").filter(Boolean),
			autoImportEpic: get("discover_auto_import_epic"),
		},
		monitor: {
			enabled: get("monitor_enabled") === "true",
			fastIntervalMs: Number.parseInt(get("monitor_fast_interval"), 10),
			mediumIntervalMs: Number.parseInt(get("monitor_medium_interval"), 10),
			slowIntervalMs: Number.parseInt(get("monitor_slow_interval"), 10),
			reactiveFeedback: get("monitor_reactive_feedback") === "true",
			lifecyclePipeline: get("monitor_lifecycle_pipeline") === "true",
			reviewBoostFactor: Number.parseInt(get("monitor_review_boost_factor"), 10),
		},
		notifications: {
			enabled: get("notifications_enabled") === "true",
		},
		security: {
			aikidoEnabled: get("security_aikido_enabled") === "true",
			orcaEnabled: get("security_orca_enabled") === "true",
			sumoEnabled: get("security_sumo_enabled") === "true",
			sumoRepoQueries: parseStringMap(get("security_sumo_repo_queries")),
			sumoResultLimit: Number.parseInt(get("security_sumo_result_limit"), 10),
		},
		signals: {
			sentry: {
				enabled: get("signals_sentry_enabled") === "true",
				organization: get("signals_sentry_organization"),
				projectMap: parseStringMap(get("signals_sentry_project_map")),
			},
			datadog: {
				enabled: get("signals_datadog_enabled") === "true",
				site: get("signals_datadog_site"),
				projectMap: parseStringMap(get("signals_datadog_project_map")),
				minPollSeconds: Number.parseInt(get("signals_datadog_min_poll_seconds"), 10),
			},
		},
	}
}

function parseStringMap(raw: string): Record<string, string> {
	if (!raw) return {}
	try {
		const parsed = JSON.parse(raw)
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
		const out: Record<string, string> = {}
		for (const [k, v] of Object.entries(parsed)) {
			if (typeof v === "string") out[k] = v
		}
		return out
	} catch {
		return {}
	}
}

export function seedDefaults(repos: Repos): void {
	const existing = repos.settings.all()
	if (Object.keys(existing).length > 0) return

	for (const [key, value] of Object.entries(defaultSettings)) {
		repos.settings.set(key, value)
	}
}

export function updateSetting(repos: Repos, key: string, value: string): void {
	repos.settings.set(key, value)
}

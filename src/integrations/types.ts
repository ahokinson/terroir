import { RemoteIcon } from "@tui/icons"

export enum RemoteType {
	GitHub = "github",
	GitLab = "gitlab",
	Unknown = "unknown",
}

export enum PRState {
	Open = "open",
	Opened = "opened",
	Closed = "closed",
	Merged = "merged",
	Draft = "draft",
}

export const PR_OPEN_STATES: ReadonlySet<PRState> = new Set([PRState.Open, PRState.Opened])

export enum PipelineStatus {
	Success = "success",
	Failure = "failure",
	Failed = "failed",
	Error = "error",
	Running = "running",
	Pending = "pending",
	Canceled = "canceled",
}

export const PIPELINE_FAILURE_STATES: ReadonlySet<PipelineStatus> = new Set([
	PipelineStatus.Failure,
	PipelineStatus.Failed,
	PipelineStatus.Error,
])

export interface RemoteIdentity {
	email: string
	name: string
}

export interface LocalRepo {
	name: string
	path: string
	remote: string
	host: RemoteType
	slug: string | null
	branch: string
	branches: string[]
}

export interface ReviewComment {
	id: number
	author: string
	body: string
	path: string | null
	line: number | null
	createdAt: string
}

export interface PullRequest {
	id: number
	title: string
	state: PRState
	url: string
	author: string
	draft: boolean
	approvals: number
	createdAt: string
	updatedAt: string
	body: string
	requestedReviewers: string[]
	repoSlug?: string
}

export interface Pipeline {
	id: number
	status: PipelineStatus
	url: string
	ref: string
	createdAt: string
}

export interface LinkedIssue {
	key: string
	title: string
	status: string
	url: string
}

export interface RemoteIssue {
	key: string
	title: string
	state: string
	url: string
	body: string
	assignee: string | null
	labels: string[]
	projectPath: string
}

export interface GitIntegration {
	prsForBranch(slug: string, branch: string): Promise<PullRequest[]>
	pipelineForBranch(slug: string, branch: string): Promise<Pipeline | null>
	linkedIssues(slug: string, prId: number): Promise<LinkedIssue[]>
	userPRs(slug: string): Promise<PullRequest[]>
	reviewComments(slug: string, prId: number): Promise<ReviewComment[]>
	ciFailureSummary(slug: string, runId: number): Promise<string>
	currentUser(): Promise<{ username: string } | null>
	listAssignedIssues(): Promise<RemoteIssue[]>
	listMrsForReview(): Promise<PullRequest[]>
	listMyOpenPRs(): Promise<PullRequest[]>
}

export interface TicketIssue {
	key: string
	summary: string
	description: string
	status: string
	type: string
	epic: string
	assignee: string | null
	url: string
}

export interface TicketTransition {
	id: string
	name: string
}

export interface SlackMention {
	ts: string
	channel: string
	channelName: string
	permalink: string
	text: string
	author: string
}

export interface SlackIntegration {
	listMentions(sinceIso: string): Promise<SlackMention[]>
	postMessage(target: string, body: string): Promise<void>
}

export interface TicketIntegration {
	search(): Promise<TicketIssue[]>
	getIssue(key: string): Promise<TicketIssue | null>
	getTransitions(key: string): Promise<TicketTransition[]>
	transitionIssue(key: string, transitionId: string): Promise<void>
	addComment(key: string, body: string): Promise<void>
	updateDescription(key: string, body: string): Promise<void>
	assignToMe(key: string): Promise<void>
}

export enum Severity {
	Critical = "critical",
	High = "high",
	Medium = "medium",
	Low = "low",
	Info = "info",
}

export enum SecurityScanner {
	Aikido = "aikido",
	Orca = "orca",
	Sumo = "sumo",
}

export interface SecurityFinding {
	id: string
	scanner: SecurityScanner
	severity: Severity
	title: string
	location: string | null
	url: string | null
	repoPath: string
	branch: string | null
}

export enum ScanStatus {
	Ok = "ok",
	Stale = "stale",
	Error = "error",
	Unconfigured = "unconfigured",
}

export interface SecurityScanResult {
	scanner: SecurityScanner
	repoPath: string
	branch: string | null
	findings: SecurityFinding[]
	scannedAt: number
	status: ScanStatus
	error?: string
}

export interface SecurityIntegration {
	scanner: SecurityScanner
	scanRepo(repoPath: string): Promise<SecurityScanResult>
	scanBranch(repoPath: string, branch: string): Promise<SecurityScanResult>
}

export enum SignalSource {
	Sentry = "sentry",
	Datadog = "datadog",
}

export enum SignalKind {
	RuntimeError = "runtime-error",
	LogEvent = "log-event",
}

export enum SignalStatus {
	Ok = "ok",
	Stale = "stale",
	Error = "error",
	Unconfigured = "unconfigured",
}

export interface Signal {
	id: string
	source: SignalSource
	kind: SignalKind
	severity: Severity
	title: string
	url: string | null
	repoPath: string
	branch: string | null
	count: number
	firstSeen: number
	lastSeen: number
}

export interface SignalScanResult {
	source: SignalSource
	repoPath: string
	branch: string | null
	signals: Signal[]
	scannedAt: number
	status: SignalStatus
	error?: string
}

export interface SignalProvider {
	source: SignalSource
	scanRepo(repoPath: string): Promise<SignalScanResult>
	scanBranch(repoPath: string, branch: string): Promise<SignalScanResult>
}

export function detectRemote(remoteUrl: string): RemoteType {
	const u = remoteUrl.toLowerCase()
	if (u.includes("github.com") || u.includes("github")) return RemoteType.GitHub
	if (u.includes("gitlab")) return RemoteType.GitLab
	return RemoteType.Unknown
}

export function parseRepoSlug(remoteUrl: string): string | null {
	const sshMatch = remoteUrl.match(/:([^/]+\/[^/]+?)(?:\.git)?$/)
	if (sshMatch) return sshMatch[1]

	const httpsMatch = remoteUrl.match(/\/([^/]+\/[^/]+?)(?:\.git)?$/)
	if (httpsMatch) return httpsMatch[1]

	return null
}

export function remoteIcon(host: RemoteType): string {
	return RemoteIcon[host] ?? RemoteIcon.unknown
}

export function isTicketDone(status: string | null | undefined): boolean {
	if (!status) return false
	const s = status.toLowerCase()
	return s.includes("done") || s.includes("closed") || s.includes("production")
}

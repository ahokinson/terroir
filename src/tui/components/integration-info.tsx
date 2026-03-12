import type { LinkedIssue, Pipeline, PullRequest } from "@integrations/types"
import type { ThemeColors } from "@tui/contexts/theme"
import { Icon } from "@tui/icons"
import { createScrollboxOptions } from "@tui/layout"
import { pipelineIndicator } from "@tui/stores/pipeline"
import { For, Show } from "solid-js"

interface IntegrationInfoProps {
	prs: PullRequest[]
	pipeline: Pipeline | null
	linked: LinkedIssue[]
	theme: ThemeColors
}

export function IntegrationInfo(props: IntegrationInfoProps) {
	const empty = () => props.prs.length === 0 && !props.pipeline && props.linked.length === 0

	const scrollboxOptions = createScrollboxOptions(props.theme)

	return (
		<Show
			when={!empty()}
			fallback={<text fg={props.theme.textDim}>No PR, pipeline, or linked issue data</text>}
		>
			<scrollbox flexGrow={1} {...scrollboxOptions}>
				<box flexDirection="column" flexShrink={0}>
					<Show when={props.prs.length > 0}>
						<text fg={props.theme.accent}>
							<b>Pull Requests</b>
						</text>
						<For each={props.prs}>
							{(pr) => {
								const state = pr.draft ? "draft" : pr.state
								const approvalStr = pr.approvals > 0 ? ` (${pr.approvals} approvals)` : ""
								return (
									<box height={1} flexDirection="row" gap={1}>
										<text fg={props.theme.secondary}>#{pr.id}</text>
										<text fg={props.theme.textDim}>
											{state}
											{approvalStr}
										</text>
										<text fg={props.theme.text} wrapMode="none">
											{pr.title}
										</text>
									</box>
								)
							}}
						</For>
						<box height={1} />
					</Show>

					<Show when={props.pipeline}>
						{(p) => {
							const pi = () => pipelineIndicator(p().status, props.theme)
							return (
								<>
									<text fg={props.theme.accent}>
										<b>Pipeline</b>
									</text>
									<box height={1} flexDirection="row" gap={1}>
										<text fg={props.theme.textDim}>#{p().id}</text>
										<text fg={pi().color}>
											{Icon.pipelineRef.char} {pi().icon}
										</text>
										<text fg={pi().color}>{p().status}</text>
										<text fg={props.theme.textDim}>{p().ref}</text>
									</box>
									<box height={1} />
								</>
							)
						}}
					</Show>

					<Show when={props.linked.length > 0}>
						<text fg={props.theme.accent}>
							<b>Linked Issues</b>
						</text>
						<For each={props.linked}>
							{(issue) => (
								<box height={1} flexDirection="row" gap={1}>
									<text fg={props.theme.secondary}>{issue.key}</text>
									<text fg={props.theme.textDim}>[{issue.status}]</text>
									<text fg={props.theme.text} wrapMode="none">
										{issue.title}
									</text>
								</box>
							)}
						</For>
					</Show>
				</box>
			</scrollbox>
		</Show>
	)
}

import { remoteIcon } from "@integrations/types"
import { useTheme } from "@tui/contexts/theme"
import { Icon } from "@tui/icons"
import { createScrollboxOptions, NestedIndent } from "@tui/layout"
import { useEpics } from "@tui/stores/epics"
import { useRepos } from "@tui/stores/repos"
import { createMemo, For, Show } from "solid-js"

export function RepositoriesPanel() {
	const repos = useRepos()
	const store = useEpics()
	const theme = useTheme()
	const scrollboxOptions = createScrollboxOptions(theme)

	const trackedPaths = createMemo(() => {
		const paths = new Set<string>()
		for (const epic of store.epics) {
			for (const story of epic.stories) {
				for (const repo of story.repositories) {
					paths.add(repo.path)
				}
			}
		}
		return paths
	})

	return (
		<scrollbox flexGrow={1} {...scrollboxOptions}>
			<box flexDirection="column" flexShrink={0}>
				<Show
					when={!repos.scanning}
					fallback={
						<box paddingLeft={1}>
							<text fg={theme.textDim}>Scanning for repos...</text>
						</box>
					}
				>
					<Show
						when={repos.repos.length > 0}
						fallback={
							<box paddingLeft={1}>
								<text fg={theme.textDim}>No repositories found</text>
							</box>
						}
					>
						<For each={repos.repos}>
							{(repo, i) => {
								const isTracked = () => trackedPaths().has(repo.path)
								return (
									<>
										<box
											height={1}
											paddingLeft={1}
											flexDirection="row"
											gap={1}
											backgroundColor={i() === repos.cursor ? theme.bgElement : theme.transparent}
										>
											<text fg={isTracked() ? theme.accent : theme.textDim}>
												{remoteIcon(repo.host)}
											</text>
											<text fg={theme.text}>{repo.name}</text>
											<Show when={isTracked()}>
												<text fg={theme.warning}>{Icon.warning.char}</text>
											</Show>
											<text fg={theme.textDim}>{repo.branch}</text>
										</box>
										<Show when={repos.expanded === i()}>
											<For each={repo.branches}>
												{(branch) => (
													<box height={1} paddingLeft={NestedIndent}>
														<text fg={branch === repo.branch ? theme.accent : theme.textMuted}>
															{branch === repo.branch ? "* " : "  "}
															{branch}
														</text>
													</box>
												)}
											</For>
										</Show>
									</>
								)
							}}
						</For>
					</Show>
				</Show>
			</box>
		</scrollbox>
	)
}

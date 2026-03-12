import { BranchView } from "@tui/routes/views/branch"
import { EpicView } from "@tui/routes/views/epic"
import { RepoView } from "@tui/routes/views/repo"
import { StoriesView } from "@tui/routes/views/stories"
import { StoryView } from "@tui/routes/views/story"
import { useRoute, View } from "@tui/stores/route"
import { Match, Switch } from "solid-js"

export function Router() {
	const route = useRoute()

	return (
		<Switch>
			<Match when={route.view === View.Dashboard}>
				<StoriesView />
			</Match>
			<Match when={route.view === View.Epic}>
				<EpicView />
			</Match>
			<Match when={route.view === View.Story}>
				<StoryView />
			</Match>
			<Match when={route.view === View.Repo}>
				<RepoView />
			</Match>
			<Match when={route.view === View.Branch}>
				<BranchView />
			</Match>
		</Switch>
	)
}

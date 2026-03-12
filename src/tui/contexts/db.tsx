import { type DB, openDatabase } from "@db"
import { createRepos, type Repos } from "@db/queries/repos"
import { createSimpleContext } from "@tui/lib/context"

export const { provider: DatabaseProvider, use: useDB } = createSimpleContext<
	{ db: DB; repos: Repos },
	{ path?: string }
>({
	name: "Database",
	init: (props) => {
		const { db, sqlite } = openDatabase(props.path)
		return { db, repos: createRepos(db) }
	},
})

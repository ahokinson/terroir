import type { DB } from "@db"
import { Epics } from "@db/queries/epics"
import { Events } from "@db/queries/events"
import { Feedback } from "@db/queries/feedback"
import { Settings } from "@db/queries/settings"
import { Suggestions } from "@db/queries/suggestions"

export interface Repos {
	epics: Epics
	settings: Settings
	feedback: Feedback
	events: Events
	suggestions: Suggestions
}

export function createRepos(db: DB): Repos {
	return {
		epics: new Epics(db),
		settings: new Settings(db),
		feedback: new Feedback(db),
		events: new Events(db),
		suggestions: new Suggestions(db),
	}
}

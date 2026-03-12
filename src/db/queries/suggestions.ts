import type { DB } from "@db"
import * as s from "@db/schema"

export class Suggestions {
	constructor(private db: DB) {}

	loadDismissedKeys(): Set<string> {
		const rows = this.db
			.select({ key: s.dismissedSuggestions.key })
			.from(s.dismissedSuggestions)
			.all()
		return new Set(rows.map((r) => r.key))
	}

	dismiss(key: string): void {
		this.db
			.insert(s.dismissedSuggestions)
			.values({ key, dismissedAt: new Date().toISOString() })
			.onConflictDoNothing()
			.run()
	}

	clear(): void {
		this.db.delete(s.dismissedSuggestions).run()
	}
}

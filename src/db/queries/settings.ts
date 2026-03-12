import type { DB } from "@db"
import * as s from "@db/schema"
import { eq } from "drizzle-orm"

export class Settings {
	constructor(private db: DB) {}

	get(key: string): string | null {
		const row = this.db
			.select({ value: s.settings.value })
			.from(s.settings)
			.where(eq(s.settings.key, key))
			.get()
		return row?.value ?? null
	}

	set(key: string, value: string): void {
		this.db
			.insert(s.settings)
			.values({ key, value })
			.onConflictDoUpdate({ target: s.settings.key, set: { value } })
			.run()
	}

	all(): Record<string, string> {
		const rows = this.db.select().from(s.settings).all()
		const result: Record<string, string> = {}
		for (const row of rows) {
			result[row.key] = row.value
		}
		return result
	}
}

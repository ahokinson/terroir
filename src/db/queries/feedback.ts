import type { DB } from "@db"
import * as s from "@db/schema"
import type { FeedbackSource } from "@db/types"
import { and, eq } from "drizzle-orm"

export class Feedback {
	constructor(private db: DB) {}

	getHash(storyKey: string): string | null {
		const row = this.db
			.select({ hash: s.feedbackHashes.hash })
			.from(s.feedbackHashes)
			.where(eq(s.feedbackHashes.storyKey, storyKey))
			.get()
		return row?.hash ?? null
	}

	setHash(storyKey: string, hash: string): void {
		this.db
			.insert(s.feedbackHashes)
			.values({ storyKey, hash })
			.onConflictDoUpdate({ target: s.feedbackHashes.storyKey, set: { hash } })
			.run()
	}

	hasItem(storyKey: string, source: FeedbackSource, extId: string): boolean {
		const row = this.db
			.select({ id: s.feedbackItems.id })
			.from(s.feedbackItems)
			.where(
				and(
					eq(s.feedbackItems.storyKey, storyKey),
					eq(s.feedbackItems.source, source),
					eq(s.feedbackItems.extId, extId),
				),
			)
			.get()
		return row !== undefined
	}

	addItem(storyKey: string, source: FeedbackSource, extId: string, summary: string): void {
		this.db
			.insert(s.feedbackItems)
			.values({ storyKey, source, extId, summary, createdAt: new Date().toISOString() })
			.onConflictDoNothing()
			.run()
	}
}

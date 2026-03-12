import type { DB } from "@db"
import * as s from "@db/schema"
import type { MonitorEvent } from "@monitor/types"
import { toEventType } from "@monitor/types"
import { and, desc, eq } from "drizzle-orm"

function rowToEvent(r: typeof s.events.$inferSelect): MonitorEvent {
	return {
		id: r.id,
		type: toEventType(r.type),
		timestamp: r.timestamp,
		storyName: r.storyName,
		summary: r.summary,
		read: r.read === 1,
		dismissed: r.dismissed === 1,
	}
}

export class Events {
	constructor(private db: DB) {}

	insert(ev: MonitorEvent): number {
		const result = this.db
			.insert(s.events)
			.values({
				type: ev.type,
				timestamp: ev.timestamp,
				storyName: ev.storyName,
				summary: ev.summary,
				read: ev.read ? 1 : 0,
				dismissed: ev.dismissed ? 1 : 0,
			})
			.returning({ id: s.events.id })
			.get()
		return result.id
	}

	list(limit = 200): MonitorEvent[] {
		const rows = this.db
			.select()
			.from(s.events)
			.orderBy(desc(s.events.timestamp), desc(s.events.id))
			.limit(limit)
			.all()

		return rows.map(rowToEvent)
	}

	listForStory(
		storyName: string,
		opts: { includeDismissed?: boolean; limit?: number } = {},
	): MonitorEvent[] {
		const limit = opts.limit ?? 50
		const where = opts.includeDismissed
			? eq(s.events.storyName, storyName)
			: and(eq(s.events.storyName, storyName), eq(s.events.dismissed, 0))
		const rows = this.db
			.select()
			.from(s.events)
			.where(where)
			.orderBy(desc(s.events.timestamp), desc(s.events.id))
			.limit(limit)
			.all()
		return rows.map(rowToEvent)
	}

	markRead(id: number): void {
		this.db.update(s.events).set({ read: 1 }).where(eq(s.events.id, id)).run()
	}

	markAllReadForStory(storyName: string): void {
		this.db.update(s.events).set({ read: 1 }).where(eq(s.events.storyName, storyName)).run()
	}

	dismiss(id: number): void {
		this.db.update(s.events).set({ dismissed: 1, read: 1 }).where(eq(s.events.id, id)).run()
	}

	dismissAllForStory(storyName: string): void {
		this.db
			.update(s.events)
			.set({ dismissed: 1, read: 1 })
			.where(eq(s.events.storyName, storyName))
			.run()
	}
}

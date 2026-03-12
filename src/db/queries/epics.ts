import type { DB } from "@db"
import * as s from "@db/schema"
import {
	type Branch,
	type Epic,
	type Repository,
	type Story,
	type Task,
	toLifecycleStage,
	toStatus,
	toStoryType,
} from "@db/types"

function groupBy<T, K, V>(items: T[], key: (item: T) => K, value: (item: T) => V): Map<K, V[]> {
	const map = new Map<K, V[]>()
	for (const item of items) {
		const k = key(item)
		const list = map.get(k) ?? []
		list.push(value(item))
		map.set(k, list)
	}
	return map
}

export class Epics {
	constructor(private db: DB) {}

	loadAll(): Epic[] {
		const epicRows = this.db
			.select({ id: s.epics.id, name: s.epics.name, source: s.epics.source })
			.from(s.epics)
			.orderBy(s.epics.position, s.epics.id)
			.all()

		const storyRows = this.db
			.select({
				id: s.stories.id,
				epicId: s.stories.epicId,
				name: s.stories.name,
				type: s.stories.type,
				ticket: s.stories.ticket,
				source: s.stories.source,
				createdAt: s.stories.createdAt,
				completedAt: s.stories.completedAt,
				lifecycleStage: s.stories.lifecycleStage,
				autoImported: s.stories.autoImported,
			})
			.from(s.stories)
			.orderBy(s.stories.epicId, s.stories.position, s.stories.id)
			.all()

		const repoRows = this.db
			.select({ id: s.repositories.id, storyId: s.repositories.storyId, path: s.repositories.path })
			.from(s.repositories)
			.orderBy(s.repositories.storyId, s.repositories.position, s.repositories.id)
			.all()

		const branchRows = this.db
			.select({
				repositoryId: s.branches.repositoryId,
				name: s.branches.name,
				baseBranch: s.branches.baseBranch,
			})
			.from(s.branches)
			.orderBy(s.branches.repositoryId, s.branches.position, s.branches.id)
			.all()

		const taskRows = this.db
			.select({
				storyId: s.tasks.storyId,
				extId: s.tasks.extId,
				title: s.tasks.title,
				status: s.tasks.status,
				createdAt: s.tasks.createdAt,
				updatedAt: s.tasks.updatedAt,
				completedAt: s.tasks.completedAt,
			})
			.from(s.tasks)
			.orderBy(s.tasks.storyId, s.tasks.position, s.tasks.id)
			.all()

		const branchesByRepo = groupBy(
			branchRows,
			(b) => b.repositoryId,
			(b): Branch => ({ name: b.name, baseBranch: b.baseBranch }),
		)

		const reposByStory = groupBy(
			repoRows,
			(r) => r.storyId,
			(r): Repository => ({ path: r.path, branches: branchesByRepo.get(r.id) ?? [] }),
		)

		const tasksByStory = groupBy(
			taskRows,
			(t) => t.storyId,
			(t): Task => ({
				id: t.extId,
				title: t.title,
				status: toStatus(t.status),
				createdAt: t.createdAt,
				updatedAt: t.updatedAt,
				completedAt: t.completedAt,
			}),
		)

		const storiesByEpic = groupBy(
			storyRows,
			(st) => st.epicId,
			(st): Story => ({
				name: st.name,
				type: toStoryType(st.type),
				ticket: st.ticket,
				source: st.source,
				createdAt: st.createdAt,
				completedAt: st.completedAt,
				lifecycleStage: toLifecycleStage(st.lifecycleStage),
				autoImported: st.autoImported === 1,
				tasks: tasksByStory.get(st.id) ?? [],
				repositories: reposByStory.get(st.id) ?? [],
			}),
		)

		return epicRows.map((e) => ({
			name: e.name,
			source: e.source,
			stories: storiesByEpic.get(e.id) ?? [],
		}))
	}

	saveAll(epics: Epic[]): void {
		this.db.transaction((tx) => {
			tx.delete(s.epics).run()

			for (let ei = 0; ei < epics.length; ei++) {
				const epic = epics[ei]
				const epicResult = tx
					.insert(s.epics)
					.values({ name: epic.name, source: epic.source, position: ei })
					.returning({ id: s.epics.id })
					.get()

				for (let si = 0; si < epic.stories.length; si++) {
					const story = epic.stories[si]
					const storyResult = tx
						.insert(s.stories)
						.values({
							epicId: epicResult.id,
							name: story.name,
							type: story.type,
							ticket: story.ticket,
							source: story.source,
							createdAt: story.createdAt,
							completedAt: story.completedAt,
							lifecycleStage: story.lifecycleStage,
							autoImported: story.autoImported ? 1 : 0,
							position: si,
						})
						.returning({ id: s.stories.id })
						.get()

					for (let ri = 0; ri < story.repositories.length; ri++) {
						const repo = story.repositories[ri]
						const repoResult = tx
							.insert(s.repositories)
							.values({ storyId: storyResult.id, path: repo.path, position: ri })
							.returning({ id: s.repositories.id })
							.get()

						for (let bi = 0; bi < repo.branches.length; bi++) {
							const branch = repo.branches[bi]
							tx.insert(s.branches)
								.values({
									repositoryId: repoResult.id,
									name: branch.name,
									baseBranch: branch.baseBranch,
									position: bi,
								})
								.run()
						}
					}

					for (let ti = 0; ti < story.tasks.length; ti++) {
						const task = story.tasks[ti]
						tx.insert(s.tasks)
							.values({
								storyId: storyResult.id,
								extId: task.id,
								title: task.title,
								status: task.status,
								createdAt: task.createdAt,
								updatedAt: task.updatedAt,
								completedAt: task.completedAt,
								position: ti,
							})
							.run()
					}
				}
			}
		})
	}
}

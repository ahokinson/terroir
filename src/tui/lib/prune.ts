import type { Epic } from "@db/types"

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface PruneItem {
	epicIndex: number
	storyIndex: number
	epicName: string
	storyName: string
	reason: string
	selected: boolean
}

export function collectStale(epics: Epic[], stalenessDays: number): PruneItem[] {
	const now = Date.now()
	const staleMs = stalenessDays * MS_PER_DAY
	const items: PruneItem[] = []

	for (let ei = 0; ei < epics.length; ei++) {
		const epic = epics[ei]
		for (let si = 0; si < epic.stories.length; si++) {
			const story = epic.stories[si]

			if (story.completedAt) {
				const completedMs = new Date(story.completedAt).getTime()
				if (now - completedMs > staleMs) {
					items.push({
						epicIndex: ei,
						storyIndex: si,
						epicName: epic.name,
						storyName: story.name,
						reason: `Completed ${Math.floor((now - completedMs) / MS_PER_DAY)}d ago`,
						selected: false,
					})
				}
				continue
			}

			if (story.tasks.length === 0 && story.repositories.length === 0) {
				const createdMs = new Date(story.createdAt).getTime()
				if (now - createdMs > staleMs) {
					items.push({
						epicIndex: ei,
						storyIndex: si,
						epicName: epic.name,
						storyName: story.name,
						reason: `Empty, created ${Math.floor((now - createdMs) / MS_PER_DAY)}d ago`,
						selected: false,
					})
				}
			}
		}
	}

	return items
}

export function commitPrune(epics: Epic[], items: PruneItem[]): Epic[] {
	const toRemove = new Set(
		items.filter((i) => i.selected).map((i) => `${i.epicIndex}:${i.storyIndex}`),
	)

	return epics.map((epic, ei) => ({
		...epic,
		stories: epic.stories.filter((_, si) => !toRemove.has(`${ei}:${si}`)),
	}))
}

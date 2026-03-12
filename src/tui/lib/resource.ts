import { createStore } from "solid-js/store"

interface CachedEntry<T> {
	data: T
	loading: boolean
}

export function createCachedResource<T>(defaultValue: T) {
	const [cache, setCache] = createStore<Record<string, CachedEntry<T>>>({})

	return {
		get(key: string): T {
			return cache[key]?.data ?? defaultValue
		},
		isLoading(key: string): boolean {
			return cache[key]?.loading ?? false
		},
		fetch(key: string, fetcher: () => Promise<T>) {
			if (cache[key]?.loading) return
			setCache(key, { data: cache[key]?.data ?? defaultValue, loading: true })
			fetcher()
				.then((data) => setCache(key, { data, loading: false }))
				.catch(() => setCache(key, { data: cache[key]?.data ?? defaultValue, loading: false }))
		},
		clear() {
			for (const key of Object.keys(cache)) {
				setCache(key, undefined!)
			}
		},
	}
}

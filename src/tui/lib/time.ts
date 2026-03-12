const Seconds = {
	Minute: 60,
	Hour: 3600,
	Day: 86400,
	Week: 604800,
	Month: 2592000,
	Year: 31536000,
} as const

const MsPerDay = Seconds.Day * 1000

export function relativeTimeShort(epoch: number): string {
	const now = Math.floor(Date.now() / 1000)
	const diff = now - epoch
	if (diff < Seconds.Minute) return "now"
	if (diff < Seconds.Hour) return `${Math.floor(diff / Seconds.Minute)}m`
	if (diff < Seconds.Day) return `${Math.floor(diff / Seconds.Hour)}h`
	if (diff < Seconds.Week) return `${Math.floor(diff / Seconds.Day)}d`
	if (diff < Seconds.Month) return `${Math.floor(diff / Seconds.Week)}w`
	if (diff < Seconds.Year) return `${Math.floor(diff / Seconds.Month)}mo`
	return `${Math.floor(diff / Seconds.Year)}y`
}

export function relativeTimeFromMs(timestampMs: number): string {
	const diff = Math.floor((Date.now() - timestampMs) / 1000)
	if (diff < Seconds.Minute) return "just now"
	if (diff < Seconds.Hour) return `${Math.floor(diff / Seconds.Minute)}m ago`
	if (diff < Seconds.Day) return `${Math.floor(diff / Seconds.Hour)}h ago`
	return `${Math.floor(diff / Seconds.Day)}d ago`
}

export function relativeTimeLong(date: string | Date): string {
	const then = typeof date === "string" ? new Date(date) : date
	const diff = Date.now() - then.getTime()
	const days = Math.floor(diff / MsPerDay)
	if (days === 0) return "today"
	if (days === 1) return "yesterday"
	if (days < 7) return `${days} days ago`
	if (days < 30) return `${Math.floor(days / 7)} weeks ago`
	if (days < 365) return `${Math.floor(days / 30)} months ago`
	return `${Math.floor(days / 365)} years ago`
}

export function daysSince(date: string): number {
	return Math.floor((Date.now() - new Date(date).getTime()) / MsPerDay)
}

export function epochFromISO(iso: string): number {
	return Math.floor(new Date(iso).getTime() / 1000)
}

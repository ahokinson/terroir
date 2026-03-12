const DEBUG = process.env.TERROIR_DEBUG === "1"

export function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err)
}

export function debug(msg: string, ...args: unknown[]) {
	if (DEBUG) console.error(`[DEBUG] ${msg}`, ...args)
}

export function info(msg: string, ...args: unknown[]) {
	if (DEBUG) console.error(`[INFO] ${msg}`, ...args)
}

export function warn(msg: string, ...args: unknown[]) {
	console.error(`[WARN] ${msg}`, ...args)
}

export function error(msg: string, ...args: unknown[]) {
	console.error(`[ERROR] ${msg}`, ...args)
}

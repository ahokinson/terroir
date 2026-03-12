import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import * as schema from "@db/schema"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"

export type DB = ReturnType<typeof drizzle<typeof schema>>

const MIGRATIONS_FOLDER = join(import.meta.dir, "..", "..", "migration")

export function defaultDbPath(): string {
	return join(homedir(), ".config", "terroir", "terroir.db")
}

export function openDatabase(path?: string): { db: DB; sqlite: Database } {
	const dbPath = path ?? defaultDbPath()
	mkdirSync(join(dbPath, ".."), { recursive: true })

	const sqlite = new Database(dbPath)
	sqlite.run("PRAGMA journal_mode = WAL")
	sqlite.run("PRAGMA foreign_keys = ON")

	const db = drizzle(sqlite, { schema })
	migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

	return { db, sqlite }
}

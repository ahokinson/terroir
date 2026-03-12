import { defineConfig } from "drizzle-kit"
import { join } from "node:path"
import { homedir } from "node:os"

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/db/schema.ts",
	out: "./migration",
	dbCredentials: {
		url: join(homedir(), ".config", "terroir", "terroir.db"),
	},
})

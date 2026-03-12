import { useConfig } from "@tui/contexts/config"
import { useDB } from "@tui/contexts/db"
import { useExit } from "@tui/contexts/exit"
import { useTheme } from "@tui/contexts/theme"
import { createSimpleContext } from "@tui/lib/context"
import { type AppStore, createAppStore } from "@tui/stores/store"

export type { AppStore } from "@tui/stores/store"

export const { provider: AppStoreProvider, use: useAppStore } = createSimpleContext({
	name: "AppStore",
	init: (): AppStore => {
		const { repos } = useDB()
		const cfg = useConfig()
		const theme = useTheme()
		const exit = useExit()
		return createAppStore({
			repos,
			config: () => cfg.config,
			theme,
			onExit: exit.onExit,
		})
	},
})

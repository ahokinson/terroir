import { type Config, loadConfig, seedDefaults, updateSetting } from "@db/config"
import { useDB } from "@tui/contexts/db"
import { createSimpleContext } from "@tui/lib/context"
import { createSignal } from "solid-js"

export const { provider: ConfigProvider, use: useConfig } = createSimpleContext({
	name: "Config",
	init: () => {
		const { repos } = useDB()
		seedDefaults(repos)

		const [config, setConfigSignal] = createSignal<Config>(loadConfig(repos))

		function reload() {
			setConfigSignal(loadConfig(repos))
		}

		function set(key: string, value: string) {
			updateSetting(repos, key, value)
			reload()
		}

		return {
			get config() {
				return config()
			},
			set,
			reload,
		}
	},
})

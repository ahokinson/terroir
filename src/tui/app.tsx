import { ConfigProvider } from "@tui/contexts/config"
import { DatabaseProvider } from "@tui/contexts/db"
import { ExitProvider } from "@tui/contexts/exit"
import { AppStoreProvider } from "@tui/contexts/store"
import { ThemeProvider } from "@tui/contexts/theme"
import { Layout } from "@tui/routes/layout"

export function App(props: { dbPath?: string }) {
	return (
		<ExitProvider>
			<DatabaseProvider path={props.dbPath}>
				<ConfigProvider>
					<ThemeProvider>
						<AppStoreProvider>
							<Layout />
						</AppStoreProvider>
					</ThemeProvider>
				</ConfigProvider>
			</DatabaseProvider>
		</ExitProvider>
	)
}

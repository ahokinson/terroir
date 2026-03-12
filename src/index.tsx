import { createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import { App } from "@tui/app"

const renderer = await createCliRenderer({
	title: "terroir",
	exitOnCtrlC: true,
})

await render(() => <App />, renderer)

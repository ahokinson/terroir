import { flavors } from "@catppuccin/palette"
import { RGBA } from "@opentui/core"
import { createSimpleContext } from "@tui/lib/context"

const f = flavors.frappe.colors
const hex = (color: (typeof f)[keyof typeof f]) => RGBA.fromHex(color.hex)

const defaultTheme = {
	bg: hex(f.base),
	bgPanel: hex(f.mantle),
	bgElement: hex(f.surface0),
	bgElevated: hex(f.surface1),
	bgOverlay: hex(f.surface2),

	text: hex(f.text),
	textSecondary: hex(f.subtext0),
	textMuted: hex(f.overlay2),
	textDim: hex(f.overlay0),

	accent: hex(f.teal),
	secondary: hex(f.blue),
	tertiary: hex(f.lavender),

	success: hex(f.green),
	danger: hex(f.red),
	warning: hex(f.yellow),
	active: hex(f.peach),

	gitClean: hex(f.green),
	gitDirty: hex(f.yellow),
	gitBehind: hex(f.red),
	gitAhead: hex(f.teal),

	taskTodo: hex(f.overlay2),
	taskActive: hex(f.peach),
	taskDone: hex(f.green),

	selection: hex(f.surface1),
	selectionText: hex(f.text),

	transparent: RGBA.fromInts(0, 0, 0, 0),
}

export type ThemeColors = typeof defaultTheme

export const { provider: ThemeProvider, use: useTheme } = createSimpleContext({
	name: "Theme",
	init: () => defaultTheme,
})

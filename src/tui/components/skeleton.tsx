import { useTheme } from "@tui/contexts/theme"
import { ColumnPadding, GlyphWidth } from "@tui/layout"
import { Index } from "solid-js"

interface SkeletonRowsProps {
	count?: number
	width?: number
}

const DefaultRowCount = 3
const DefaultBarWidth = 24
const BarChar = "┄"

export function SkeletonRows(props: SkeletonRowsProps) {
	const theme = useTheme()
	const count = () => props.count ?? DefaultRowCount
	const width = () => props.width ?? DefaultBarWidth

	const rows = () => Array.from({ length: count() }, (_, i) => i)

	return (
		<box flexDirection="column" paddingLeft={ColumnPadding}>
			<Index each={rows()}>
				{(_, i) => (
					<box height={1} flexDirection="row">
						<box width={GlyphWidth} flexShrink={0}>
							<text fg={theme.textDim} wrapMode="none">
								{"   "}
							</text>
						</box>
						<text fg={theme.textDim} wrapMode="none">
							{BarChar.repeat(Math.max(4, width() - (i % 3) * 4))}
						</text>
					</box>
				)}
			</Index>
		</box>
	)
}

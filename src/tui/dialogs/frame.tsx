import type { RGBA } from "@opentui/core"
import { useTheme } from "@tui/contexts/theme"
import { DialogLarge, DialogSmall } from "@tui/layout"
import type { JSX } from "solid-js"

export enum DialogSize {
	Small = "small",
	Large = "large",
}

interface DialogFrameProps {
	children: JSX.Element
	size?: DialogSize
	borderColor?: RGBA
	title?: string
	top?: string | number
	left?: string | number
	width?: string | number
	height?: string | number
	bottom?: number
	paddingLeft?: number
	paddingRight?: number
	paddingTop?: number
}

export function DialogFrame(props: DialogFrameProps) {
	const theme = useTheme()
	const preset = () => (props.size === DialogSize.Large ? DialogLarge : DialogSmall)

	return (
		<box
			position="absolute"
			top={props.top ?? preset().top}
			left={props.left ?? preset().left}
			width={props.width ?? preset().width}
			height={props.height ?? (props.size === DialogSize.Large ? DialogLarge.height : undefined)}
			bottom={props.bottom}
			borderStyle="rounded"
			borderColor={props.borderColor ?? theme.bgOverlay}
			backgroundColor={theme.bgPanel}
			flexDirection="column"
			title={props.title}
			titleAlignment="left"
			paddingLeft={props.paddingLeft ?? preset().padL}
			paddingRight={props.paddingRight ?? preset().padR}
			paddingTop={
				props.paddingTop ?? (props.size === DialogSize.Large ? DialogLarge.padT : undefined)
			}
		>
			{props.children}
		</box>
	)
}

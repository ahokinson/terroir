import { useTimeline } from "@opentui/solid"
import { SpinnerFrameMs } from "@tui/layout"
import { createSignal } from "solid-js"

const frames = [
	"\u280B",
	"\u2819",
	"\u2839",
	"\u2838",
	"\u283C",
	"\u2834",
	"\u2826",
	"\u2827",
	"\u2807",
	"\u280F",
]

export function useSpinnerFrame(): () => string {
	const [frameIndex, setFrameIndex] = createSignal(0)
	const state = { progress: 0 }

	useTimeline({ loop: true }).add([state], {
		duration: frames.length * SpinnerFrameMs,
		progress: 1,
		onUpdate: () => {
			setFrameIndex(Math.floor(state.progress * frames.length) % frames.length)
		},
	})

	return () => frames[frameIndex()]!
}

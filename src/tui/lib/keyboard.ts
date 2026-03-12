import { useKeyboard } from "@opentui/solid"

export function useDismissKeyboard(
	onConfirm: () => void,
	onCancel: () => void,
	extraKeys?: Record<string, () => void>,
) {
	useKeyboard((key) => {
		if (extraKeys?.[key.name]) {
			extraKeys[key.name]()
			return
		}
		if (key.name === "return") {
			onConfirm()
			return
		}
		if (key.name === "escape") {
			onCancel()
			return
		}
	})
}

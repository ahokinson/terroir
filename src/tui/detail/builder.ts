import type { RGBA } from "@opentui/core"
import type { ActionTarget, DetailRow } from "@tui/detail/types"

interface RowOpts {
	indent?: boolean
	valueColor?: RGBA
	action?: ActionTarget
}

export function detailSection() {
	const _rows: DetailRow[] = []
	const self = {
		get rows(): DetailRow[] {
			return _rows
		},
		row(label: string, value: string, opts?: RowOpts) {
			_rows.push({ label, value, ...opts })
			return self
		},
		rowIf(cond: unknown, label: string, value: string, opts?: RowOpts) {
			if (cond) self.row(label, value, opts)
			return self
		},
	}
	return self
}

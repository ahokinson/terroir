import { createContext, type ParentProps, Show, useContext } from "solid-js"

export function createSimpleContext<T, Props extends Record<string, unknown> = {}>(input: {
	name: string
	init: (props: Props) => T
}) {
	const ctx = createContext<T>()

	return {
		provider: (props: ParentProps<Props>) => {
			const value = input.init(props)
			return <ctx.Provider value={value}>{props.children}</ctx.Provider>
		},
		use() {
			const value = useContext(ctx)
			if (!value) throw new Error(`${input.name} context must be used within its provider`)
			return value
		},
	}
}

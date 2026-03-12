import { checkIdentity, fixIdentity } from "@integrations/git/identity"
import { DialogForm } from "@tui/dialogs/form"
import type { AppStore } from "@tui/stores/store"

export function handleFixIdentity(app: AppStore) {
	const { dialog, status, localRepos } = app
	const repo = localRepos.repos[localRepos.cursor]
	if (!repo) return
	checkIdentity(repo.path).then((identity) => {
		dialog.push(() => (
			<DialogForm
				title={`Identity — ${repo.name}`}
				initial={identity ? `${identity.name} <${identity.email}>` : ""}
				onSubmit={(value) => {
					const match = value.match(/^(.+?)\s*<(.+?)>$/)
					if (!match) {
						status.show("Format: Name <email>")
						return
					}
					fixIdentity(repo.path, match[2], match[1]).then(() => {
						status.show("Identity updated")
						dialog.pop()
					})
				}}
				onCancel={() => dialog.pop()}
			/>
		))
	})
}

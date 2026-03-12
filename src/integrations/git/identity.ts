import { GitRepo } from "@integrations/git/client"
import type { RemoteIdentity } from "@integrations/types"

export async function checkIdentity(repoPath: string): Promise<RemoteIdentity | null> {
	try {
		const repo = new GitRepo(repoPath)
		const [email, name] = await Promise.all([repo.userEmail(), repo.userName()])
		if (email && name) {
			return { email, name }
		}
		return null
	} catch {
		return null
	}
}

export async function fixIdentity(repoPath: string, email: string, name: string): Promise<void> {
	const repo = new GitRepo(repoPath)
	await repo.setConfig("user.email", email)
	await repo.setConfig("user.name", name)
}

import type { PollState } from "@monitor/polls"

export class PollTracker {
	private state: PollState

	constructor(initial: PollState) {
		this.state = initial
	}

	get current(): Readonly<PollState> {
		return this.state
	}

	updateFast(result: { branchSnapshots: PollState["branchSnapshots"] }) {
		this.state = { ...this.state, branchSnapshots: result.branchSnapshots }
	}

	updateMedium(result: {
		prSnapshots: PollState["prSnapshots"]
		pipelineSnapshots: PollState["pipelineSnapshots"]
		ticketSnapshots: PollState["ticketSnapshots"]
		storySnapshots: PollState["storySnapshots"]
	}) {
		this.state = {
			...this.state,
			prSnapshots: result.prSnapshots,
			pipelineSnapshots: result.pipelineSnapshots,
			ticketSnapshots: result.ticketSnapshots,
			storySnapshots: result.storySnapshots,
		}
	}

	updateSlow(result: {
		knownTicketKeys: PollState["knownTicketKeys"]
		knownReviewRequestKeys: PollState["knownReviewRequestKeys"]
		repoSlugs: PollState["repoSlugs"]
		securitySnapshots: PollState["securitySnapshots"]
		signalSnapshots: PollState["signalSnapshots"]
	}) {
		this.state = {
			...this.state,
			knownTicketKeys: result.knownTicketKeys,
			knownReviewRequestKeys: result.knownReviewRequestKeys,
			repoSlugs: result.repoSlugs,
			securitySnapshots: result.securitySnapshots,
			signalSnapshots: result.signalSnapshots,
		}
	}

	initSlugs(slugs: Map<string, string | null>) {
		this.state = { ...this.state, repoSlugs: slugs }
	}
}

/**
 * GitLab MR resolver
 * Handles resolution of gitlab:OWNER/REPO!123 format
 */

import type { RefRange } from "../types";
import { gitClient } from "../git/git-client";
import { createTempRefPrefix } from "../git/utils";
import { DiffxError, ExitCode } from "../types";

type MRResolvedRefs = {
	headRef: string;
	mergeRef: string;
	cleanupRefs: string[];
};

async function fetchMRRefs(range: RefRange, tempPrefix: string): Promise<MRResolvedRefs> {
	if (!range.ownerRepo || range.prNumber === undefined) {
		throw new DiffxError("Invalid GitLab MR ref", ExitCode.INVALID_INPUT);
	}

	const [owner, repo] = range.ownerRepo.split("/");
	if (!owner || !repo) {
		throw new DiffxError(`Invalid owner/repo: ${range.ownerRepo}`, ExitCode.INVALID_INPUT);
	}

	const remoteUrl = `git@gitlab.com:${owner}/${repo}.git`;
	const mrNumber = range.prNumber;

	const headRef = `${tempPrefix}/merge-requests/${mrNumber}/head`;
	const mergeRef = `${tempPrefix}/merge-requests/${mrNumber}/merge`;

	await gitClient.fetchFromUrl(
		remoteUrl,
		[
			`refs/merge-requests/${mrNumber}/head:${headRef}`,
			`refs/merge-requests/${mrNumber}/merge:${mergeRef}`,
		],
		2,
	);

	return {
		headRef,
		mergeRef,
		cleanupRefs: [headRef, mergeRef],
	};
}

/**
 * Resolve a GitLab MR to local refs
 */
export async function resolveGitLabMRRefs(range: RefRange): Promise<{
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
}> {
	try {
		const tempPrefix = createTempRefPrefix();
		const refs = await fetchMRRefs(range, tempPrefix);

		// The merge ref is the MR head merged into the base branch
		// Diffing merge^1..merge yields the MR changes (similar to GitLab "Changes" tab)
		return {
			left: `${refs.mergeRef}^1`, // The first parent of the merge commit (the base branch)
			right: refs.mergeRef,
			cleanup: async () => {
				await gitClient.deleteRefs(refs.cleanupRefs);
			},
		};
	} catch (error) {
		throw new DiffxError(
			`Failed to fetch GitLab MR refs: ${(error as Error).message}`,
			ExitCode.GIT_ERROR,
		);
	}
}

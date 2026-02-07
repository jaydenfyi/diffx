/**
 * Git URL resolver
 * Handles resolution of arbitrary git URLs (git@host:path.git@ref format)
 */

import type { RefRange } from "../types";
import { gitClient } from "../git/git-client";
import { createTempRefPrefix } from "../git/utils";
import { DiffxError, ExitCode } from "../types";

/**
 * Resolve a git URL range to local refs
 */
export async function resolveGitUrlRefs(range: RefRange): Promise<{
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
}> {
	if (range.type !== "git-url-range" || !range.leftGitUrl || !range.rightGitUrl) {
		throw new DiffxError("Invalid ref type for git URL resolver", ExitCode.INVALID_INPUT);
	}

	const leftUrl = range.leftGitUrl;
	const rightUrl = range.rightGitUrl;
	const leftRef = range.left;
	const rightRef = range.right;

	const tempPrefix = createTempRefPrefix();
	const leftDestRef = `${tempPrefix}/left`;
	const rightDestRef = `${tempPrefix}/right`;

	try {
		// Fetch the refs (shallow fetch) without creating a remote
		// If both URLs are the same, fetch both refs in one call
		if (leftUrl === rightUrl) {
			await gitClient.fetchFromUrl(
				leftUrl,
				[`${leftRef}:${leftDestRef}`, `${rightRef}:${rightDestRef}`],
				1,
			);
		} else {
			// Different URLs, fetch each separately
			await gitClient.fetchFromUrl(leftUrl, [`${leftRef}:${leftDestRef}`], 1);
			await gitClient.fetchFromUrl(rightUrl, [`${rightRef}:${rightDestRef}`], 1);
		}

		// Return as temp refs
		return {
			left: leftDestRef,
			right: rightDestRef,
			cleanup: async () => {
				await gitClient.deleteRefs([leftDestRef, rightDestRef]);
			},
		};
	} catch (error) {
		throw new DiffxError(
			`Failed to fetch refs from git URL: ${(error as Error).message}`,
			ExitCode.GIT_ERROR,
		);
	}
}

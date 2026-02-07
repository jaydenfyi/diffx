/**
 * Remote ref resolver
 * Handles resolution of remote Git refs (OWNER/REPO@ref format)
 */

import type { RefRange } from "../types";
import { gitClient } from "../git/git-client";
import { buildGitHubUrl, createTempRefPrefix } from "../git/utils";
import { DiffxError, ExitCode } from "../types";

/**
 * Resolve a remote ref range to local refs
 */
export async function resolveRemoteRefs(range: RefRange): Promise<{
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
}> {
	if (range.type !== "remote-range" || !range.ownerRepo) {
		throw new DiffxError("Invalid ref type for remote resolver", ExitCode.INVALID_INPUT);
	}

	const [owner, repo] = range.ownerRepo.split("/");
	if (!owner || !repo) {
		throw new DiffxError(`Invalid owner/repo: ${range.ownerRepo}`, ExitCode.INVALID_INPUT);
	}

	// Parse remote refs (format: OWNER/REPO@ref)
	const leftMatch = range.left.match(/^[^/]+\/[^@]+@(.+)$/);
	const rightMatch = range.right.match(/^[^/]+\/[^@]+@(.+)$/);

	if (!leftMatch || !rightMatch) {
		throw new DiffxError("Invalid remote ref format", ExitCode.INVALID_INPUT);
	}

	const leftRemoteRef = leftMatch[1];
	const rightRemoteRef = rightMatch[1];

	const remoteUrl = buildGitHubUrl(owner, repo);
	const tempPrefix = createTempRefPrefix();
	const leftDestRef = `${tempPrefix}/left`;
	const rightDestRef = `${tempPrefix}/right`;

	try {
		// Fetch the refs (shallow fetch) without creating a remote
		await gitClient.fetchFromUrl(
			remoteUrl,
			[`${leftRemoteRef}:${leftDestRef}`, `${rightRemoteRef}:${rightDestRef}`],
			1,
		);

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
			`Failed to fetch remote refs: ${(error as Error).message}`,
			ExitCode.GIT_ERROR,
		);
	}
}

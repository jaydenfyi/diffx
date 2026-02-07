/**
 * Local ref resolver
 * Handles resolution of local Git refs (branches, commits)
 */

import type { RefRange } from "../types";
import { gitClient } from "../git/git-client";
import { normalizeRef } from "../git/utils";
import { DiffxError, ExitCode } from "../types";

/**
 * Resolve a local ref range to actual refs
 */
export async function resolveLocalRefs(range: RefRange): Promise<{
	left: string;
	right: string;
}> {
	if (range.type !== "local-range") {
		throw new DiffxError("Invalid ref type for local resolver", ExitCode.INVALID_INPUT);
	}

	const left = normalizeRef(range.left);
	const right = normalizeRef(range.right);

	// Validate that both refs exist (branches, tags, commits, and rev expressions)
	const leftExists = await gitClient.refExistsAny(left);
	const rightExists = await gitClient.refExistsAny(right);

	if (!leftExists) {
		throw new DiffxError(`Left ref does not exist: ${range.left}`, ExitCode.INVALID_INPUT);
	}
	if (!rightExists) {
		throw new DiffxError(`Right ref does not exist: ${range.right}`, ExitCode.INVALID_INPUT);
	}

	return { left, right };
}

/**
 * Patch output generator
 * Generates patch output using git format-patch or git diff
 */

import type { GitDiffOptions } from "../git/types";
import { gitClient } from "../git/git-client";
import type { PatchStyle } from "../types";

/**
 * Generate patch between two refs
 */
export async function generatePatch(
	left: string,
	right: string,
	options: GitDiffOptions | undefined,
	patchStyle: PatchStyle = "diff",
): Promise<string> {
	if (patchStyle === "diff") {
		return gitClient.diff(left, right, options);
	}

	return gitClient.formatPatch(left, right, options);
}

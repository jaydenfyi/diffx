/**
 * Patch output generator
 * Generates patch output using git format-patch or git diff
 */

import type { GitDiffOptions } from "../git/types";
import type { GitClient } from "../git/git-client";
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
	client: GitClient = gitClient,
): Promise<string> {
	if (patchStyle === "diff") {
		return client.diff(left, right, options);
	}

	return client.formatPatch(left, right, options);
}

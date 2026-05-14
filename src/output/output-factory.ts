import type { OutputMode, PatchStyle } from "../types";
import type { GitClient } from "../git/git-client";
import { gitClient } from "../git/git-client";
import type { GitDiffOptions } from "../git/types";

export async function generateOutput(
	mode: OutputMode,
	left: string,
	right: string,
	options: GitDiffOptions | undefined,
	patchStyle: PatchStyle | undefined,
	client?: GitClient,
): Promise<string> {
	const c = client ?? gitClient;

	if (mode === "patch" && patchStyle === "format-patch") {
		return c.formatPatch(left, right, options);
	}

	switch (mode) {
		case "diff":
		case "patch":
			return c.diff(left, right, options);
		case "stat":
			return c.diffStat(left, right, options);
		case "numstat":
			return c.diffNumStat(left, right, options);
		case "shortstat":
			return c.diffShortStat(left, right, options);
		case "name-only":
			return c.diffNameOnly(left, right, options);
		case "name-status":
			return c.diffNameStatus(left, right, options);
		case "summary":
			return c.diffSummary(left, right, options);
	}
}

export async function generateOutputAgainstWorktree(
	mode: OutputMode,
	ref: string,
	options: GitDiffOptions | undefined,
): Promise<string> {
	switch (mode) {
		case "diff":
		case "patch":
			return gitClient.diffAgainstWorktree(ref, options);
		case "stat":
			return gitClient.diffStatAgainstWorktree(ref, options);
		case "numstat":
			return gitClient.diffNumStatAgainstWorktree(ref, options);
		case "shortstat":
			return gitClient.diffShortStatAgainstWorktree(ref, options);
		case "name-only":
			return gitClient.diffNameOnlyAgainstWorktree(ref, options);
		case "name-status":
			return gitClient.diffNameStatusAgainstWorktree(ref, options);
		case "summary":
			return gitClient.diffSummaryAgainstWorktree(ref, options);
	}
}

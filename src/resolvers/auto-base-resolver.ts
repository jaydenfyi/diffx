/**
 * Auto base resolver
 * Resolves current branch diff against its inferred base branch
 */

import { gitClient } from "../git/git-client";
import { DiffxError, ExitCode } from "../types";

export interface AutoBaseRefs {
	left: string;
	right: string;
	baseRef: string;
	mergeBase: string;
}

/**
 * Resolve refs for auto base diff (merge-base..HEAD)
 */
export async function resolveAutoBaseRefs(): Promise<AutoBaseRefs> {
	const baseRef = await gitClient.getDefaultBranchRef();
	if (!baseRef) {
		throw new DiffxError(
			"Could not determine a base branch automatically. Provide an explicit range (e.g., main..HEAD).",
			ExitCode.INVALID_INPUT,
		);
	}

	let mergeBase: string;
	try {
		mergeBase = (await gitClient.mergeBase(baseRef, "HEAD")).trim();
	} catch {
		throw new DiffxError(
			`Could not find a merge base with ${baseRef}. Provide an explicit range (e.g., ${baseRef}..HEAD).`,
			ExitCode.INVALID_INPUT,
		);
	}

	if (!mergeBase) {
		throw new DiffxError(
			`Could not find a merge base with ${baseRef}. Provide an explicit range (e.g., ${baseRef}..HEAD).`,
			ExitCode.INVALID_INPUT,
		);
	}

	return {
		left: mergeBase,
		right: "HEAD",
		baseRef,
		mergeBase,
	};
}

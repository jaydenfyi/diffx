/**
 * Output factory
 * Routes to the appropriate output generator based on mode
 */

import type { OutputMode, PatchStyle } from "../types";
import { gitClient } from "../git/git-client";
import { generatePatch } from "./patch-generator";
import { GitDiffOptions } from "../git/types";

type OutputGeneratorFn = (
	left: string,
	right: string,
	options: GitDiffOptions | undefined,
	patchStyle?: PatchStyle,
) => Promise<string>;

const outputGeneratorsByMode = {
	diff: (left: string, right: string, options: GitDiffOptions | undefined) =>
		gitClient.diff(left, right, options),
	patch: generatePatch as OutputGeneratorFn,
	stat: (left: string, right: string, options: GitDiffOptions | undefined) =>
		gitClient.diffStat(left, right, options),
	numstat: (left: string, right: string, options: GitDiffOptions | undefined) =>
		gitClient.diffNumStat(left, right, options),
	shortstat: (left: string, right: string, options: GitDiffOptions | undefined) =>
		gitClient.diffShortStat(left, right, options),
	"name-only": (left: string, right: string, options: GitDiffOptions | undefined) =>
		gitClient.diffNameOnly(left, right, options),
	"name-status": (left: string, right: string, options: GitDiffOptions | undefined) =>
		gitClient.diffNameStatus(left, right, options),
	summary: (left: string, right: string, options: GitDiffOptions | undefined) =>
		gitClient.diffSummary(left, right, options),
} as const satisfies Record<OutputMode, OutputGeneratorFn>;

type OutputGeneratorAgainstWorktreeFn = (
	ref: string,
	options: GitDiffOptions | undefined,
) => Promise<string>;

const outputGeneratorsAgainstWorktreeByMode = {
	diff: (ref: string, options: GitDiffOptions | undefined) =>
		gitClient.diffAgainstWorktree(ref, options),
	patch: (ref: string, options: GitDiffOptions | undefined) =>
		gitClient.diffAgainstWorktree(ref, options),
	stat: (ref: string, options: GitDiffOptions | undefined) =>
		gitClient.diffStatAgainstWorktree(ref, options),
	numstat: (ref: string, options: GitDiffOptions | undefined) =>
		gitClient.diffNumStatAgainstWorktree(ref, options),
	shortstat: (ref: string, options: GitDiffOptions | undefined) =>
		gitClient.diffShortStatAgainstWorktree(ref, options),
	"name-only": (ref: string, options: GitDiffOptions | undefined) =>
		gitClient.diffNameOnlyAgainstWorktree(ref, options),
	"name-status": (ref: string, options: GitDiffOptions | undefined) =>
		gitClient.diffNameStatusAgainstWorktree(ref, options),
	summary: (ref: string, options: GitDiffOptions | undefined) =>
		gitClient.diffSummaryAgainstWorktree(ref, options),
} as const satisfies Record<OutputMode, OutputGeneratorAgainstWorktreeFn>;

/**
 * Generate output based on the specified mode
 */
export async function generateOutput(
	mode: OutputMode,
	left: string,
	right: string,
	options: GitDiffOptions | undefined,
	patchStyle: PatchStyle | undefined,
): Promise<string> {
	const generator = outputGeneratorsByMode[mode];
	return generator(left, right, options, patchStyle);
}

/**
 * Generate output between a ref and the working tree
 */
export async function generateOutputAgainstWorktree(
	mode: OutputMode,
	ref: string,
	options: GitDiffOptions | undefined,
): Promise<string> {
	const generator = outputGeneratorsAgainstWorktreeByMode[mode];
	return generator(ref, options);
}

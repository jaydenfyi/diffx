/**
 * Gunshi CLI command definition for diffx
 */

import { define, type Args } from "gunshi";
import { parseRangeInput } from "../parsers/range-parser";
import { resolveRefs } from "../resolvers/ref-resolver";
import { resolveAutoBaseRefs } from "../resolvers/auto-base-resolver";
import { generateOutput, generateOutputAgainstWorktree } from "../output/output-factory";
import { checkEmptyOutput, createNoFilesMatchedError } from "../errors/error-handler";
import type { OutputMode } from "../types";
import type { GitDiffOptions } from "../git/types";
import { gitClient } from "../git/git-client";
import { pageOutput } from "./pager";
import { partitionArgs } from "./arg-partitioner";
import type { ResolvedRefs } from "./command-types";
import {
	buildDiffOptions,
	getFilterOptions,
	getOutputMode,
	getRangeOrUrl,
	hasActiveFilters,
	hasLongOptionFlag,
	shouldUseGitPassThrough,
	validateNoConflictingFlags,
	validatePagerOptions,
} from "./command-options";
import { runGitPassThrough } from "./git-pass-through";
import { hasUnfilteredChanges, processWorktreeOutput } from "./worktree-output";

const RANGE_TYPES_USING_DIFF_PATCH_STYLE = new Set([
	"pr-ref",
	"github-url",
	"pr-range",
	"github-commit-url",
	"github-pr-changes-url",
	"github-compare-url",
] as const);

type InferSetValue<T> = T extends Set<infer U> ? U : never;
type RangeTypeUsingDiffPatchStyle = InferSetValue<typeof RANGE_TYPES_USING_DIFF_PATCH_STYLE>;

async function resolveRefsForRange(rangeOrUrl: string, mode: OutputMode): Promise<ResolvedRefs> {
	const range = parseRangeInput(rangeOrUrl);

	const patchStyle =
		mode === "patch" &&
		RANGE_TYPES_USING_DIFF_PATCH_STYLE.has(range.type as RangeTypeUsingDiffPatchStyle)
			? "diff"
			: undefined;

	const resolved = await resolveRefs(range);
	return { ...resolved, patchStyle };
}

async function resolveRefsForDefault(useGitCompat: boolean): Promise<ResolvedRefs> {
	if (useGitCompat) {
		return { left: "", right: "" };
	}

	const hasChanges = await gitClient.hasWorktreeChanges();
	if (hasChanges) {
		return { left: "HEAD", right: "" };
	}
	const auto = await resolveAutoBaseRefs();
	return { left: auto.mergeBase, right: auto.right };
}

async function generateDiffOutput(
	mode: OutputMode,
	refs: ResolvedRefs,
	diffOptions: GitDiffOptions,
): Promise<string> {
	const { left, right, patchStyle } = refs;
	if (right) {
		return generateOutput(mode, left, right, diffOptions, patchStyle);
	}

	return generateOutputAgainstWorktree(mode, left, diffOptions);
}

async function cleanupRefs(refs: ResolvedRefs): Promise<void> {
	if (!refs.cleanup) {
		return;
	}

	try {
		await refs.cleanup();
	} catch {
		// Ignore cleanup errors
	}
}

/**
 * Main diffx command
 */
export const diffxCommand = define({
	rendering: {
		header: null,
	},
	args: {
		mode: {
			type: "string",
			description:
				"Output mode: diff (default), patch (unified diff, same as git diff -p), stat, numstat, or shortstat",
		},
		stat: {
			type: "boolean",
			description: "Show diff statistics (same as --mode stat)",
		},
		numstat: {
			type: "boolean",
			description: "Show per-file adds/removes (same as --mode numstat)",
		},
		summary: {
			type: "boolean",
			description:
				"Show structural summary (create/delete/rename mode). Equivalent to git diff --summary",
		},
		shortstat: {
			type: "boolean",
			description: "Show summary line only (same as --mode shortstat)",
		},
		"name-only": {
			type: "boolean",
			description: "Show only filenames of changed files",
		},
		"name-status": {
			type: "boolean",
			description: "Show filenames with status (M/A/D/etc)",
		},
		overview: {
			type: "boolean",
			description: "Show custom diffx table with status/additions/deletions (not a git flag)",
		},
		pager: {
			type: "boolean",
			description: "Force output through a pager (overrides TTY detection)",
		},
		"no-pager": {
			type: "boolean",
			description: "Disable the pager",
		},
		include: {
			type: "string",
			description: "Only include files matching this glob pattern",
			short: "i",
		},
		exclude: {
			type: "string",
			description: "Exclude files matching this glob pattern",
			short: "e",
		},
		index: {
			type: "boolean",
			description: "Strict git diff compatibility: show unstaged changes (index vs working tree)",
		},
	} satisfies Args,
	run: async (ctx) => {
		const rawArgv = process.argv.slice(2);
		const partitioned = partitionArgs(rawArgv, ctx.tokens);
		validateNoConflictingFlags(partitioned.diffxFlags, partitioned.gitArgs);

		const positionals = ctx.positionals ?? [];
		const rangeOrUrl = getRangeOrUrl(positionals, partitioned.inputRange);

		const {
			include,
			exclude,
			mode: rawMode,
			stat,
			numstat,
			shortstat,
			overview,
			"name-only": _nameOnly,
			"name-status": _nameStatus,
			pager,
			"no-pager": noPager,
			index,
		} = ctx.values;

		const toPatternList = (value: unknown): string | string[] | undefined => {
			if (typeof value === "string") return value;
			if (Array.isArray(value)) {
				const patterns = value.filter((item): item is string => typeof item === "string");
				return patterns.length > 0 ? patterns : undefined;
			}
			return undefined;
		};

		validatePagerOptions(pager, noPager);

		const hasRange = Boolean(rangeOrUrl);
		const partitionedInclude = partitioned.diffxFlags.get("--include");
		const partitionedExclude = partitioned.diffxFlags.get("--exclude");
		const filterOptions = getFilterOptions({
			include: toPatternList(partitionedInclude) ?? toPatternList(include),
			exclude: toPatternList(partitionedExclude) ?? toPatternList(exclude),
		});
		const filtersAreActive = hasActiveFilters(filterOptions);

		if (shouldUseGitPassThrough(partitioned, hasRange, Boolean(index), filtersAreActive)) {
			await runGitPassThrough({
				partitioned,
				rangeOrUrl,
				useGitCompat: Boolean(index),
				pager,
				noPager,
			});
			return;
		}

		const hasStatFlag = hasLongOptionFlag(ctx.tokens, "stat");
		const hasNumstatFlag = hasLongOptionFlag(ctx.tokens, "numstat");
		const hasShortstatFlag = hasLongOptionFlag(ctx.tokens, "shortstat");
		const hasNameOnlyFlag = hasLongOptionFlag(ctx.tokens, "name-only");
		const hasNameStatusFlag = hasLongOptionFlag(ctx.tokens, "name-status");

		const mode = getOutputMode({
			rawMode,
			stat,
			numstat,
			shortstat,
			overview,
			hasStatFlag,
			hasNumstatFlag,
			hasShortstatFlag,
			hasNameOnlyFlag,
			hasNameStatusFlag,
		});

		const useSummaryFormat = Boolean(overview);
		const { diffOptions, color } = buildDiffOptions(
			filterOptions,
			pager,
			mode,
			partitioned.gitArgs,
		);

		const refs = rangeOrUrl
			? await resolveRefsForRange(rangeOrUrl, mode)
			: await resolveRefsForDefault(Boolean(index));

		try {
			let output = await generateDiffOutput(mode, refs, diffOptions);

			if (!rangeOrUrl || useSummaryFormat) {
				output = await processWorktreeOutput(
					output,
					mode,
					refs,
					filterOptions,
					color,
					useSummaryFormat,
				);
			}

			const emptyOutput = checkEmptyOutput(output, {
				hasActiveFilters: filtersAreActive,
				hasUnfilteredChanges: filtersAreActive ? await hasUnfilteredChanges(refs) : false,
			});
			if (emptyOutput.isEmpty) {
				if (emptyOutput.isFilterMismatch) {
					throw createNoFilesMatchedError();
				}
				return;
			}

			const autoPagerMode = mode === "diff" || mode === "patch";
			const disablePager = Boolean(noPager) || (!autoPagerMode && !pager);
			const paged = await pageOutput(output, {
				force: pager,
				disable: disablePager,
			});
			if (!paged) {
				console.log(output);
			}
		} finally {
			await cleanupRefs(refs);
		}
	},
});

/**
 * Argument partitioning for git diff pass-through
 *
 * This module handles the separation of diffx-owned flags from git pass-through flags.
 * The goal is to allow any git diff flag to work without diffx needing to know about it.
 */

/**
 * Flags that are owned and processed by diffx
 * Everything else is passed through to git diff
 *
 * Note: Git output format flags (--stat, --numstat, etc.) are NOT owned by diffx
 * and are passed through to git for native git compatibility.
 * Use --overview to get diffx enhancements (e.g., including untracked files).
 */
export const DIFFX_OWNED_FLAGS = [
	"--mode",
	"--include",
	"--exclude",
	"--pager",
	"--no-pager",
	"--overview",
	"--index",
] as const;

const DIFFX_SHORT_FLAG_ALIASES: Record<string, DiffxOwnedFlag> = {
	"-i": "--include",
	"-e": "--exclude",
};

/**
 * Note: --summary is no longer a diffx-owned flag as of Phase 2
 * It now passes through to native git diff --summary (structural summary)
 * The custom diffx table output is now only available via --overview
 */

/**
 * Git output format flags that are mutually exclusive with --overview
 */
export const GIT_OUTPUT_FORMAT_FLAGS = [
	"--stat",
	"--numstat",
	"--name-only",
	"--name-status",
	"--raw",
	"-p",
	"--patch",
	"--shortstat",
] as const;

/**
 * Git diff flags that consume the next argv token as a value.
 * This prevents value tokens (e.g. regex patterns containing "..")
 * from being misclassified as diff ranges.
 */
const GIT_FLAGS_WITH_SEPARATE_VALUE = new Set([
	"--abbrev",
	"--anchored",
	"--color",
	"--color-moved",
	"--color-moved-ws",
	"--diff-algorithm",
	"--dst-prefix",
	"--find-object",
	"--find-renames",
	"--find-copies",
	"--inter-hunk-context",
	"--line-prefix",
	"--output",
	"--output-indicator-context",
	"--output-indicator-new",
	"--output-indicator-old",
	"--relative",
	"--skip-to",
	"--rotate-to",
	"--src-prefix",
	"--stat-count",
	"--stat-graph-width",
	"--stat-name-width",
	"--stat-width",
	"--submodule",
	"--word-diff",
	"--word-diff-regex",
	"-G",
	"-O",
	"-S",
	"-U",
]);

export type DiffxOwnedFlag = (typeof DIFFX_OWNED_FLAGS)[number];
export type GitOutputFormatFlag = (typeof GIT_OUTPUT_FORMAT_FLAGS)[number];

/**
 * Partitioned command-line arguments
 */
export interface PartitionedArgs {
	/** Flags owned by diffx with their values */
	diffxFlags: Map<DiffxOwnedFlag, string | string[] | boolean>;
	/** Input range or URL (e.g., github:owner/repo#123, gitlab:owner/repo!123, https://github.com/.../pull/123) */
	inputRange: string | undefined;
	/** Git pass-through arguments (preserved order) */
	gitArgs: string[];
	/** Pathspecs (files after -- separator) */
	pathspecs: string[];
}

/**
 * Check if a flag is a diffx-owned flag
 */
function isDiffxOwnedFlag(flag: string): flag is DiffxOwnedFlag {
	return DIFFX_OWNED_FLAGS.includes(flag as DiffxOwnedFlag);
}

function normalizeDiffxFlag(flag: string): DiffxOwnedFlag | null {
	if (isDiffxOwnedFlag(flag)) {
		return flag;
	}
	return DIFFX_SHORT_FLAG_ALIASES[flag] ?? null;
}

/**
 * Check if a flag is a git output format flag
 */
export function isGitOutputFormatFlag(flag: string): flag is GitOutputFormatFlag {
	return GIT_OUTPUT_FORMAT_FLAGS.includes(flag as GitOutputFormatFlag);
}

/**
 * Check if the flag is a negatable form (no-* version)
 */
function isNegatedFlag(flag: string): boolean {
	return flag.startsWith("--no-");
}

/**
 * Get the base flag name from a negated flag
 * e.g., "--no-pager" => "pager"
 */
function getBaseFlagName(flag: string): string {
	if (isNegatedFlag(flag)) {
		return `--${flag.slice(5)}`; // Remove "--no-" prefix
	}
	return flag;
}

/**
 * Parse a flag token to extract the flag name
 * Handles:
 * - --flag
 * - --flag=value
 * - --flag value
 * - -f
 * - -fvalue (combined short form)
 */
function parseFlagName(arg: string): string {
	if (arg.startsWith("--")) {
		// Long option: --flag or --flag=value
		const idx = arg.indexOf("=");
		return idx >= 0 ? arg.slice(0, idx) : arg;
	} else if (arg.startsWith("-") && arg.length > 1) {
		// Short option: -f or -fvalue
		return arg.slice(0, 2);
	}
	return arg;
}

function isGitFlagWithSeparateValue(arg: string): boolean {
	const flagName = parseFlagName(arg);
	return GIT_FLAGS_WITH_SEPARATE_VALUE.has(flagName);
}

function isValueForPreviousGitFlag(argv: string[], index: number): boolean {
	if (index <= 0) {
		return false;
	}
	const previousArg = argv[index - 1];
	return (
		!previousArg.startsWith("--no-") &&
		!normalizeDiffxFlag(parseFlagName(previousArg)) &&
		isGitFlagWithSeparateValue(previousArg)
	);
}

/**
 * Check if an argument takes a value
 * For diffx flags, we know which ones take values
 */
function diffxFlagTakesValue(flag: string): boolean {
	return flag === "--mode" || flag === "--include" || flag === "--exclude";
}

function appendDiffxFlagValue(
	diffxFlags: Map<DiffxOwnedFlag, string | string[] | boolean>,
	flag: DiffxOwnedFlag,
	value: string,
): void {
	const existing = diffxFlags.get(flag);
	if (existing === undefined) {
		diffxFlags.set(flag, value);
		return;
	}
	if (Array.isArray(existing)) {
		existing.push(value);
		diffxFlags.set(flag, existing);
		return;
	}
	if (typeof existing === "string") {
		diffxFlags.set(flag, [existing, value]);
		return;
	}
	diffxFlags.set(flag, value);
}

/**
 * Check if a token looks like a range/URL input
 * This is a heuristic to distinguish positionals from git revs
 */
function looksLikeRangeOrUrl(arg: string): boolean {
	// GitHub PR ref format
	if (arg.startsWith("github:")) return true;

	// GitLab MR ref format
	if (arg.startsWith("gitlab:")) return true;

	// URL format
	if (arg.startsWith("http://") || arg.startsWith("https://")) return true;

	// Git URL format
	if (arg.startsWith("git@") || arg.includes("://")) return true;

	// Contains .. (range syntax like main..feature, main...feature)
	if (arg.includes("..")) return true;

	return false;
}

/**
 * Partition command-line arguments into diffx-owned and git pass-through
 *
 * @param argv - Raw command-line arguments (excluding program name)
 * @param tokens - Parsed tokens from gunshi CLI framework
 * @returns Partitioned arguments
 */
export function partitionArgs(
	argv: string[],
	tokens: { kind: string; name?: string; rawName?: string }[],
): PartitionedArgs {
	const diffxFlags: PartitionedArgs["diffxFlags"] = new Map();
	const gitArgs: string[] = [];
	const pathspecs: string[] = [];

	let inputRange: string | undefined = undefined;
	let seenDoubleDash = false;
	let i = 0;

	while (i < argv.length) {
		const arg = argv[i];

		// Handle -- separator (option terminator)
		if (arg === "--" && !seenDoubleDash) {
			seenDoubleDash = true;
			i++;

			// Everything after -- is a pathspec
			while (i < argv.length) {
				pathspecs.push(argv[i]);
				i++;
			}
			break;
		}

		// If we've seen --, everything else is a pathspec
		if (seenDoubleDash) {
			pathspecs.push(arg);
			i++;
			continue;
		}

		// Parse the flag name
		const flagName = parseFlagName(arg);

		const normalizedFlag = normalizeDiffxFlag(flagName);

		// Check if this is a diffx-owned flag
		if (normalizedFlag) {
			// Extract the value if the flag takes one
			if (diffxFlagTakesValue(normalizedFlag)) {
				// Check if value is in the same arg (--flag=value)
				const idx = arg.indexOf("=");
				if (idx >= 0) {
					appendDiffxFlagValue(diffxFlags, normalizedFlag, arg.slice(idx + 1));
				} else if (arg.startsWith(flagName) && arg.length > flagName.length) {
					// Combined short form like -i*.ts
					appendDiffxFlagValue(diffxFlags, normalizedFlag, arg.slice(flagName.length));
				} else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
					// Value is next arg
					appendDiffxFlagValue(diffxFlags, normalizedFlag, argv[i + 1]);
					i++;
				} else {
					// Flag without value (treat as boolean true)
					diffxFlags.set(normalizedFlag, true);
				}
			} else {
				// Boolean flag
				const baseFlag = getBaseFlagName(normalizedFlag);
				const value = isNegatedFlag(flagName);
				diffxFlags.set(baseFlag as DiffxOwnedFlag, !value);
			}
			i++;
			continue;
		}

		// Not a diffx flag - pass through to git
		// But check if it looks like a range/URL positional first
		if (
			!arg.startsWith("-") &&
			!inputRange &&
			!isValueForPreviousGitFlag(argv, i) &&
			looksLikeRangeOrUrl(arg)
		) {
			inputRange = arg;
			i++;
			continue;
		}

		// Everything else is a git pass-through arg
		gitArgs.push(arg);
		i++;
	}

	// If no range found in argv, check positionals from tokens
	// The gunshi framework extracts positionals separately
	if (!inputRange) {
		const positionals = tokens
			.filter((t) => t.kind === "positional")
			.map((t) => (t as { kind: string; value: string }).value)
			.filter((v) => v && v.trim().length > 0)
			.filter((v) => looksLikeRangeOrUrl(v))
			.filter((v) => {
				const safeIdx = argv.findIndex(
					(arg, i) => arg === v && !isValueForPreviousGitFlag(argv, i),
				);
				if (safeIdx >= 0) {
					return true;
				}
				// If the value appears in argv only as an option value, do not treat it as a range.
				const rawIdx = argv.indexOf(v);
				if (rawIdx >= 0) {
					return false;
				}
				// Some CLI frameworks may surface positionals in tokens even when raw argv
				// has already been normalized. In that case, trust the token.
				return true;
			});

		if (positionals.length > 0) {
			inputRange = positionals[0];
		}
	}

	return { diffxFlags, inputRange, gitArgs, pathspecs };
}

/**
 * Validate that --overview is not used with git output format flags
 */
export function validateOverviewMutualExclusivity(
	diffxFlags: Map<string, unknown>,
	gitArgs: string[],
): void {
	const useOverview = diffxFlags.get("--overview") === true;

	if (!useOverview) {
		return;
	}

	// Check both diffxFlags and gitArgs for output format flags
	const conflictingFlags: string[] = [];

	// Check diffxFlags for conflicting output format flags
	for (const [flag] of diffxFlags) {
		if (isGitOutputFormatFlag(flag)) {
			conflictingFlags.push(flag);
		}
	}

	// Check gitArgs for output format flags
	for (const arg of gitArgs) {
		const flagName = parseFlagName(arg);
		if (isGitOutputFormatFlag(flagName)) {
			conflictingFlags.push(flagName);
		}
	}

	if (conflictingFlags.length > 0) {
		const flags = conflictingFlags.join(", ");
		throw new Error(
			`Cannot use --overview with git output format flags: ${flags}\n` +
				"Use --overview for diffx custom output, or git flags for native output.",
		);
	}
}

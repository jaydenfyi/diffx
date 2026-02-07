import type { GitDiffOptions } from "../git/types";
import { buildFilePatterns } from "../filters/file-filter";
import { DiffxError, ExitCode, type OutputMode } from "../types";
import {
	type PartitionedArgs,
	isGitOutputFormatFlag,
	validateOverviewMutualExclusivity,
} from "./arg-partitioner";
import type { CliToken, FileFilterOptions } from "./command-types";

const MODES = new Set([
	"diff",
	"patch",
	"stat",
	"numstat",
	"shortstat",
	"name-only",
	"name-status",
	"summary",
] as const);

function parseFlagName(arg: string): string {
	if (arg.startsWith("--")) {
		const idx = arg.indexOf("=");
		return idx >= 0 ? arg.slice(0, idx) : arg;
	}
	if (arg.startsWith("-") && arg.length > 1) {
		return arg.slice(0, 2);
	}
	return arg;
}

function parseMode(value: unknown): OutputMode | null {
	if (typeof value !== "string") {
		return null;
	}

	if (!MODES.has(value as OutputMode)) {
		return null;
	}

	return value as OutputMode;
}

export function validateNoConflictingFlags(
	diffxFlags: Map<string, unknown>,
	gitArgs: string[],
): void {
	const pager = diffxFlags.get("--pager");
	const noPager = diffxFlags.get("--no-pager");
	if (pager && noPager) {
		throw new DiffxError("Cannot use both --pager and --no-pager", ExitCode.INVALID_INPUT);
	}

	validateOverviewMutualExclusivity(diffxFlags, gitArgs);
}

export function shouldUseGitPassThrough(
	partitioned: Pick<PartitionedArgs, "gitArgs" | "diffxFlags" | "pathspecs">,
	hasRange: boolean,
	useGitCompat: boolean,
	hasActiveFilters: boolean,
): boolean {
	if (hasActiveFilters) {
		return false;
	}

	if (partitioned.diffxFlags.get("--overview") === true) {
		return false;
	}

	if (partitioned.diffxFlags.get("--mode")) {
		return false;
	}

	for (const arg of partitioned.gitArgs) {
		const flagName = parseFlagName(arg);
		if (isGitOutputFormatFlag(flagName)) {
			return true;
		}
	}

	if (useGitCompat) {
		return true;
	}

	if (hasRange) {
		return true;
	}

	if (partitioned.gitArgs.length > 0 || partitioned.pathspecs.length > 0) {
		return true;
	}

	return false;
}

export function getOutputMode({
	overview,
	stat,
	numstat,
	shortstat,
	rawMode,
	hasStatFlag,
	hasNumstatFlag,
	hasShortstatFlag,
	hasNameOnlyFlag,
	hasNameStatusFlag,
}: {
	overview: boolean | undefined;
	stat: boolean | undefined;
	numstat: boolean | undefined;
	shortstat: boolean | undefined;
	rawMode: string | undefined;
	hasStatFlag: boolean;
	hasNumstatFlag: boolean;
	hasShortstatFlag: boolean;
	hasNameOnlyFlag: boolean;
	hasNameStatusFlag: boolean;
}): OutputMode {
	const mode = parseMode(rawMode);

	if (mode) {
		return mode;
	}

	if (rawMode !== undefined) {
		throw new DiffxError(
			`Invalid mode: ${rawMode}\nSupported modes: diff, patch, stat, numstat, shortstat, name-only, name-status`,
			ExitCode.INVALID_INPUT,
		);
	}

	if (overview) {
		return "numstat";
	}

	if (stat || hasStatFlag) {
		return "stat";
	}

	if (numstat || hasNumstatFlag) {
		return "numstat";
	}

	if (shortstat || hasShortstatFlag) {
		return "shortstat";
	}

	if (hasNameOnlyFlag) {
		return "name-only";
	}

	if (hasNameStatusFlag) {
		return "name-status";
	}

	return "diff";
}

export function getRangeOrUrl(
	positionals: string[],
	partitionedInputRange: string | undefined,
): string | undefined {
	if (positionals.length <= 1) {
		return partitionedInputRange;
	}

	throw new DiffxError(
		`Unexpected arguments: ${positionals.slice(1).join(" ")}`,
		ExitCode.INVALID_INPUT,
	);
}

export function validatePagerOptions(
	pager: boolean | undefined,
	noPager: boolean | undefined,
): void {
	if (pager && noPager) {
		throw new DiffxError("Cannot use both --pager and --no-pager", ExitCode.INVALID_INPUT);
	}
}

export function hasLongOptionFlag(tokens: CliToken[], optionName: string): boolean {
	let seenOptionTerminator = false;
	for (const token of tokens) {
		if (token.kind === "option-terminator") {
			seenOptionTerminator = true;
			continue;
		}
		if (seenOptionTerminator || token.kind !== "option") {
			continue;
		}
		if (token.name === optionName) {
			return true;
		}
	}
	return false;
}

export function getFilterOptions({
	include,
	exclude,
}: {
	include: string | string[] | undefined;
	exclude: string | string[] | undefined;
}): FileFilterOptions {
	const normalize = (value: string | string[] | undefined): string[] | undefined => {
		if (!value) return undefined;
		return Array.isArray(value) ? value : [value];
	};

	return {
		include: normalize(include),
		exclude: normalize(exclude),
	};
}

export function buildDiffOptions(
	filterOptions: FileFilterOptions,
	pager: boolean | undefined,
	mode: OutputMode,
	extraGitArgs: string[] = [],
): { diffOptions: GitDiffOptions; color: "always" | "never" } {
	const patterns = buildFilePatterns(filterOptions);
	const supportsColorOutput = mode === "diff" || mode === "patch" || mode === "stat";
	const wantsColor = supportsColorOutput && (Boolean(pager) || Boolean(process.stdout.isTTY));
	const color: "always" | "never" = wantsColor ? "always" : "never";

	return {
		diffOptions: {
			files: patterns.length > 0 ? patterns : undefined,
			color,
			extraArgs: extraGitArgs.length > 0 ? extraGitArgs : undefined,
		},
		color,
	};
}

export function hasActiveFilters(filterOptions: FileFilterOptions): boolean {
	return Boolean(filterOptions.include?.length || filterOptions.exclude?.length);
}

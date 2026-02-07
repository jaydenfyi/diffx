import { buildFilePatterns, shouldIncludeFile } from "../filters/file-filter";
import { gitClient } from "../git/git-client";
import type { OutputMode } from "../types";
import {
	buildStatusMapForRange,
	buildStatusMapForWorktree,
	formatNumstatOutput,
	generateUntrackedOutput,
	mergeOutputs,
} from "../utils/overview-utils";
import type { FileFilterOptions, ResolvedRefs } from "./command-types";

type StatRow = {
	filePath: string;
	changeCount: string;
	changeBar: string;
	additions: number;
	deletions: number;
};

type StatSummary = {
	files: number;
	insertions: number;
	deletions: number;
};

function cleanNoIndexPath(output: string): string {
	return output.replace(/\/dev\/null => /g, "");
}

function parseStatOutput(output: string): { rows: StatRow[]; summary: StatSummary } {
	const rows: StatRow[] = [];
	let summary: StatSummary = { files: 0, insertions: 0, deletions: 0 };

	for (const line of output.split("\n")) {
		const idx = line.indexOf("|");
		if (idx >= 0) {
			const leftPart = line.slice(0, idx);
			const rightPart = line.slice(idx + 1);
			const filePath = cleanNoIndexPath(leftPart).trim();
			if (filePath.length > 0) {
				const trimmedRight = rightPart.trim();
				const match = trimmedRight.match(/^(\d+)\s+(.*)$/);
				rows.push({
					filePath,
					changeCount: match ? match[1] : "0",
					changeBar: match ? match[2] : trimmedRight,
					additions: 0,
					deletions: 0,
				});
			}
			continue;
		}

		const trimmed = line.trim();
		if (!trimmed.includes("file changed") && !trimmed.includes("files changed")) {
			continue;
		}

		const filesMatch = trimmed.match(/^(\d+)\s+files?\s+changed/);
		const insertionsMatch = trimmed.match(/(\d+)\s+insertions?\(\+\)/);
		const deletionsMatch = trimmed.match(/(\d+)\s+deletions?\(-\)/);
		if (filesMatch) {
			summary = {
				files: Number.parseInt(filesMatch[1], 10) || 0,
				insertions: insertionsMatch ? Number.parseInt(insertionsMatch[1], 10) || 0 : 0,
				deletions: deletionsMatch ? Number.parseInt(deletionsMatch[1], 10) || 0 : 0,
			};
		}
	}

	return { rows, summary };
}

function parseNumstatOutput(output: string): Map<string, { additions: number; deletions: number }> {
	const map = new Map<string, { additions: number; deletions: number }>();
	for (const line of output.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const parts = trimmed.split("\t");
		if (parts.length < 3) continue;
		const filePath = cleanNoIndexPath(parts.slice(2).join("\t")).trim();
		if (!filePath) continue;
		const additions = Number(parts[0]);
		const deletions = Number(parts[1]);
		map.set(filePath, {
			additions: Number.isFinite(additions) ? additions : 0,
			deletions: Number.isFinite(deletions) ? deletions : 0,
		});
	}
	return map;
}

function buildStatBar(
	additions: number,
	deletions: number,
	width: number,
	color: "always" | "never",
): string {
	if (width <= 0) return "";
	const total = additions + deletions;
	if (total <= 0) return "";

	const effectiveWidth = additions > 0 && deletions > 0 ? Math.max(2, width) : width;
	let plusWidth = additions > 0 ? Math.round((additions / total) * effectiveWidth) : 0;
	let minusWidth = effectiveWidth - plusWidth;

	if (additions > 0 && plusWidth < 1) {
		plusWidth = 1;
	}
	if (deletions > 0 && minusWidth < 1) {
		minusWidth = 1;
	}

	if (plusWidth + minusWidth > effectiveWidth) {
		if (plusWidth > minusWidth && additions > 0) {
			plusWidth = Math.max(1, effectiveWidth - minusWidth);
		} else {
			minusWidth = Math.max(1, effectiveWidth - plusWidth);
		}
	}
	const plus = "+".repeat(plusWidth);
	const minus = "-".repeat(minusWidth);
	if (color === "never") {
		return `${plus}${minus}`;
	}
	const plusColored = plus ? `\u001b[32m${plus}\u001b[m` : "";
	const minusColored = minus ? `\u001b[31m${minus}\u001b[m` : "";
	return `${plusColored}${minusColored}`;
}

function formatStatSummary(summary: StatSummary): string {
	const fileLabel = summary.files === 1 ? "file changed" : "files changed";
	const insertionLabel = summary.insertions === 1 ? "insertion(+)" : "insertions(+)";
	const deletionLabel = summary.deletions === 1 ? "deletion(-)" : "deletions(-)";
	return `${summary.files} ${fileLabel}, ${summary.insertions} ${insertionLabel}, ${summary.deletions} ${deletionLabel}`;
}

function formatStatRows(rows: StatRow[]): string {
	if (rows.length === 0) {
		return "";
	}

	const pathWidth = Math.max(...rows.map((row) => row.filePath.length));
	const countWidth = Math.max(...rows.map((row) => row.changeCount.length));
	return rows
		.map((row) => {
			const fileCol = row.filePath.padEnd(pathWidth);
			const countCol = row.changeCount.padStart(countWidth);
			return ` ${fileCol} | ${countCol} ${row.changeBar}`;
		})
		.join("\n");
}

function parseShortStatOutput(output: string): {
	files: number;
	insertions: number;
	deletions: number;
} {
	const filesMatch = output.match(/(\d+)\s+files?\s+changed/);
	const insertionsMatch = output.match(/(\d+)\s+insertions?/);
	const deletionsMatch = output.match(/(\d+)\s+deletions?/);

	return {
		files: filesMatch ? Number.parseInt(filesMatch[1], 10) : 0,
		insertions: insertionsMatch ? Number.parseInt(insertionsMatch[1], 10) : 0,
		deletions: deletionsMatch ? Number.parseInt(deletionsMatch[1], 10) : 0,
	};
}

async function appendUntrackedStatFiles(
	output: string,
	left: string,
	right: string | undefined,
	filterOptions: FileFilterOptions,
	color: "always" | "never",
): Promise<string> {
	if (right) {
		return output;
	}

	const untracked = await gitClient.getUntrackedFiles();
	const filteredUntracked = untracked.filter((filePath) =>
		shouldIncludeFile(filePath, filterOptions),
	);
	if (filteredUntracked.length === 0) {
		return output;
	}

	const base = parseStatOutput(output);
	const patterns = buildFilePatterns(filterOptions);
	const trackedNumstatOutput = await gitClient.diffNumStatAgainstWorktree(left, {
		files: patterns.length > 0 ? patterns : undefined,
	});
	const trackedNumstat = parseNumstatOutput(trackedNumstatOutput);
	const baseRows = base.rows.map((row) => {
		const counts = trackedNumstat.get(row.filePath);
		if (!counts) return row;
		const total = counts.additions + counts.deletions;
		return {
			...row,
			additions: counts.additions,
			deletions: counts.deletions,
			changeCount: String(total),
		};
	});

	const extraRows: StatRow[] = [];
	let extraSummary: StatSummary = { files: 0, insertions: 0, deletions: 0 };

	for (const filePath of filteredUntracked) {
		const numstatOutput = await gitClient.diffNumStatNoIndex(filePath, color);
		const parsedNumstat = parseNumstatOutput(numstatOutput);
		for (const [parsedPath, counts] of parsedNumstat.entries()) {
			const total = counts.additions + counts.deletions;
			extraRows.push({
				filePath: parsedPath,
				changeCount: String(total),
				changeBar: "",
				additions: counts.additions,
				deletions: counts.deletions,
			});
			extraSummary.files += 1;
			extraSummary.insertions += counts.additions;
			extraSummary.deletions += counts.deletions;
		}
	}

	const rows = [...baseRows, ...extraRows];
	if (rows.length === 0) {
		return output;
	}

	const maxTotalChanges = Math.max(1, ...rows.map((row) => row.additions + row.deletions));
	const maxGraphWidth = 53;
	const normalizedRows = rows.map((row) => {
		const total = row.additions + row.deletions;
		const graphWidth =
			total > 0 ? Math.max(1, Math.round((total / maxTotalChanges) * maxGraphWidth)) : 0;
		return {
			...row,
			changeCount: String(total),
			changeBar: buildStatBar(row.additions, row.deletions, graphWidth, color),
		};
	});

	const combinedSummary: StatSummary = {
		files: base.summary.files + extraSummary.files,
		insertions: base.summary.insertions + extraSummary.insertions,
		deletions: base.summary.deletions + extraSummary.deletions,
	};

	return `${formatStatRows(normalizedRows)}\n ${formatStatSummary(combinedSummary)}`;
}

async function appendUntrackedShortStatFiles(
	output: string,
	filterOptions: FileFilterOptions,
	color: "always" | "never",
): Promise<string> {
	const untracked = await gitClient.getUntrackedFiles();
	const filteredUntracked = untracked.filter((filePath) =>
		shouldIncludeFile(filePath, filterOptions),
	);
	if (filteredUntracked.length === 0) {
		return output;
	}

	const base = parseShortStatOutput(output);

	let untrackedFiles = 0;
	let untrackedInsertions = 0;
	let untrackedDeletions = 0;

	for (const filePath of filteredUntracked) {
		const numstatOutput = await gitClient.diffNumStatNoIndex(filePath, color);
		for (const line of numstatOutput.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const parts = trimmed.split("\t");
			if (parts.length < 2) continue;
			const adds = Number(parts[0]);
			const dels = Number(parts[1]);
			if (Number.isFinite(adds)) untrackedInsertions += adds;
			if (Number.isFinite(dels)) untrackedDeletions += dels;
			untrackedFiles += 1;
		}
	}

	const combined = {
		files: base.files + untrackedFiles,
		insertions: base.insertions + untrackedInsertions,
		deletions: base.deletions + untrackedDeletions,
	};

	return ` ${combined.files} files changed, ${combined.insertions} insertions(+), ${combined.deletions} deletions(-)`;
}

async function appendUntrackedFiles(
	output: string,
	mode: OutputMode,
	left: string,
	right: string | undefined,
	filterOptions: FileFilterOptions,
	color: "always" | "never",
): Promise<string> {
	if (right) {
		return output;
	}

	if (mode === "stat") {
		return appendUntrackedStatFiles(output, left, right, filterOptions, color);
	}

	if (mode === "shortstat") {
		return appendUntrackedShortStatFiles(output, filterOptions, color);
	}

	const untracked = await gitClient.getUntrackedFiles();
	const filteredUntracked = untracked.filter((filePath) =>
		shouldIncludeFile(filePath, filterOptions),
	);

	if (filteredUntracked.length === 0) {
		return output;
	}

	const untrackedOutput = await generateUntrackedOutput(mode, filteredUntracked, color, undefined);
	return mergeOutputs(output, untrackedOutput);
}

export async function hasUnfilteredChanges(refs: ResolvedRefs): Promise<boolean> {
	if (!refs.right) {
		return gitClient.hasWorktreeChanges();
	}

	const shortstat = await gitClient.diffShortStat(refs.left, refs.right, undefined);
	return shortstat.trim().length > 0;
}

export async function processWorktreeOutput(
	output: string,
	mode: OutputMode,
	refs: ResolvedRefs,
	filterOptions: FileFilterOptions,
	color: "always" | "never",
	useSummaryFormat: boolean,
): Promise<string> {
	let result = await appendUntrackedFiles(
		output,
		mode,
		refs.left,
		refs.right || undefined,
		filterOptions,
		color,
	);

	if (mode !== "numstat" || !useSummaryFormat) {
		return result;
	}

	const statusMap = refs.right
		? await buildStatusMapForRange(refs.left, refs.right)
		: await buildStatusMapForWorktree(filterOptions);

	result = formatNumstatOutput(result, statusMap);
	return result;
}

/**
 * Numstat output helpers
 */

import type { OutputMode } from "../types";
import { gitClient } from "../git/git-client";
import { shouldIncludeFile } from "../filters/file-filter";

type StatusMap = Map<string, string>;

const StatusCodeByName = {
	UNTRACKED: "U",
	UNMERGED: "U",
	DELETED: "D",
	ADDED: "A",
	RENAMED: "R",
	COPIED: "C",
	MODIFIED: "M",
	IGNORED: "!",
	UNKNOWN: "?",
} as const;

function hasStatusCode(file: { working_dir: string; index: string }, code: string): boolean {
	return file.working_dir === code || file.index === code;
}

function resolveStatusCode(file: { working_dir: string; index: string }): string {
	if (hasStatusCode(file, "?")) return StatusCodeByName.UNTRACKED;
	if (hasStatusCode(file, "U")) return StatusCodeByName.UNMERGED;
	if (file.index === "!" && file.working_dir === "!") return StatusCodeByName.IGNORED;
	if (hasStatusCode(file, "D")) return StatusCodeByName.DELETED;
	if (hasStatusCode(file, "A")) return StatusCodeByName.ADDED;
	if (hasStatusCode(file, "R")) return StatusCodeByName.RENAMED;
	if (hasStatusCode(file, "C")) return StatusCodeByName.COPIED;
	if (hasStatusCode(file, "M")) return StatusCodeByName.MODIFIED;
	return StatusCodeByName.UNKNOWN;
}

export async function generateUntrackedOutput(
	mode: OutputMode,
	files: string[],
	color?: "always" | "never" | "auto",
	statAlignWidth?: number,
): Promise<string> {
	const chunks: string[] = [];
	const statLines: string[] = [];
	let totalInsertions = 0;
	let totalDeletions = 0;
	let totalFiles = 0;
	for (const filePath of files) {
		switch (mode) {
			case "diff":
			case "patch":
				chunks.push(cleanNoIndexPath(await gitClient.diffNoIndex(filePath, color)));
				break;
			case "stat":
				{
					const statOutput = await gitClient.diffStatNoIndex(filePath, color);
					const statLine = extractStatLine(statOutput);
					if (statLine) {
						statLines.push(formatStatLine(statLine, statAlignWidth));
					}

					const numstat = await gitClient.diffNumStatNoIndex(filePath, color);
					for (const line of numstat.split("\n")) {
						const trimmed = line.trim();
						if (!trimmed) continue;
						const parts = trimmed.split("\t");
						if (parts.length < 2) continue;
						const adds = Number(parts[0]);
						const dels = Number(parts[1]);
						totalInsertions += Number.isFinite(adds) ? adds : 0;
						totalDeletions += Number.isFinite(dels) ? dels : 0;
						totalFiles += 1;
					}
				}
				break;
			case "numstat":
				chunks.push(cleanNoIndexPath(await gitClient.diffNumStatNoIndex(filePath, color)).trim());
				break;
			case "shortstat":
				{
					// Accumulate totals for shortstat
					const numstat = await gitClient.diffNumStatNoIndex(filePath, color);
					for (const line of numstat.split("\n")) {
						const trimmed = line.trim();
						if (!trimmed) continue;
						const parts = trimmed.split("\t");
						if (parts.length < 2) continue;
						const adds = Number(parts[0]);
						const dels = Number(parts[1]);
						totalInsertions += Number.isFinite(adds) ? adds : 0;
						totalDeletions += Number.isFinite(dels) ? dels : 0;
						totalFiles += 1;
					}
				}
				break;
			case "name-only":
				// Just the filename, one per line
				chunks.push(filePath);
				break;
			case "name-status":
				// Filename with status "U" for untracked
				chunks.push(`U\t${filePath}`);
				break;
			case "summary":
				// Summary shows create operations for untracked files
				chunks.push(`create mode 100644 ${filePath}`);
				break;
			default:
				throw new Error(`Unknown output mode: ${mode}`);
		}
	}
	if (mode === "stat") {
		if (statLines.length === 0) return "";
		const summary = formatSummaryLine(totalFiles, totalInsertions, totalDeletions);
		return `${statLines.join("\n")}\n ${summary}`;
	}

	if (mode === "shortstat") {
		if (totalFiles === 0) return "";
		return formatSummaryLine(totalFiles, totalInsertions, totalDeletions);
	}

	return chunks.filter((chunk) => chunk.trim().length > 0).join("\n");
}

export function mergeOutputs(base: string, extra: string): string {
	if (!base) return extra;
	if (!extra) return base;
	return `${base.trimEnd()}\n${extra.trimStart()}`;
}

export async function buildStatusMapForWorktree(filterOptions: {
	include?: string[];
	exclude?: string[];
}): Promise<StatusMap> {
	const status = await gitClient.getStatus();
	const map: StatusMap = new Map();

	for (const filePath of status.not_added) {
		if (shouldIncludeFile(filePath, filterOptions)) {
			map.set(filePath, "U");
		}
	}

	for (const file of status.files) {
		if (!shouldIncludeFile(file.path, filterOptions)) continue;
		if (map.get(file.path) === StatusCodeByName.UNTRACKED) continue;
		map.set(file.path, resolveStatusCode(file));
	}

	return map;
}

export async function buildStatusMapForRange(left: string, right: string): Promise<StatusMap> {
	const output = await gitClient.diffNameStatus(left, right, undefined);
	const map: StatusMap = new Map();
	for (const line of output.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const parts = trimmed.split("\t");
		const status = parts[0];
		if (status.startsWith("R") || status.startsWith("C")) {
			const filePath = parts[2] ?? parts[1];
			if (filePath) map.set(filePath, status[0]);
			continue;
		}
		const filePath = parts[1];
		if (filePath) map.set(filePath, status[0]);
	}
	return map;
}

export function formatNumstatOutput(output: string, statusMap: StatusMap): string {
	const rows = output
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const parts = line.split("\t");
			if (parts.length < 3) {
				return { filePath: line, status: "?", adds: "0", dels: "0" };
			}
			const adds = parts[0];
			const dels = parts[1];
			const filePath = parts.slice(2).join("\t").trim();
			const status = statusMap.get(filePath) ?? "?";
			return { filePath, status, adds, dels };
		});

	const fileWidth = Math.max(4, ...rows.map((row) => row.filePath.length));
	const statusWidth = 1;
	const addsWidth = Math.max(1, ...rows.map((row) => row.adds.length));
	const delsWidth = Math.max(1, ...rows.map((row) => row.dels.length));

	const header = `${"FILE".padEnd(fileWidth)}  ${"S".padEnd(statusWidth)}  ${"+".padStart(addsWidth)}  ${"-".padStart(delsWidth)}`;
	const body = rows
		.map((row) => {
			const fileCol = row.filePath.padEnd(fileWidth);
			const statusCol = row.status.padEnd(statusWidth);
			const addsCol = row.adds.padStart(addsWidth);
			const delsCol = row.dels.padStart(delsWidth);
			return `${fileCol}  ${statusCol}  ${addsCol}  ${delsCol}`;
		})
		.join("\n");
	return `${header}\n${body}`;
}

function cleanNoIndexPath(output: string): string {
	return output.replace(/\/dev\/null => /g, "");
}

function formatSummaryLine(files: number, insertions: number, deletions: number): string {
	const fileLabel = files === 1 ? "file changed" : "files changed";
	const insertLabel = insertions === 1 ? "insertion(+)" : "insertions(+)";
	const deleteLabel = deletions === 1 ? "deletion(-)" : "deletions(-)";
	return `${files} ${fileLabel}, ${insertions} ${insertLabel}, ${deletions} ${deleteLabel}`;
}

function extractStatLine(output: string): string | null {
	for (const line of output.split("\n")) {
		if (line.includes("|")) {
			return line;
		}
	}
	return null;
}

function formatStatLine(line: string, alignWidth?: number): string {
	const [leftPart, rightPart = ""] = line.split("|");
	const rawFilePath = cleanNoIndexPath(leftPart).trim();
	const fileWithLead = ` ${rawFilePath}`;
	const width = Math.max(alignWidth ?? 0, fileWithLead.length);
	const fileCol = fileWithLead.padEnd(width);
	return `${fileCol} |${rightPart}`;
}

export function formatStatOutput(output: string, alignWidth: number): string {
	return output
		.split("\n")
		.map((line) => (line.includes("|") ? formatStatLine(line, alignWidth) : line))
		.join("\n");
}

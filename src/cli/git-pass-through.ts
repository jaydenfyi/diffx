import { gitClient } from "../git/git-client";
import { parseRangeInput } from "../parsers/range-parser";
import { resolveRefs } from "../resolvers/ref-resolver";
import { DiffxError, ExitCode } from "../types";
import type { PartitionedArgs } from "./arg-partitioner";
import { pageOutput } from "./pager";

export async function runGitPassThrough({
	partitioned,
	rangeOrUrl,
	useGitCompat,
	pager,
	noPager,
}: {
	partitioned: PartitionedArgs;
	rangeOrUrl: string | undefined;
	useGitCompat: boolean;
	pager: boolean | undefined;
	noPager: boolean | undefined;
}): Promise<void> {
	let cleanup: (() => Promise<void>) | undefined;

	let left = "";
	let right = "";

	if (rangeOrUrl) {
		let parsed: ReturnType<typeof parseRangeInput> | undefined;
		try {
			parsed = parseRangeInput(rangeOrUrl);
		} catch (error) {
			if (error instanceof DiffxError && error.exitCode === ExitCode.INVALID_INPUT) {
				parsed = undefined;
			} else {
				throw error;
			}
		}
		if (!parsed) {
			if (!partitioned.gitArgs.includes(rangeOrUrl)) {
				left = rangeOrUrl;
			}
		} else if (parsed.type === "local-range") {
			left = parsed.left;
			right = parsed.right;
		} else {
			const resolved = await resolveRefs(parsed);
			left = resolved.left;
			right = resolved.right;
			cleanup = resolved.cleanup;
		}
	} else if (useGitCompat) {
		left = "";
		right = "";
	}

	const gitDiffArgs: string[] = [];
	if (left) gitDiffArgs.push(left);
	if (right) gitDiffArgs.push(right);
	if (partitioned.pathspecs.length > 0) {
		gitDiffArgs.push("--");
		gitDiffArgs.push(...partitioned.pathspecs);
	}

	const fullGitArgs = [...partitioned.gitArgs, ...gitDiffArgs];

	try {
		const result = await gitClient.runGitDiffRaw(fullGitArgs);
		if (result.exitCode !== 0) {
			const message = result.stderr.trim().length > 0 ? result.stderr : "git diff failed";
			throw new DiffxError(message, ExitCode.GIT_ERROR);
		}

		const output = result.stdout;
		const disablePager = Boolean(noPager);
		const paged = await pageOutput(output, {
			force: pager,
			disable: disablePager,
		});
		if (!paged) {
			process.stdout.write(output);
		}
	} finally {
		if (cleanup) {
			try {
				await cleanup();
			} catch {
				// Ignore cleanup errors
			}
		}
	}
}

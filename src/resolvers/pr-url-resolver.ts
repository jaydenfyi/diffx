/**
 * GitHub PR URL resolver
 * Handles resolution of GitHub PR URLs and pr:OWNER/REPO#123 format
 */

import type { GitHubPRUrl, RefRange } from "../types";
import { gitClient } from "../git/git-client";
import { buildGitHubUrl, createTempRefPrefix } from "../git/utils";
import { DiffxError, ExitCode } from "../types";

type PRResolvedRefs = {
	headRef: string;
	mergeRef: string;
	cleanupRefs: string[];
};

async function fetchPRRefs(pr: GitHubPRUrl, tempPrefix: string): Promise<PRResolvedRefs> {
	const { owner, repo, prNumber } = pr;
	const remoteUrl = buildGitHubUrl(owner, repo);

	const headRef = `${tempPrefix}/pull/${prNumber}/head`;
	const mergeRef = `${tempPrefix}/pull/${prNumber}/merge`;

	await gitClient.fetchFromUrl(
		remoteUrl,
		[`refs/pull/${prNumber}/head:${headRef}`, `refs/pull/${prNumber}/merge:${mergeRef}`],
		2,
	);

	return {
		headRef,
		mergeRef,
		cleanupRefs: [headRef, mergeRef],
	};
}

/**
 * Resolve a GitHub PR to local refs
 */
export async function resolvePRRefs(range: RefRange): Promise<{
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
}> {
	if (!range.ownerRepo || range.prNumber === undefined) {
		throw new DiffxError("Invalid PR ref", ExitCode.INVALID_INPUT);
	}

	try {
		const [owner, repo] = range.ownerRepo.split("/");
		if (!owner || !repo) {
			throw new DiffxError(`Invalid owner/repo: ${range.ownerRepo}`, ExitCode.INVALID_INPUT);
		}

		const tempPrefix = createTempRefPrefix();
		const refs = await fetchPRRefs({ owner, repo, prNumber: range.prNumber }, tempPrefix);

		// The merge ref is the PR head merged into the base branch
		// Diffing merge^1..merge yields the PR changes (mirrors GitHub "Files changed")
		return {
			left: `${refs.mergeRef}^1`, // The first parent of the merge commit (the base branch)
			right: refs.mergeRef,
			cleanup: async () => {
				await gitClient.deleteRefs(refs.cleanupRefs);
			},
		};
	} catch (error) {
		throw new DiffxError(
			`Failed to fetch PR refs: ${(error as Error).message}`,
			ExitCode.GIT_ERROR,
		);
	}
}

/**
 * Resolve a PR-to-PR range (compare PR heads)
 */
export async function resolvePRRangeRefs(range: RefRange): Promise<{
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
}> {
	if (!range.leftPr || !range.rightPr) {
		throw new DiffxError("Invalid PR range", ExitCode.INVALID_INPUT);
	}

	try {
		const tempPrefix = createTempRefPrefix();
		const leftRefs = await fetchPRRefs(range.leftPr, `${tempPrefix}/left`);
		const rightRefs = await fetchPRRefs(range.rightPr, `${tempPrefix}/right`);

		return {
			left: leftRefs.headRef,
			right: rightRefs.headRef,
			cleanup: async () => {
				await gitClient.deleteRefs([...leftRefs.cleanupRefs, ...rightRefs.cleanupRefs]);
			},
		};
	} catch (error) {
		throw new DiffxError(
			`Failed to fetch PR range refs: ${(error as Error).message}`,
			ExitCode.GIT_ERROR,
		);
	}
}

/**
 * Resolve a GitHub commit URL to local refs
 * Shows the changes in that commit (commit^..commit)
 */
export async function resolveGitHubCommitRefs(range: RefRange): Promise<{
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
}> {
	if (!range.ownerRepo || !range.commitSha) {
		throw new DiffxError("Invalid GitHub commit URL", ExitCode.INVALID_INPUT);
	}

	try {
		const [owner, repo] = range.ownerRepo.split("/");
		if (!owner || !repo) {
			throw new DiffxError(`Invalid owner/repo: ${range.ownerRepo}`, ExitCode.INVALID_INPUT);
		}

		const remoteUrl = buildGitHubUrl(owner, repo);
		const tempPrefix = createTempRefPrefix();
		const commitRef = `${tempPrefix}/commit/${range.commitSha}`;

		// Fetch with depth=2 to include the parent commit
		await gitClient.fetchFromUrl(remoteUrl, [`${range.commitSha}:${commitRef}`], 2);

		return {
			left: `${commitRef}^`, // Parent of the commit
			right: commitRef,
			cleanup: async () => {
				await gitClient.deleteRefs([commitRef]);
			},
		};
	} catch (error) {
		throw new DiffxError(
			`Failed to fetch commit refs: ${(error as Error).message}`,
			ExitCode.GIT_ERROR,
		);
	}
}

/**
 * Resolve a GitHub PR changes URL (compare two commits in a PR)
 */
export async function resolveGitHubPRChangesRefs(range: RefRange): Promise<{
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
}> {
	if (!range.ownerRepo || !range.prNumber || !range.leftCommitSha || !range.rightCommitSha) {
		throw new DiffxError("Invalid GitHub PR changes URL", ExitCode.INVALID_INPUT);
	}

	try {
		const [owner, repo] = range.ownerRepo.split("/");
		if (!owner || !repo) {
			throw new DiffxError(`Invalid owner/repo: ${range.ownerRepo}`, ExitCode.INVALID_INPUT);
		}

		const remoteUrl = buildGitHubUrl(owner, repo);
		const tempPrefix = createTempRefPrefix();
		const leftCommitRef = `${tempPrefix}/left-commit/${range.leftCommitSha}`;
		const rightCommitRef = `${tempPrefix}/right-commit/${range.rightCommitSha}`;

		// Fetch both commits directly
		await gitClient.fetchFromUrl(
			remoteUrl,
			[`${range.leftCommitSha}:${leftCommitRef}`, `${range.rightCommitSha}:${rightCommitRef}`],
			2,
		);

		return {
			left: leftCommitRef,
			right: rightCommitRef,
			cleanup: async () => {
				await gitClient.deleteRefs([leftCommitRef, rightCommitRef]);
			},
		};
	} catch (error) {
		throw new DiffxError(
			`Failed to fetch PR changes refs: ${(error as Error).message}`,
			ExitCode.GIT_ERROR,
		);
	}
}

/**
 * Resolve a GitHub compare URL (compare two refs, possibly across forks)
 */
export async function resolveGitHubCompareRefs(range: RefRange): Promise<{
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
}> {
	if (!range.ownerRepo || !range.leftRef || !range.rightRef) {
		throw new DiffxError("Invalid GitHub compare URL", ExitCode.INVALID_INPUT);
	}

	try {
		const [owner, repo] = range.ownerRepo.split("/");
		if (!owner || !repo) {
			throw new DiffxError(`Invalid owner/repo: ${range.ownerRepo}`, ExitCode.INVALID_INPUT);
		}

		const tempPrefix = createTempRefPrefix();
		const leftRef = `${tempPrefix}/left/${range.leftRef}`;
		const rightRef = `${tempPrefix}/right/${range.rightRef}`;
		const cleanupRefs = [leftRef, rightRef];

		// Fetch left ref from the base repo
		const leftUrl = buildGitHubUrl(owner, repo);

		// Fetch right ref - may be from same repo or a different fork
		const rightOwner = range.rightOwner || owner;
		const rightRepo = range.rightRepo || repo;
		const rightUrl = buildGitHubUrl(rightOwner, rightRepo);

		// Helper to determine if a ref looks like a commit SHA (hex only, reasonable length)
		const isCommitSha = (ref: string) => /^[a-f0-9]{7,40}$/i.test(ref);

		// Helper to build refspec - try multiple possible locations
		const buildRefspec = (ref: string, targetRef: string): string[] => {
			// If it looks like a commit SHA, fetch it directly
			if (isCommitSha(ref)) {
				return [`${ref}:${targetRef}`];
			}
			// Otherwise try multiple ref types (heads, tags)
			return [`refs/heads/${ref}:${targetRef}`, `refs/tags/${ref}:${targetRef}`];
		};

		const fetchRef = async (url: string, ref: string, targetRef: string): Promise<string> => {
			let fetchError: Error | null = null;
			for (const refspec of buildRefspec(ref, targetRef)) {
				try {
					await gitClient.fetchFromUrl(url, [refspec], 1);
					return refspec;
				} catch (e) {
					fetchError = e as Error;
				}
			}
			throw fetchError ?? new Error(`Failed to fetch ref: ${ref}`);
		};

		// Fetch left/right refs - try branches first, then tags, then direct SHA
		const leftRefspec = await fetchRef(leftUrl, range.leftRef, leftRef);
		const rightRefspec = await fetchRef(rightUrl, range.rightRef, rightRef);

		// GitHub compare URLs use three-dot semantics (merge-base..right)
		const getMergeBase = async (): Promise<string | null> => {
			try {
				const mergeBase = (await gitClient.mergeBase(leftRef, rightRef)).trim();
				return mergeBase.length > 0 ? mergeBase : null;
			} catch {
				return null;
			}
		};

		let mergeBase = await getMergeBase();
		if (!mergeBase) {
			// Shallow fetches may not include enough history to find a merge base.
			await gitClient.fetchFromUrl(leftUrl, [leftRefspec], 200);
			await gitClient.fetchFromUrl(rightUrl, [rightRefspec], 200);
			mergeBase = await getMergeBase();
		}

		if (!mergeBase) {
			throw new Error("Failed to determine merge base for compare refs");
		}

		return {
			left: mergeBase,
			right: rightRef,
			cleanup: async () => {
				await gitClient.deleteRefs(cleanupRefs);
			},
		};
	} catch (error) {
		throw new DiffxError(
			`Failed to fetch compare refs: ${(error as Error).message}`,
			ExitCode.GIT_ERROR,
		);
	}
}

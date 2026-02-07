/**
 * Shared types for diffx
 */

/** Output mode for diff/patch generation */
export type OutputMode =
	| "diff"
	| "patch"
	| "stat"
	| "numstat"
	| "shortstat"
	| "name-only"
	| "name-status"
	| "summary";

/** Patch generation strategy */
export type PatchStyle = "format-patch" | "diff";

/** Type of Git reference input */
export type RefType =
	| "local-range"
	| "remote-range"
	| "pr-ref"
	| "github-url"
	| "pr-range"
	| "git-url-range"
	| "github-commit-url"
	| "github-pr-changes-url"
	| "github-compare-url"
	| "gitlab-mr-ref";

/** Parsed reference range */
export interface RefRange {
	type: RefType;
	left: string;
	right: string;
	/** Owner/repo for remote refs (e.g., "octocat/Hello-World") */
	ownerRepo?: string;
	/** PR/MR number for PR/MR refs */
	prNumber?: number;
	/** Left PR for PR range */
	leftPr?: GitHubPRUrl;
	/** Right PR for PR range */
	rightPr?: GitHubPRUrl;
	/** Left MR for GitLab MR range */
	leftMr?: GitLabMRUrl;
	/** Right MR for GitLab MR range */
	rightMr?: GitLabMRUrl;
	/** Left git URL for git-url-range */
	leftGitUrl?: string;
	/** Right git URL for git-url-range */
	rightGitUrl?: string;
	/** Commit SHA for github-commit-url */
	commitSha?: string;
	/** PR changes data for github-pr-changes-url */
	leftCommitSha?: string;
	rightCommitSha?: string;
	/** Left ref for github-compare-url */
	leftRef?: string;
	/** Right ref for github-compare-url */
	rightRef?: string;
	/** Right owner for cross-fork compare */
	rightOwner?: string;
	/** Right repo for cross-fork compare */
	rightRepo?: string;
}

/** Parsed GitHub PR URL */
export interface GitHubPRUrl {
	owner: string;
	repo: string;
	prNumber: number;
}

/** Parsed GitLab MR URL */
export interface GitLabMRUrl {
	owner: string;
	repo: string;
	mrNumber: number;
}

/** Parsed GitHub commit URL */
export interface GitHubCommitUrl {
	owner: string;
	repo: string;
	commitSha: string;
}

/** Parsed GitHub PR changes URL */
export interface GitHubPRChangesUrl {
	owner: string;
	repo: string;
	prNumber: number;
	leftCommitSha: string;
	rightCommitSha: string;
}

/** Parsed GitHub compare URL */
export interface GitHubCompareUrl {
	owner: string;
	repo: string;
	leftRef: string;
	rightRef: string;
	rightOwner?: string; // For cross-fork comparisons
	rightRepo?: string; // For cross-fork comparisons
}

/** File filter options */
export interface FilterOptions {
	include?: string[];
	exclude?: string[];
}

/** CLI options */
export interface DiffxOptions {
	mode: OutputMode;
	include?: string | string[];
	exclude?: string | string[];
}

/** Git operation result */
export interface GitResult {
	stdout: string;
	exitCode: number;
}

/** Error types with exit codes */
export const ExitCode = {
	SUCCESS: 0,
	NO_FILES_MATCHED: 1,
	INVALID_INPUT: 2,
	GIT_ERROR: 3,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/** Custom error with exit code */
export class DiffxError extends Error {
	_tag = "DiffxError" as const;

	constructor(
		message: string,
		public readonly exitCode: ExitCode,
	) {
		super(message);
		this.name = "DiffxError";
	}
}

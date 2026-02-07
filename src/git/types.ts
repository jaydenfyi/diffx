/**
 * Git-specific types
 */

/** Diff options for diffx */
export interface GitDiffOptions {
	/** File patterns to include/exclude */
	files?: string[];
	/** Color mode for diff output */
	color?: "always" | "never" | "auto";
	/** Extra git arguments to pass through */
	extraArgs?: string[];
}

/** Remote reference */
export interface RemoteRef {
	owner: string;
	repo: string;
	ref: string;
}

/** PR reference */
export interface PRRef {
	owner: string;
	repo: string;
	prNumber: number;
}

/** Git remote info */
export interface GitRemote {
	name: string;
	fetchUrl?: string;
	pushUrl?: string;
}

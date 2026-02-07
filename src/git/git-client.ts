/**
 * Git client wrapper using simple-git
 */

import git from "simple-git";
import type { StatusResult } from "simple-git";
import type { GitDiffOptions, GitRemote } from "./types";

/**
 * Git client wrapper for diffx operations
 */
export class GitClient {
	private readonly git = git();

	private buildColorFlag(color: "always" | "never" | "auto" | undefined): string[] {
		return color ? [`--color=${color}`] : [];
	}

	private buildColorArgs(options: GitDiffOptions | undefined): string[] {
		return options?.color ? [`--color=${options.color}`] : [];
	}

	private buildExtraArgs(options: GitDiffOptions | undefined): string[] {
		return options?.extraArgs ?? [];
	}

	/**
	 * Generate a unified diff between two refs
	 */
	async diff(left: string, right: string, options: GitDiffOptions | undefined): Promise<string> {
		// Use -- to separate refs from paths, and handle refs with special characters
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			left,
			`${right}`,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		} else {
			args.push("--");
		}
		return this.git.diff(args);
	}

	/**
	 * Generate a unified diff between a ref and the working tree (includes staged + unstaged)
	 */
	async diffAgainstWorktree(ref: string, options: GitDiffOptions | undefined): Promise<string> {
		const args = [...this.buildExtraArgs(options), ...this.buildColorArgs(options), ref];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		} else {
			args.push("--");
		}
		return this.git.diff(args);
	}

	/**
	 * Generate a patch between two refs
	 */
	async formatPatch(
		left: string,
		right: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = ["format-patch", "--stdout", `${left}..${right}`];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.raw(args);
	}

	/**
	 * Generate diff statistics between two refs
	 */
	async diffStat(
		left: string,
		right: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--stat",
			`${left}..${right}`,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate diff statistics between a ref and the working tree
	 */
	async diffStatAgainstWorktree(ref: string, options: GitDiffOptions | undefined): Promise<string> {
		const args = [...this.buildExtraArgs(options), ...this.buildColorArgs(options), "--stat", ref];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate per-file additions/deletions between two refs
	 */
	async diffNumStat(
		left: string,
		right: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--numstat",
			`${left}..${right}`,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate per-file additions/deletions between a ref and the working tree
	 */
	async diffNumStatAgainstWorktree(
		ref: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--numstat",
			ref,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate summary statistics between two refs
	 */
	async diffShortStat(
		left: string,
		right: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--shortstat",
			`${left}..${right}`,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate name-only output between two refs
	 */
	async diffNameOnly(
		left: string,
		right: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--name-only",
			`${left}..${right}`,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate summary statistics between a ref and the working tree
	 */
	async diffShortStatAgainstWorktree(
		ref: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--shortstat",
			ref,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate name-only output between a ref and the working tree
	 */
	async diffNameOnlyAgainstWorktree(
		ref: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--name-only",
			ref,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate name-status output between a ref and the working tree
	 */
	async diffNameStatusAgainstWorktree(
		ref: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--name-status",
			ref,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Check if a ref exists locally
	 */
	async refExists(ref: string): Promise<boolean> {
		try {
			await this.git.revparse(["--verify", `refs/heads/${ref}`]);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Check if a ref exists (local or remote)
	 */
	async refExistsAny(ref: string): Promise<boolean> {
		try {
			await this.git.revparse(["--verify", ref]);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Add a remote repository
	 */
	async addRemote(name: string, url: string): Promise<void> {
		await this.git.remote(["add", name, url]);
	}

	/**
	 * Get all remotes
	 */
	async getRemotes(): Promise<GitRemote[]> {
		const remotes = await this.git.getRemotes(true);
		return remotes.map((r) => ({
			name: r.name,
			fetchUrl: r.refs.fetch,
			pushUrl: r.refs.push,
		}));
	}

	/**
	 * Fetch refs from a remote (shallow fetch)
	 */
	async fetch(remote: string, refs: string[] | undefined): Promise<void> {
		const args = ["fetch", "--no-tags", "--depth", "1", remote];
		if (refs && refs.length > 0) {
			args.push(...refs);
		}
		await this.git.raw(args);
	}

	/**
	 * Fetch refs from a URL into explicit refspecs (shallow fetch)
	 */
	async fetchFromUrl(url: string, refspecs: string[], depth: number): Promise<void> {
		const args = ["fetch", "--no-tags", "--depth", String(depth), url, ...refspecs];
		await this.git.raw(args);
	}

	/**
	 * Fetch a specific PR reference (without depth limit to get merge history)
	 */
	async fetchPR(remote: string, prNumber: number): Promise<void> {
		// Fetch PR refs into remote-tracking refs so they can be referenced later.
		// Use a small depth to include merge parents (merge^1, merge^2).
		const headRef = `refs/pull/${prNumber}/head:refs/remotes/${remote}/pull/${prNumber}/head`;
		const mergeRef = `refs/pull/${prNumber}/merge:refs/remotes/${remote}/pull/${prNumber}/merge`;
		await this.git.raw(["fetch", "--no-tags", "--depth", "2", remote, headRef, mergeRef]);
	}

	/**
	 * Delete refs if they exist
	 */
	async deleteRefs(refs: string[]): Promise<void> {
		await Promise.all(
			refs.map(async (ref) => {
				try {
					await this.git.raw(["update-ref", "-d", ref]);
				} catch {
					// Ignore missing refs
				}
			}),
		);
	}

	/**
	 * Get the current branch name
	 */
	async getCurrentBranch(): Promise<string> {
		const branch = await this.git.revparse(["--abbrev-ref", "HEAD"]);
		return branch.trim();
	}

	/**
	 * Get the HEAD commit hash
	 */
	async getHeadHash(): Promise<string> {
		return this.git.revparse(["HEAD"]);
	}

	/**
	 * Check if the working tree has staged or unstaged changes
	 */
	async hasWorktreeChanges(): Promise<boolean> {
		const status = await this.git.status();
		return status.files.length > 0 || status.not_added.length > 0;
	}

	/**
	 * Get working tree status
	 */
	async getStatus(): Promise<StatusResult> {
		return this.git.status();
	}

	/**
	 * Get untracked files
	 */
	async getUntrackedFiles(): Promise<string[]> {
		const status = await this.git.status();
		return status.not_added;
	}

	/**
	 * Generate a unified diff for an untracked file (vs /dev/null)
	 */
	async diffNoIndex(
		filePath: string,
		color: "always" | "never" | "auto" | undefined,
	): Promise<string> {
		const colorArgs = this.buildColorFlag(color);
		return this.git.raw(["diff", ...colorArgs, "--no-index", "--", "/dev/null", filePath]);
	}

	/**
	 * Generate diff statistics for an untracked file (vs /dev/null)
	 */
	async diffStatNoIndex(
		filePath: string,
		color: "always" | "never" | "auto" | undefined,
	): Promise<string> {
		const colorArgs = this.buildColorFlag(color);
		return this.git.raw([
			"diff",
			...colorArgs,
			"--no-index",
			"--stat",
			"--",
			"/dev/null",
			filePath,
		]);
	}

	/**
	 * Generate per-file additions/deletions for an untracked file (vs /dev/null)
	 */
	async diffNumStatNoIndex(
		filePath: string,
		color: "always" | "never" | "auto" | undefined,
	): Promise<string> {
		const colorArgs = this.buildColorFlag(color);
		return this.git.raw([
			"diff",
			...colorArgs,
			"--no-index",
			"--numstat",
			"--",
			"/dev/null",
			filePath,
		]);
	}

	/**
	 * Generate name-status diff between two refs
	 */
	async diffNameStatus(
		left: string,
		right: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--name-status",
			`${left}..${right}`,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate summary output between two refs
	 */
	async diffSummary(
		left: string,
		right: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--summary",
			`${left}..${right}`,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Generate summary output between a ref and the working tree
	 */
	async diffSummaryAgainstWorktree(
		ref: string,
		options: GitDiffOptions | undefined,
	): Promise<string> {
		const args = [
			...this.buildExtraArgs(options),
			...this.buildColorArgs(options),
			"--summary",
			ref,
		];
		if (options?.files && options.files.length > 0) {
			args.push("--", ...options.files);
		}
		return this.git.diff(args);
	}

	/**
	 * Get the default branch ref for a remote (e.g., origin/main)
	 */
	async getRemoteHeadRef(remote: string): Promise<string | null> {
		try {
			const ref = await this.git.raw([
				"symbolic-ref",
				"--quiet",
				"--short",
				`refs/remotes/${remote}/HEAD`,
			]);
			const trimmed = ref.trim();
			return trimmed.length > 0 ? trimmed : null;
		} catch {
			return null;
		}
	}

	/**
	 * Get a best-effort default branch ref (remote or local)
	 */
	async getDefaultBranchRef(): Promise<string | null> {
		const remotes = await this.getRemotes();
		const remoteNames = remotes.map((r) => r.name);
		const preferredRemotes = remoteNames.includes("origin")
			? ["origin", ...remoteNames.filter((name) => name !== "origin")]
			: remoteNames;

		for (const remote of preferredRemotes) {
			const headRef = await this.getRemoteHeadRef(remote);
			if (headRef) return headRef;
		}

		const fallbackBranchNames = ["main", "master", "develop", "trunk"];
		for (const remote of preferredRemotes) {
			for (const branch of fallbackBranchNames) {
				const ref = `${remote}/${branch}`;
				if (await this.refExistsAny(ref)) return ref;
			}
		}

		for (const branch of fallbackBranchNames) {
			if (await this.refExistsAny(branch)) return branch;
		}

		return null;
	}

	/**
	 * Get the merge-base between two refs
	 */
	async mergeBase(left: string, right: string): Promise<string> {
		return this.git.raw(["merge-base", left, right]);
	}

	/**
	 * Get a git config value
	 */
	async getConfigValue(
		key: string,
		scope: "all" | "local" | "global" | "system" = "all",
	): Promise<string | null> {
		try {
			const scopeArgs = scope === "all" ? [] : [`--${scope}`];
			const value = await this.git.raw(["config", ...scopeArgs, "--get", key]);
			const trimmed = value.trim();
			return trimmed.length > 0 ? trimmed : null;
		} catch {
			return null;
		}
	}

	/**
	 * Validate that two refs can be diffed
	 */
	async validateRefs(left: string, right: string): Promise<boolean> {
		try {
			await this.git.diff([`${left}..${right}`]);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Run native git diff with raw arguments
	 * This is the primary method for git diff pass-through compatibility
	 *
	 * @param args - Raw git diff arguments (e.g., ["--stat", "HEAD", "--", "src/"])
	 * @param options - Execution options
	 * @returns Git diff output and exit information
	 */
	async runGitDiffRaw(
		args: string[],
		options: { capture?: boolean } = {},
	): Promise<{ stdout: string; stderr: string; exitCode: number }> {
		const { capture = true } = options;

		// Detect TTY for color output
		const isTTY = process.stdout.isTTY;
		const colorArgs = isTTY ? ["--color=always"] : ["--color=never"];

		try {
			// Build the full command: git diff <color> <args>
			const fullArgs = ["diff", ...colorArgs, ...args];

			if (capture) {
				// Capture mode: return output as string
				const stdout = await this.git.raw(fullArgs);
				return { stdout, stderr: "", exitCode: 0 };
			} else {
				// Streaming mode: for future TTY/pager support
				// For now, we still capture but this allows for future streaming implementation
				const stdout = await this.git.raw(fullArgs);
				return { stdout, stderr: "", exitCode: 0 };
			}
		} catch (error) {
			// Handle git errors (e.g., bad refs, invalid options)
			if (error instanceof Error) {
				// simple-git throws with stderr in the message
				return {
					stdout: "",
					stderr: error.message,
					exitCode: 1,
				};
			}
			return {
				stdout: "",
				stderr: String(error),
				exitCode: 1,
			};
		}
	}
}

/**
 * Singleton Git client instance
 */
export const gitClient = new GitClient();

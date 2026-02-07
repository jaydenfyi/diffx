/**
 * Git utility functions
 */

import crypto from "node:crypto";

/**
 * Build a GitHub HTTPS URL from owner/repo
 */
export function buildGitHubUrl(owner: string, repo: string): string {
	return `https://github.com/${owner}/${repo}.git`;
}

/**
 * Parse owner/repo from a GitHub URL
 */
export function parseOwnerRepoFromUrl(url: string): { owner: string; repo: string } | null {
	// Match https://github.com/OWNER/REPO.git or https://github.com/OWNER/REPO
	const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?$/);
	if (!match) return null;
	return { owner: match[1], repo: match[2] };
}

/**
 * Create a remote name from owner/repo
 */
export function createRemoteName(owner: string, repo: string): string {
	// Create a unique remote name like "diffx-octocat-Hello-World"
	return `diffx-${owner}-${repo}`.replace(/[/_]/g, "-").toLowerCase();
}

/**
 * Check if a ref is a commit hash (40 hex chars or abbreviated)
 */
export function isCommitHash(ref: string): boolean {
	return /^[a-f0-9]{4,40}$/i.test(ref);
}

/**
 * Normalize a ref for use with git commands
 */
export function normalizeRef(ref: string): string {
	// Remove refs/heads/ or refs/tags/ prefix if present
	return ref.replace(/^refs\/(heads|tags)\//, "");
}

/**
 * Get PR ref name from PR number
 */
export function getPRRefName(prNumber: number): string {
	return `refs/pull/${prNumber}/head`;
}

/**
 * Create a temporary ref prefix for one-off fetches
 */
export function createTempRefPrefix(): string {
	const token = crypto.randomBytes(8).toString("hex");
	return `refs/diffx/tmp/${Date.now().toString(36)}-${token}`;
}

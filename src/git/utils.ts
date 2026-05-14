import crypto from "node:crypto";

export function buildGitHubUrl(owner: string, repo: string): string {
	return `https://github.com/${owner}/${repo}.git`;
}

export function normalizeRef(ref: string): string {
	return ref.replace(/^refs\/(heads|tags)\//, "");
}

export function createTempRefPrefix(): string {
	const token = crypto.randomBytes(8).toString("hex");
	return `refs/diffx/tmp/${Date.now().toString(36)}-${token}`;
}

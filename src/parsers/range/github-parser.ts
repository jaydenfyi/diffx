import type {
	GitHubCommitUrl,
	GitHubCompareUrl,
	GitHubPRChangesUrl,
	GitHubPRUrl,
} from "../../types";

export function parseGitHubPRUrl(input: string): GitHubPRUrl | null {
	const match = input.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(\/.*)?$/i);
	if (!match) return null;

	return {
		owner: match[1],
		repo: match[2],
		prNumber: parseInt(match[3], 10),
	};
}

export function parseGitHubCommitUrl(input: string): GitHubCommitUrl | null {
	const match = input.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]+)$/i);
	if (!match) return null;

	return {
		owner: match[1],
		repo: match[2],
		commitSha: match[3],
	};
}

export function parseGitHubPRChangesUrl(input: string): GitHubPRChangesUrl | null {
	const match = input.match(
		/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/changes\/([a-f0-9]+)\.\.([a-f0-9]+)$/i,
	);
	if (!match) return null;

	return {
		owner: match[1],
		repo: match[2],
		prNumber: parseInt(match[3], 10),
		leftCommitSha: match[4],
		rightCommitSha: match[5],
	};
}

export function parseGitHubCompareUrl(input: string): GitHubCompareUrl | null {
	const match = input.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/compare\/(.+)\.\.\.(.+)$/i);
	if (!match) return null;

	const owner = match[1];
	const repo = match[2];
	const leftRef = match[3];
	const rightRef = match[4];

	const crossForkMatch = rightRef.match(/^([^:]+):([^:]+):(.+)$/);
	if (crossForkMatch) {
		return {
			owner,
			repo,
			leftRef,
			rightRef: crossForkMatch[3],
			rightOwner: crossForkMatch[1],
			rightRepo: crossForkMatch[2],
		};
	}

	const crossForkSlashMatch = rightRef.match(/^([^:]+):([^/]+)\/(.+)$/);
	if (crossForkSlashMatch) {
		return {
			owner,
			repo,
			leftRef,
			rightRef: crossForkSlashMatch[3],
			rightOwner: crossForkSlashMatch[1],
			rightRepo: crossForkSlashMatch[2],
		};
	}

	return {
		owner,
		repo,
		leftRef,
		rightRef,
	};
}

export function parsePRRef(input: string): GitHubPRUrl | null {
	const match = /^github:([^/]+)\/([^/]+)#(\d+)$/i;
	const result = input.match(match);
	if (!result) return null;

	return {
		owner: result[1],
		repo: result[2],
		prNumber: parseInt(result[3], 10),
	};
}

export function parseGithubRefRange(
	input: string,
): { ownerRepo: string; left: string; right: string } | null {
	const match = /^github:([^/]+)\/([^@]+)@(.+)\.\.(.+)$/i;
	const result = input.match(match);
	if (!result) return null;

	const owner = result[1];
	const repo = result[2];
	const left = result[3].trim();
	const right = result[4].trim();

	if (!owner || !repo || !left || !right) {
		return null;
	}

	return {
		ownerRepo: `${owner}/${repo}`,
		left,
		right,
	};
}

export function parsePRRange(input: string): { left: GitHubPRUrl; right: GitHubPRUrl } | null {
	if (!input.includes("..")) return null;
	const parts = input.split("..");
	if (parts.length !== 2) return null;
	const left = parseGitHubPRUrl(parts[0].trim()) ?? parsePRRef(parts[0].trim());
	const right = parseGitHubPRUrl(parts[1].trim()) ?? parsePRRef(parts[1].trim());
	if (!left || !right) return null;
	return { left, right };
}

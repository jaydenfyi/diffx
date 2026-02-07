import type { GitLabMRUrl } from "../../types";

export function parseMRRef(input: string): GitLabMRUrl | null {
	const match = /^gitlab:([^/]+)\/([^/]+)!(\d+)$/i;
	const result = input.match(match);
	if (!result) return null;

	return {
		owner: result[1],
		repo: result[2],
		mrNumber: parseInt(result[3], 10),
	};
}

export function parseGitlabRefRange(
	input: string,
): { ownerRepo: string; left: string; right: string } | null {
	const match = /^gitlab:([^/]+)\/([^@]+)@(.+)\.\.(.+)$/i;
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

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
): { ownerRepo: string; left: string; right: string; rangeSyntax: "two-dot" | "three-dot" } | null {
	const match = /^gitlab:([^/]+)\/([^@]+)@(.+)(\.\.\.?)(.+)$/i;
	const result = input.match(match);
	if (!result) return null;

	const owner = result[1];
	const repo = result[2];
	const left = result[3].trim();
	const separator = result[4];
	const right = result[5].trim();
	const rangeSyntax = separator.length === 3 ? ("three-dot" as const) : ("two-dot" as const);

	if (!owner || !repo || !left || !right) {
		return null;
	}

	return {
		ownerRepo: `${owner}/${repo}`,
		left,
		right,
		rangeSyntax,
	};
}

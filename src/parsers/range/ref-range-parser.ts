export function parseRemoteRefRange(input: string): {
	left: string;
	right: string;
	ownerRepo: string;
	rangeSyntax: "two-dot" | "three-dot";
} | null {
	const separatorMatch = input.match(/\.\.\.|\.\./);
	if (!separatorMatch || separatorMatch.index === undefined) {
		return null;
	}

	const separatorIndex = separatorMatch.index;
	const rangeSyntax =
		separatorMatch[0].length === 3 ? ("three-dot" as const) : ("two-dot" as const);

	const leftPart = input.slice(0, separatorIndex).trim();
	const rightPart = input.slice(separatorIndex + separatorMatch[0].length).trim();

	if (!leftPart || !rightPart) {
		return null;
	}

	const parseRemoteSide = (value: string): { owner: string; repo: string; ref: string } | null => {
		const match = value.match(/^([^/]+)\/([^@]+)@(.+)$/);
		if (!match) {
			return null;
		}

		const owner = match[1].trim();
		const repo = match[2].trim();
		const ref = match[3].trim();
		if (!owner || !repo || !ref) {
			return null;
		}

		return { owner, repo, ref };
	};

	const left = parseRemoteSide(leftPart);
	if (!left) {
		return null;
	}

	const rightFull = parseRemoteSide(rightPart);
	if (rightFull) {
		if (rightFull.owner !== left.owner || rightFull.repo !== left.repo) {
			return null;
		}

		return {
			left: `${left.owner}/${left.repo}@${left.ref}`,
			right: `${rightFull.owner}/${rightFull.repo}@${rightFull.ref}`,
			ownerRepo: `${left.owner}/${left.repo}`,
			rangeSyntax,
		};
	}

	return {
		left: `${left.owner}/${left.repo}@${left.ref}`,
		right: `${left.owner}/${left.repo}@${rightPart}`,
		ownerRepo: `${left.owner}/${left.repo}`,
		rangeSyntax,
	};
}

export function parseLocalRefRange(
	input: string,
): { left: string; right: string; rangeSyntax: "two-dot" | "three-dot" } | null {
	const separatorMatch = input.match(/\.\.(?:\.?)/);
	if (!separatorMatch || separatorMatch.index === undefined) {
		return null;
	}

	const separatorIndex = separatorMatch.index;
	const rangeSyntax =
		separatorMatch[0].length === 3 ? ("three-dot" as const) : ("two-dot" as const);
	const left = input.slice(0, separatorIndex).trim();
	const right = input.slice(separatorIndex + separatorMatch[0].length).trim();

	if (!left || !right) {
		return null;
	}

	return { left, right, rangeSyntax };
}

export function parseRemoteRefRange(input: string): {
	left: string;
	right: string;
	ownerRepo: string;
} | null {
	const separatorIndex = input.indexOf("..");
	if (separatorIndex === -1) {
		return null;
	}

	const leftPart = input.slice(0, separatorIndex).trim();
	const rightPart = input.slice(separatorIndex + 2).trim();

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
		};
	}

	return {
		left: `${left.owner}/${left.repo}@${left.ref}`,
		right: `${left.owner}/${left.repo}@${rightPart}`,
		ownerRepo: `${left.owner}/${left.repo}`,
	};
}

export function parseLocalRefRange(input: string): { left: string; right: string } | null {
	const parts = input.split("..");
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return null;
	}
	return {
		left: parts[0].trim(),
		right: parts[1].trim(),
	};
}

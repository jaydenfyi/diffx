export function parseGitUrlRange(input: string): {
	leftUrl: string;
	leftRef: string;
	rightUrl: string;
	rightRef: string;
	rangeSyntax: "two-dot" | "three-dot";
} | null {
	const isGitUrl = (s: string) => s.includes("://") || (s.includes("@") && s.includes(":"));

	const separatorMatch = input.match(/\.\.\.|\.\./);
	if (separatorMatch && separatorMatch.index !== undefined) {
		const sepIdx = separatorMatch.index;
		const sepLen = separatorMatch[0].length;
		const rangeSyntax = sepLen === 3 ? ("three-dot" as const) : ("two-dot" as const);
		const leftPart = input.slice(0, sepIdx);
		const rightPart = input.slice(sepIdx + sepLen);

		const lastAtLeft = leftPart.lastIndexOf("@");
		const lastAtRight = rightPart.lastIndexOf("@");

		if (lastAtLeft !== -1 && lastAtRight !== -1) {
			const leftUrl = leftPart.slice(0, lastAtLeft);
			const leftRef = leftPart.slice(lastAtLeft + 1);
			const rightUrl = rightPart.slice(0, lastAtRight);
			const rightRef = rightPart.slice(lastAtRight + 1);

			if (isGitUrl(leftUrl) && isGitUrl(rightUrl)) {
				return { leftUrl, leftRef, rightUrl, rightRef, rangeSyntax };
			}
		}
	}

	if (separatorMatch && separatorMatch.index !== undefined) {
		const sepIdx = separatorMatch.index;
		const atBeforeSep = input.lastIndexOf("@", sepIdx);
		if (atBeforeSep !== -1) {
			const url = input.slice(0, atBeforeSep);
			const refPart = input.slice(atBeforeSep + 1);
			const rangeSyntax =
				separatorMatch[0].length === 3 ? ("three-dot" as const) : ("two-dot" as const);

			if (rangeSyntax === "three-dot") {
				const dotIdx = refPart.indexOf("...");
				if (dotIdx !== -1) {
					const leftRef = refPart.slice(0, dotIdx);
					const rightRef = refPart.slice(dotIdx + 3);
					if (leftRef && rightRef && isGitUrl(url)) {
						return { leftUrl: url, leftRef, rightUrl: url, rightRef, rangeSyntax };
					}
				}
			} else {
				const parts = refPart.split("..");
				if (parts.length === 2 && parts[0] && parts[1] && isGitUrl(url)) {
					return {
						leftUrl: url,
						leftRef: parts[0],
						rightUrl: url,
						rightRef: parts[1],
						rangeSyntax,
					};
				}
			}
		}
	}

	return null;
}

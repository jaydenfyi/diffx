export function parseGitUrlRange(input: string): {
	leftUrl: string;
	leftRef: string;
	rightUrl: string;
	rightRef: string;
} | null {
	const isGitUrl = (s: string) => s.includes("://") || (s.includes("@") && s.includes(":"));

	const doubleDotIndex = input.indexOf("..");
	if (doubleDotIndex !== -1) {
		const leftPart = input.slice(0, doubleDotIndex);
		const rightPart = input.slice(doubleDotIndex + 2);

		const lastAtLeft = leftPart.lastIndexOf("@");
		const lastAtRight = rightPart.lastIndexOf("@");

		if (lastAtLeft !== -1 && lastAtRight !== -1) {
			const leftUrl = leftPart.slice(0, lastAtLeft);
			const leftRef = leftPart.slice(lastAtLeft + 1);
			const rightUrl = rightPart.slice(0, lastAtRight);
			const rightRef = rightPart.slice(lastAtRight + 1);

			if (isGitUrl(leftUrl) && isGitUrl(rightUrl)) {
				return { leftUrl, leftRef, rightUrl, rightRef };
			}
		}
	}

	const atBeforeDoubleDot = input.lastIndexOf("@", input.indexOf(".."));
	if (atBeforeDoubleDot !== -1 && input.includes("..")) {
		const url = input.slice(0, atBeforeDoubleDot);
		const refPart = input.slice(atBeforeDoubleDot + 1);
		const parts = refPart.split("..");
		if (parts.length === 2 && isGitUrl(url)) {
			return {
				leftUrl: url,
				leftRef: parts[0],
				rightUrl: url,
				rightRef: parts[1],
			};
		}
	}

	return null;
}

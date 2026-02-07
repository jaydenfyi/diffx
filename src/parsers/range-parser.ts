/**
 * Range input parser for diffx
 * Parses various input formats into a RefRange
 */

import type { RefRange } from "../types";
import { DiffxError, ExitCode } from "../types";
import {
	parseGithubRefRange,
	parseGitHubCommitUrl,
	parseGitHubCompareUrl,
	parseGitHubPRChangesUrl,
	parseGitHubPRUrl,
	parsePRRange,
	parsePRRef,
} from "./range/github-parser";
import { parseGitUrlRange } from "./range/git-url-parser";
import { parseGitlabRefRange, parseMRRef } from "./range/gitlab-parser";
import { parseLocalRefRange, parseRemoteRefRange } from "./range/ref-range-parser";

/**
 * Parse a range input string into a RefRange
 */
export function parseRangeInput(input: string): RefRange {
	const prRange = parsePRRange(input);
	if (prRange) {
		return {
			type: "pr-range",
			left: "",
			right: "",
			leftPr: prRange.left,
			rightPr: prRange.right,
		};
	}

	const gitUrlRange = parseGitUrlRange(input);
	if (gitUrlRange) {
		return {
			type: "git-url-range",
			left: gitUrlRange.leftRef,
			right: gitUrlRange.rightRef,
			leftGitUrl: gitUrlRange.leftUrl,
			rightGitUrl: gitUrlRange.rightUrl,
		};
	}

	const githubCompare = parseGitHubCompareUrl(input);
	if (githubCompare) {
		return {
			type: "github-compare-url",
			left: "",
			right: "",
			ownerRepo: `${githubCompare.owner}/${githubCompare.repo}`,
			leftRef: githubCompare.leftRef,
			rightRef: githubCompare.rightRef,
			rightOwner: githubCompare.rightOwner,
			rightRepo: githubCompare.rightRepo,
		};
	}

	const githubPrChanges = parseGitHubPRChangesUrl(input);
	if (githubPrChanges) {
		return {
			type: "github-pr-changes-url",
			left: "",
			right: "",
			ownerRepo: `${githubPrChanges.owner}/${githubPrChanges.repo}`,
			prNumber: githubPrChanges.prNumber,
			leftCommitSha: githubPrChanges.leftCommitSha,
			rightCommitSha: githubPrChanges.rightCommitSha,
		};
	}

	const githubPr = parseGitHubPRUrl(input);
	if (githubPr) {
		return {
			type: "github-url",
			left: "", // Will be resolved later
			right: "",
			ownerRepo: `${githubPr.owner}/${githubPr.repo}`,
			prNumber: githubPr.prNumber,
		};
	}

	const githubCommit = parseGitHubCommitUrl(input);
	if (githubCommit) {
		return {
			type: "github-commit-url",
			left: "",
			right: "",
			ownerRepo: `${githubCommit.owner}/${githubCommit.repo}`,
			commitSha: githubCommit.commitSha,
		};
	}

	const githubRefRange = parseGithubRefRange(input);
	if (githubRefRange) {
		const gitUrl = `git@github.com:${githubRefRange.ownerRepo}.git`;
		return {
			type: "git-url-range",
			left: githubRefRange.left,
			right: githubRefRange.right,
			leftGitUrl: gitUrl,
			rightGitUrl: gitUrl,
		};
	}

	const gitlabRefRange = parseGitlabRefRange(input);
	if (gitlabRefRange) {
		const gitUrl = `git@gitlab.com:${gitlabRefRange.ownerRepo}.git`;
		return {
			type: "git-url-range",
			left: gitlabRefRange.left,
			right: gitlabRefRange.right,
			leftGitUrl: gitUrl,
			rightGitUrl: gitUrl,
		};
	}

	const prRef = parsePRRef(input);
	if (prRef) {
		return {
			type: "pr-ref",
			left: "",
			right: "",
			ownerRepo: `${prRef.owner}/${prRef.repo}`,
			prNumber: prRef.prNumber,
		};
	}

	const mrRef = parseMRRef(input);
	if (mrRef) {
		return {
			type: "gitlab-mr-ref",
			left: "",
			right: "",
			ownerRepo: `${mrRef.owner}/${mrRef.repo}`,
			prNumber: mrRef.mrNumber,
		};
	}

	const remoteRange = parseRemoteRefRange(input);
	if (remoteRange) {
		return {
			type: "remote-range",
			left: remoteRange.left,
			right: remoteRange.right,
			ownerRepo: remoteRange.ownerRepo,
		};
	}

	const localRange = parseLocalRefRange(input);
	if (localRange) {
		return {
			type: "local-range",
			left: localRange.left,
			right: localRange.right,
		};
	}

	throw new DiffxError(
		`Invalid range or URL: ${input}\n\nSupported formats:\n  - Local refs: main..feature, abc123..def456\n  - Remote refs: owner/repo@main..owner/repo@feature\n  - Git URL: git@github.com:owner/repo.git@main..feature\n  - Git URL (HTTPS): https://github.com/owner/repo.git@main..feature\n  - GitHub refs: github:owner/repo@main..feature\n  - GitHub PR ref: github:owner/repo#123\n  - GitHub PR range: github:owner/repo#123..github:owner/repo#456\n  - GitHub PR URL: https://github.com/owner/repo/pull/123\n  - PR URL range: https://github.com/owner/repo/pull/123..https://github.com/owner/repo/pull/456\n  - GitHub commit URL: https://github.com/owner/repo/commit/abc123\n  - GitHub PR changes URL: https://github.com/owner/repo/pull/123/changes/abc123..def456\n  - GitHub compare URL: https://github.com/owner/repo/compare/main...feature\n  - Cross-fork compare: https://github.com/owner/repo/compare/main...other:repo:feature\n  - GitLab refs: gitlab:owner/repo@main..feature\n  - GitLab MR ref: gitlab:owner/repo!123`,
		ExitCode.INVALID_INPUT,
	);
}

/**
 * Tests for GitHub PR URL resolver
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import {
	resolvePRRefs,
	resolvePRRangeRefs,
	resolveGitHubCommitRefs,
	resolveGitHubPRChangesRefs,
	resolveGitHubCompareRefs,
} from "./pr-url-resolver";
import { gitClient } from "../git/git-client";
import type { RefRange } from "../types";
import { DiffxError, ExitCode } from "../types";

// Mock dependencies
vi.mock("../git/git-client", () => ({
	gitClient: {
		fetchFromUrl: vi.fn(),
		deleteRefs: vi.fn(),
		mergeBase: vi.fn(),
	},
}));

vi.mock("../git/utils", () => ({
	buildGitHubUrl: (owner: string, repo: string) => `https://github.com/${owner}/${repo}.git`,
	createTempRefPrefix: () => "refs/diffx/tmp/pr-test",
}));

const mockFetchFromUrl = mockedFn(gitClient.fetchFromUrl);
const mockDeleteRefs = mockedFn(gitClient.deleteRefs);
const mockMergeBase = mockedFn(gitClient.mergeBase);

describe("resolvePRRefs", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockDeleteRefs.mockResolvedValue(undefined);
	});

	describe("happy path", () => {
		it("should resolve PR refs using merge ref logic", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			};

			const result = await resolvePRRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledWith(
				"https://github.com/owner/repo.git",
				[
					"refs/pull/123/head:refs/diffx/tmp/pr-test/pull/123/head",
					"refs/pull/123/merge:refs/diffx/tmp/pr-test/pull/123/merge",
				],
				2,
			);

			expect(result).toEqual({
				left: "refs/diffx/tmp/pr-test/pull/123/merge^1", // First parent of merge
				right: "refs/diffx/tmp/pr-test/pull/123/merge",
				cleanup: expect.any(Function),
			});
		});

		it("should handle PR from different owner", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "octocat/Hello-World",
				prNumber: 456,
			};

			const result = await resolvePRRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledWith(
				"https://github.com/octocat/Hello-World.git",
				[
					"refs/pull/456/head:refs/diffx/tmp/pr-test/pull/456/head",
					"refs/pull/456/merge:refs/diffx/tmp/pr-test/pull/456/merge",
				],
				2,
			);

			expect(result.right).toContain("merge");
		});

		it("should call cleanup to delete temp refs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			};

			const result = await resolvePRRefs(range);
			await result.cleanup!();

			expect(mockDeleteRefs).toHaveBeenCalledWith([
				"refs/diffx/tmp/pr-test/pull/123/head",
				"refs/diffx/tmp/pr-test/pull/123/merge",
			]);
		});
	});

	describe("error cases", () => {
		it("should throw when ownerRepo is missing", async () => {
			const range: RefRange = {
				type: "pr-ref",
				left: "",
				right: "",
				prNumber: 123,
			};

			await expect(resolvePRRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolvePRRefs(range)).rejects.toThrow("Invalid PR ref");
		});

		it("should throw when prNumber is missing", async () => {
			const range: RefRange = {
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
			};

			await expect(resolvePRRefs(range)).rejects.toThrow(DiffxError);
		});

		it("should throw for invalid owner/repo format", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "invalid",
				prNumber: 123,
			};

			await expect(resolvePRRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolvePRRefs(range)).rejects.toThrow("Invalid owner/repo: invalid");
		});

		it("should wrap fetch errors", async () => {
			mockFetchFromUrl.mockRejectedValue(new Error("PR not found"));

			const range: RefRange = {
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 99999,
			};

			try {
				await resolvePRRefs(range);
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).message).toContain("Failed to fetch PR refs");
				expect((error as DiffxError).exitCode).toBe(ExitCode.GIT_ERROR);
			}
		});
	});
});

describe("resolvePRRangeRefs", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockDeleteRefs.mockResolvedValue(undefined);
	});

	describe("happy path", () => {
		it("should resolve two PR refs for comparison", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "pr-range",
				left: "",
				right: "",
				leftPr: { owner: "owner", repo: "repo", prNumber: 123 },
				rightPr: { owner: "owner", repo: "repo", prNumber: 456 },
			};

			const result = await resolvePRRangeRefs(range);

			// Should fetch both PRs
			expect(mockFetchFromUrl).toHaveBeenCalledTimes(2);

			// Cleanup should include all temp refs
			await result.cleanup!();
			expect(mockDeleteRefs).toHaveBeenCalled();
			const cleanupRefs = mockDeleteRefs.mock.calls[0][0] as string[];
			expect(cleanupRefs).toHaveLength(4); // 2 refs per PR
		});

		it("should fetch PR heads (not merge refs)", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "pr-range",
				left: "",
				right: "",
				leftPr: { owner: "owner", repo: "repo", prNumber: 1 },
				rightPr: { owner: "owner", repo: "repo", prNumber: 2 },
			};

			const result = await resolvePRRangeRefs(range);

			// Should compare head refs, not merge refs
			expect(result.left).toContain("/head");
			expect(result.right).toContain("/head");
		});
	});

	describe("error cases", () => {
		it("should throw when leftPr is missing", async () => {
			const range: RefRange = {
				type: "pr-range",
				left: "",
				right: "",
				rightPr: { owner: "owner", repo: "repo", prNumber: 123 },
			};

			await expect(resolvePRRangeRefs(range)).rejects.toThrow("Invalid PR range");
		});

		it("should throw when rightPr is missing", async () => {
			const range: RefRange = {
				type: "pr-range",
				left: "",
				right: "",
				leftPr: { owner: "owner", repo: "repo", prNumber: 123 },
			};

			await expect(resolvePRRangeRefs(range)).rejects.toThrow("Invalid PR range");
		});

		it("should wrap fetch errors", async () => {
			mockFetchFromUrl.mockRejectedValue(new Error("Network error"));

			const range: RefRange = {
				type: "pr-range",
				left: "",
				right: "",
				leftPr: { owner: "owner", repo: "repo", prNumber: 1 },
				rightPr: { owner: "owner", repo: "repo", prNumber: 2 },
			};

			try {
				await resolvePRRangeRefs(range);
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).message).toContain("Failed to fetch PR range refs");
			}
		});
	});
});

describe("resolveGitHubCommitRefs", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockDeleteRefs.mockResolvedValue(undefined);
	});

	describe("happy path", () => {
		it("should resolve commit URL to show changes in that commit", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "github-commit-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				commitSha: "abc123",
			};

			const result = await resolveGitHubCommitRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledWith(
				"https://github.com/owner/repo.git",
				["abc123:refs/diffx/tmp/pr-test/commit/abc123"],
				2,
			);

			expect(result).toEqual({
				left: "refs/diffx/tmp/pr-test/commit/abc123^", // Parent of commit
				right: "refs/diffx/tmp/pr-test/commit/abc123",
				cleanup: expect.any(Function),
			});
		});

		it("should use depth=2 to include parent commit", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "github-commit-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				commitSha: "def456",
			};

			const _result = await resolveGitHubCommitRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledWith(expect.any(String), expect.any(Array), 2);
		});
	});

	describe("error cases", () => {
		it("should throw when ownerRepo is missing", async () => {
			const range: RefRange = {
				type: "github-commit-url",
				left: "",
				right: "",
				commitSha: "abc123",
			};

			await expect(resolveGitHubCommitRefs(range)).rejects.toThrow("Invalid GitHub commit URL");
		});

		it("should throw when commitSha is missing", async () => {
			const range: RefRange = {
				type: "github-commit-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
			};

			await expect(resolveGitHubCommitRefs(range)).rejects.toThrow("Invalid GitHub commit URL");
		});
	});
});

describe("resolveGitHubPRChangesRefs", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockDeleteRefs.mockResolvedValue(undefined);
	});

	describe("happy path", () => {
		it("should resolve PR changes URL between two commits", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "github-pr-changes-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
				leftCommitSha: "abc123",
				rightCommitSha: "def456",
			};

			const result = await resolveGitHubPRChangesRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledWith(
				"https://github.com/owner/repo.git",
				[
					"abc123:refs/diffx/tmp/pr-test/left-commit/abc123",
					"def456:refs/diffx/tmp/pr-test/right-commit/def456",
				],
				2,
			);

			expect(result).toEqual({
				left: "refs/diffx/tmp/pr-test/left-commit/abc123",
				right: "refs/diffx/tmp/pr-test/right-commit/def456",
				cleanup: expect.any(Function),
			});
		});

		it("should cleanup both commit refs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "github-pr-changes-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
				leftCommitSha: "abc123",
				rightCommitSha: "def456",
			};

			const result = await resolveGitHubPRChangesRefs(range);
			await result.cleanup!();

			expect(mockDeleteRefs).toHaveBeenCalledWith([
				"refs/diffx/tmp/pr-test/left-commit/abc123",
				"refs/diffx/tmp/pr-test/right-commit/def456",
			]);
		});
	});

	describe("error cases", () => {
		it("should throw when required fields are missing", async () => {
			const range: RefRange = {
				type: "github-pr-changes-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
				leftCommitSha: "abc123",
			};

			await expect(resolveGitHubPRChangesRefs(range)).rejects.toThrow(
				"Invalid GitHub PR changes URL",
			);
		});
	});
});

describe("resolveGitHubCompareRefs", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockDeleteRefs.mockResolvedValue(undefined);
	});

	describe("same-repo compare", () => {
		it("should resolve same-repo branch refs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);
			mockMergeBase.mockResolvedValue("merge-base-sha\n");

			const range: RefRange = {
				type: "github-compare-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				leftRef: "main",
				rightRef: "feature",
			};

			const result = await resolveGitHubCompareRefs(range);

			// Should fetch both refs and find merge base
			expect(mockFetchFromUrl).toHaveBeenCalled();
			expect(mockMergeBase).toHaveBeenCalled();

			expect(result.left).toBe("merge-base-sha");
			expect(result.right).toContain("right");
		});

		it("should handle tag refs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);
			mockMergeBase.mockResolvedValue("abc123");

			const range: RefRange = {
				type: "github-compare-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				leftRef: "v1.0",
				rightRef: "v2.0",
			};

			const result = await resolveGitHubCompareRefs(range);

			expect(result.left).toBe("abc123");
		});
	});

	describe("cross-fork compare", () => {
		it("should resolve cross-fork compare with different owner/repo", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);
			mockMergeBase.mockResolvedValue("merge-base\n");

			const range: RefRange = {
				type: "github-compare-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				leftRef: "main",
				rightRef: "feature",
				rightOwner: "other",
				rightRepo: "fork",
			};

			const _result = await resolveGitHubCompareRefs(range);

			// Should fetch from both repos
			const fetchCalls = mockFetchFromUrl.mock.calls;
			const urls = fetchCalls.map((call: [string, string[], number]) => call[0]);

			expect(urls).toContain("https://github.com/owner/repo.git");
			expect(urls).toContain("https://github.com/other/fork.git");
		});
	});

	describe("commit SHA handling", () => {
		it("should fetch commit SHAs directly", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);
			mockMergeBase.mockResolvedValue("base");

			const range: RefRange = {
				type: "github-compare-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				leftRef: "abc1234",
				rightRef: "def5678",
			};

			const _result = await resolveGitHubCompareRefs(range);

			// Should fetch SHAs directly, not as refs/heads or refs/tags
			expect(mockFetchFromUrl).toHaveBeenCalled();
		});
	});

	describe("merge-base fallback", () => {
		it("should deep fetch when merge-base not found initially", async () => {
			let callCount = 0;
			mockMergeBase.mockImplementation(async () => {
				callCount++;
				if (callCount === 1) {
					throw new Error("Not found");
				}
				return "merge-base";
			});
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "github-compare-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				leftRef: "main",
				rightRef: "feature",
			};

			const result = await resolveGitHubCompareRefs(range);

			// Should try merge-base, then deep fetch, then try again
			expect(mockMergeBase).toHaveBeenCalledTimes(2);

			// Should deep fetch with depth=200
			const deepFetchCalls = mockFetchFromUrl.mock.calls.filter(
				(call: [string, string[], number]) => call[2] === 200,
			);
			expect(deepFetchCalls.length).toBeGreaterThan(0);

			expect(result.left).toBe("merge-base");
		});

		it("should throw when merge-base cannot be determined", async () => {
			mockMergeBase.mockRejectedValue(new Error("Not found"));
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "github-compare-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				leftRef: "main",
				rightRef: "feature",
			};

			try {
				await resolveGitHubCompareRefs(range);
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).message).toContain("Failed to determine merge base");
			}
		});
	});

	describe("cleanup", () => {
		it("should cleanup temp refs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);
			mockMergeBase.mockResolvedValue("base");

			const range: RefRange = {
				type: "github-compare-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				leftRef: "main",
				rightRef: "feature",
			};

			const result = await resolveGitHubCompareRefs(range);
			await result.cleanup!();

			expect(mockDeleteRefs).toHaveBeenCalled();
			const cleanupRefs = mockDeleteRefs.mock.calls[0][0] as string[];
			expect(cleanupRefs.length).toBe(2);
		});
	});
});

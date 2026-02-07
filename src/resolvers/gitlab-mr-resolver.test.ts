/**
 * GitLab MR resolver tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { resolveGitLabMRRefs } from "./gitlab-mr-resolver";
import { gitClient } from "../git/git-client";

vi.mock("../git/git-client", () => ({
	gitClient: {
		fetchFromUrl: vi.fn(),
		deleteRefs: vi.fn(),
	},
}));

describe("GitLab MR resolver", () => {
	const mockFetchFromUrl = mockedFn(gitClient.fetchFromUrl);
	const mockDeleteRefs = mockedFn(gitClient.deleteRefs);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("resolveGitLabMRRefs", () => {
		it("should resolve GitLab MR refs", async () => {
			const range = {
				type: "gitlab-mr-ref" as const,
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			};

			mockFetchFromUrl.mockResolvedValue(undefined);

			const result = await resolveGitLabMRRefs(range);

			expect(result.left).toMatch(/^refs\/diffx\/tmp\/.+\/merge-requests\/123\/merge\^1$/);
			expect(result.right).toMatch(/^refs\/diffx\/tmp\/.+\/merge-requests\/123\/merge$/);
			expect(result.cleanup).toBeDefined();

			const call = mockFetchFromUrl.mock.calls[0];
			expect(call?.[0]).toBe("git@gitlab.com:owner/repo.git");
			expect(call?.[2]).toBe(2);
			expect(call?.[1]).toHaveLength(2);
			expect(call?.[1]?.[0]).toMatch(
				/^refs\/merge-requests\/123\/head:refs\/diffx\/tmp\/.+\/merge-requests\/123\/head$/,
			);
			expect(call?.[1]?.[1]).toMatch(
				/^refs\/merge-requests\/123\/merge:refs\/diffx\/tmp\/.+\/merge-requests\/123\/merge$/,
			);
		});

		it("should cleanup refs on cleanup call", async () => {
			const range = {
				type: "gitlab-mr-ref" as const,
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			};

			mockFetchFromUrl.mockResolvedValue(undefined);
			mockDeleteRefs.mockResolvedValue(undefined);

			const result = await resolveGitLabMRRefs(range);

			expect(result.cleanup).toBeDefined();

			await result.cleanup!();

			const deleteCall = mockDeleteRefs.mock.calls[0];
			expect(deleteCall?.[0]).toHaveLength(2);
			expect(deleteCall?.[0]?.[0]).toMatch(/^refs\/diffx\/tmp\/.+\/merge-requests\/123\/head$/);
			expect(deleteCall?.[0]?.[1]).toMatch(/^refs\/diffx\/tmp\/.+\/merge-requests\/123\/merge$/);
		});

		it("should throw error for invalid owner/repo", async () => {
			const range = {
				type: "gitlab-mr-ref" as const,
				left: "",
				right: "",
				ownerRepo: "invalid",
				prNumber: 123,
			};

			await expect(resolveGitLabMRRefs(range)).rejects.toThrow("Invalid owner/repo: invalid");
		});

		it("should throw error for missing MR number", async () => {
			const range = {
				type: "gitlab-mr-ref" as const,
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: undefined,
			};

			await expect(resolveGitLabMRRefs(range)).rejects.toThrow("Invalid GitLab MR ref");
		});

		it("should throw error when fetch fails", async () => {
			const range = {
				type: "gitlab-mr-ref" as const,
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			};

			mockFetchFromUrl.mockRejectedValue(new Error("Network error"));

			await expect(resolveGitLabMRRefs(range)).rejects.toThrow("Failed to fetch GitLab MR refs");
		});
	});
});

/**
 * Tests for auto base resolver
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { resolveAutoBaseRefs } from "./auto-base-resolver";
import { gitClient } from "../git/git-client";
import { DiffxError, ExitCode } from "../types";

// Mock dependencies
vi.mock("../git/git-client", () => ({
	gitClient: {
		getDefaultBranchRef: vi.fn(),
		mergeBase: vi.fn(),
	},
}));

describe("resolveAutoBaseRefs", () => {
	const mockGetDefaultBranchRef = mockedFn(gitClient.getDefaultBranchRef);
	const mockMergeBase = mockedFn(gitClient.mergeBase);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("happy path", () => {
		it("should resolve merge-base with default branch", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/main");
			mockMergeBase.mockResolvedValue("abc123\n");

			const result = await resolveAutoBaseRefs();

			expect(result).toEqual({
				left: "abc123",
				right: "HEAD",
				baseRef: "origin/main",
				mergeBase: "abc123",
			});

			expect(mockGetDefaultBranchRef).toHaveBeenCalled();
			expect(mockMergeBase).toHaveBeenCalledWith("origin/main", "HEAD");
		});

		it("should trim whitespace from merge base", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/main");
			mockMergeBase.mockResolvedValue("  abc123  \n");

			const result = await resolveAutoBaseRefs();

			expect(result.mergeBase).toBe("abc123");
		});

		it("should work with different default branches", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/master");
			mockMergeBase.mockResolvedValue("def456");

			const result = await resolveAutoBaseRefs();

			expect(result.baseRef).toBe("origin/master");
			expect(result.mergeBase).toBe("def456");
		});
	});

	describe("error cases", () => {
		it("should throw when default branch cannot be determined", async () => {
			mockGetDefaultBranchRef.mockResolvedValue(null);

			await expect(resolveAutoBaseRefs()).rejects.toThrow(DiffxError);
			await expect(resolveAutoBaseRefs()).rejects.toThrow(
				"Could not determine a base branch automatically",
			);
		});

		it("should throw when merge-base fails", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/main");
			mockMergeBase.mockRejectedValue(new Error("Not a commit"));

			await expect(resolveAutoBaseRefs()).rejects.toThrow(DiffxError);
			await expect(resolveAutoBaseRefs()).rejects.toThrow(
				"Could not find a merge base with origin/main",
			);
		});

		it("should throw when merge-base returns empty string", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/main");
			mockMergeBase.mockResolvedValue("");

			await expect(resolveAutoBaseRefs()).rejects.toThrow(DiffxError);
			await expect(resolveAutoBaseRefs()).rejects.toThrow(
				"Could not find a merge base with origin/main",
			);
		});

		it("should throw when merge-base returns only whitespace", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/main");
			mockMergeBase.mockResolvedValue("   \n  ");

			await expect(resolveAutoBaseRefs()).rejects.toThrow(DiffxError);
		});

		it("should suggest explicit range in error message", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/main");
			mockMergeBase.mockRejectedValue(new Error("No common ancestor"));

			try {
				await resolveAutoBaseRefs();
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).message).toContain("origin/main..HEAD");
			}
		});
	});

	describe("exit codes", () => {
		it("should return INVALID_INPUT when default branch unavailable", async () => {
			mockGetDefaultBranchRef.mockResolvedValue(null);

			try {
				await resolveAutoBaseRefs();
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).exitCode).toBe(ExitCode.INVALID_INPUT);
			}
		});

		it("should return INVALID_INPUT when merge-base fails", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/main");
			mockMergeBase.mockRejectedValue(new Error("Merge failed"));

			try {
				await resolveAutoBaseRefs();
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).exitCode).toBe(ExitCode.INVALID_INPUT);
			}
		});
	});

	describe("edge cases", () => {
		it("should handle detached HEAD state", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/main");
			mockMergeBase.mockResolvedValue("abc123");

			const result = await resolveAutoBaseRefs();

			expect(result.right).toBe("HEAD");
		});

		it("should work with refs that have slashes", async () => {
			mockGetDefaultBranchRef.mockResolvedValue("origin/develop/main");
			mockMergeBase.mockResolvedValue("def456");

			const result = await resolveAutoBaseRefs();

			expect(result.baseRef).toBe("origin/develop/main");
			expect(result.mergeBase).toBe("def456");
		});
	});
});

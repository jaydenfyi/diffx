/**
 * Tests for git URL resolver
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { resolveGitUrlRefs } from "./git-url-resolver";
import { gitClient } from "../git/git-client";
import type { RefRange } from "../types";
import { DiffxError, ExitCode } from "../types";

// Mock dependencies
vi.mock("../git/git-client", () => ({
	gitClient: {
		fetchFromUrl: vi.fn(),
		deleteRefs: vi.fn(),
	},
}));

vi.mock("../git/utils", () => ({
	createTempRefPrefix: () => "refs/diffx/tmp/git-url-test",
}));

describe("resolveGitUrlRefs", () => {
	const mockFetchFromUrl = mockedFn(gitClient.fetchFromUrl);
	const mockDeleteRefs = mockedFn(gitClient.deleteRefs);

	beforeEach(() => {
		vi.clearAllMocks();

		mockDeleteRefs.mockResolvedValue(undefined);
	});

	describe("same URL for both refs (short form)", () => {
		it("should resolve git URL range with same URL", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "feature",
				leftGitUrl: "git@github.com:owner/repo.git",
				rightGitUrl: "git@github.com:owner/repo.git",
			};

			const result = await resolveGitUrlRefs(range);

			// Should fetch both refs in one call
			expect(mockFetchFromUrl).toHaveBeenCalledTimes(1);
			expect(mockFetchFromUrl).toHaveBeenCalledWith(
				"git@github.com:owner/repo.git",
				["main:refs/diffx/tmp/git-url-test/left", "feature:refs/diffx/tmp/git-url-test/right"],
				1,
			);

			expect(result).toEqual({
				left: "refs/diffx/tmp/git-url-test/left",
				right: "refs/diffx/tmp/git-url-test/right",
				cleanup: expect.any(Function),
			});
		});

		it("should handle HTTPS URLs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "git-url-range",
				left: "v1.0",
				right: "v2.0",
				leftGitUrl: "https://github.com/owner/repo.git",
				rightGitUrl: "https://github.com/owner/repo.git",
			};

			const result = await resolveGitUrlRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledWith(
				"https://github.com/owner/repo.git",
				["v1.0:refs/diffx/tmp/git-url-test/left", "v2.0:refs/diffx/tmp/git-url-test/right"],
				1,
			);

			expect(result.cleanup).toBeDefined();
		});
	});

	describe("different URLs for each ref (full form)", () => {
		it("should resolve git URL range with different URLs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "feature",
				leftGitUrl: "git@github.com:owner/repo.git",
				rightGitUrl: "git@gitlab.com:owner/repo.git",
			};

			const result = await resolveGitUrlRefs(range);

			// Should fetch each ref separately
			expect(mockFetchFromUrl).toHaveBeenCalledTimes(2);
			expect(mockFetchFromUrl).toHaveBeenNthCalledWith(
				1,
				"git@github.com:owner/repo.git",
				["main:refs/diffx/tmp/git-url-test/left"],
				1,
			);
			expect(mockFetchFromUrl).toHaveBeenNthCalledWith(
				2,
				"git@gitlab.com:owner/repo.git",
				["feature:refs/diffx/tmp/git-url-test/right"],
				1,
			);

			expect(result.left).toBe("refs/diffx/tmp/git-url-test/left");
			expect(result.right).toBe("refs/diffx/tmp/git-url-test/right");
		});

		it("should handle mixed SSH and HTTPS URLs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "develop",
				leftGitUrl: "https://github.com/owner/repo.git",
				rightGitUrl: "git@github.com:owner/repo.git",
			};

			const _result = await resolveGitUrlRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledTimes(2);
		});
	});

	describe("cleanup function", () => {
		it("should call cleanup to delete temp refs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "feature",
				leftGitUrl: "git@github.com:owner/repo.git",
				rightGitUrl: "git@github.com:owner/repo.git",
			};

			const result = await resolveGitUrlRefs(range);
			await result.cleanup!();

			expect(mockDeleteRefs).toHaveBeenCalledWith([
				"refs/diffx/tmp/git-url-test/left",
				"refs/diffx/tmp/git-url-test/right",
			]);
		});

		it("should cleanup refs from different URLs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "feature",
				leftGitUrl: "git@github.com:owner/repo.git",
				rightGitUrl: "git@gitlab.com:owner/repo.git",
			};

			const result = await resolveGitUrlRefs(range);
			await result.cleanup!();

			expect(mockDeleteRefs).toHaveBeenCalledWith([
				"refs/diffx/tmp/git-url-test/left",
				"refs/diffx/tmp/git-url-test/right",
			]);
		});
	});

	describe("error cases", () => {
		it("should throw for wrong range type", async () => {
			const range: RefRange = {
				type: "local-range",
				left: "main",
				right: "feature",
			};

			await expect(resolveGitUrlRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveGitUrlRefs(range)).rejects.toThrow(
				"Invalid ref type for git URL resolver",
			);
		});

		it("should throw when git URLs are missing", async () => {
			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "feature",
			};

			await expect(resolveGitUrlRefs(range)).rejects.toThrow(DiffxError);
		});

		it("should wrap fetch errors with GIT_ERROR", async () => {
			mockFetchFromUrl.mockRejectedValue(new Error("Repository not found"));

			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "feature",
				leftGitUrl: "git@github.com:owner/nonexistent.git",
				rightGitUrl: "git@github.com:owner/nonexistent.git",
			};

			try {
				await resolveGitUrlRefs(range);
				expect.unreachable();
			} catch (error) {
				expect(error).toBeInstanceOf(DiffxError);
				expect((error as DiffxError).exitCode).toBe(ExitCode.GIT_ERROR);
				expect((error as DiffxError).message).toContain("Failed to fetch refs from git URL");
				expect((error as DiffxError).message).toContain("Repository not found");
			}
		});

		it("should include cleanup refs in error handling", async () => {
			mockFetchFromUrl.mockRejectedValue(new Error("Network error"));

			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "feature",
				leftGitUrl: "git@github.com:owner/repo.git",
				rightGitUrl: "git@github.com:owner/repo.git",
			};

			await expect(resolveGitUrlRefs(range)).rejects.toThrow();
		});
	});

	describe("exit codes", () => {
		it("should return INVALID_INPUT for wrong type", async () => {
			const range: RefRange = {
				type: "local-range",
				left: "main",
				right: "feature",
			};

			try {
				await resolveGitUrlRefs(range);
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).exitCode).toBe(ExitCode.INVALID_INPUT);
			}
		});

		it("should return GIT_ERROR for fetch failures", async () => {
			mockFetchFromUrl.mockRejectedValue(new Error("Fetch failed"));

			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "feature",
				leftGitUrl: "git@github.com:owner/repo.git",
				rightGitUrl: "git@github.com:owner/repo.git",
			};

			try {
				await resolveGitUrlRefs(range);
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).exitCode).toBe(ExitCode.GIT_ERROR);
			}
		});
	});
});

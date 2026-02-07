/**
 * Tests for remote ref resolver
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { resolveRemoteRefs } from "./remote-ref-resolver";
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
	buildGitHubUrl: (owner: string, repo: string) => `https://github.com/${owner}/${repo}.git`,
	createTempRefPrefix: () => "refs/diffx/tmp/test-prefix",
}));

describe("resolveRemoteRefs", () => {
	const mockFetchFromUrl = mockedFn(gitClient.fetchFromUrl);
	const mockDeleteRefs = mockedFn(gitClient.deleteRefs);

	beforeEach(() => {
		vi.clearAllMocks();

		mockDeleteRefs.mockResolvedValue(undefined);
	});

	describe("happy path", () => {
		it("should resolve valid remote refs", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			const result = await resolveRemoteRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledWith(
				"https://github.com/owner/repo.git",
				["main:refs/diffx/tmp/test-prefix/left", "feature:refs/diffx/tmp/test-prefix/right"],
				1,
			);

			expect(result).toEqual({
				left: "refs/diffx/tmp/test-prefix/left",
				right: "refs/diffx/tmp/test-prefix/right",
				cleanup: expect.any(Function),
			});
		});

		it("should parse remote refs with dots in ref names", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@v1.0.0",
				right: "owner/repo@v2.0.0",
				ownerRepo: "owner/repo",
			};

			const result = await resolveRemoteRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledWith(
				"https://github.com/owner/repo.git",
				["v1.0.0:refs/diffx/tmp/test-prefix/left", "v2.0.0:refs/diffx/tmp/test-prefix/right"],
				1,
			);

			expect(result.left).toBe("refs/diffx/tmp/test-prefix/left");
			expect(result.right).toBe("refs/diffx/tmp/test-prefix/right");
		});

		it("should parse remote refs with slashes", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@release/v1",
				right: "owner/repo@release/v2",
				ownerRepo: "owner/repo",
			};

			const result = await resolveRemoteRefs(range);

			expect(mockFetchFromUrl).toHaveBeenCalledWith(
				"https://github.com/owner/repo.git",
				[
					"release/v1:refs/diffx/tmp/test-prefix/left",
					"release/v2:refs/diffx/tmp/test-prefix/right",
				],
				1,
			);

			expect(result.cleanup).toBeDefined();
		});

		it("should call cleanup function", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			const result = await resolveRemoteRefs(range);

			await result.cleanup!();

			expect(mockDeleteRefs).toHaveBeenCalledWith([
				"refs/diffx/tmp/test-prefix/left",
				"refs/diffx/tmp/test-prefix/right",
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

			await expect(resolveRemoteRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveRemoteRefs(range)).rejects.toThrow(
				"Invalid ref type for remote resolver",
			);
		});

		it("should throw when ownerRepo is missing", async () => {
			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
			};

			await expect(resolveRemoteRefs(range)).rejects.toThrow(DiffxError);
		});

		it("should throw for invalid owner/repo format - missing owner", async () => {
			const range: RefRange = {
				type: "remote-range",
				left: "/repo@main",
				right: "/repo@feature",
				ownerRepo: "/repo",
			};

			await expect(resolveRemoteRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveRemoteRefs(range)).rejects.toThrow("Invalid owner/repo: /repo");
		});

		it("should throw for invalid owner/repo format - missing repo", async () => {
			const range: RefRange = {
				type: "remote-range",
				left: "owner/@main",
				right: "owner/@feature",
				ownerRepo: "owner/",
			};

			await expect(resolveRemoteRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveRemoteRefs(range)).rejects.toThrow("Invalid owner/repo: owner/");
		});

		it("should throw for malformed remote ref - missing @", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo/main", // missing @
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			await expect(resolveRemoteRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveRemoteRefs(range)).rejects.toThrow("Invalid remote ref format");
		});

		it("should throw for malformed remote ref - wrong format", async () => {
			mockFetchFromUrl.mockResolvedValue(undefined);

			const range: RefRange = {
				type: "remote-range",
				left: "main@feature", // wrong format
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			await expect(resolveRemoteRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveRemoteRefs(range)).rejects.toThrow("Invalid remote ref format");
		});

		it("should wrap fetch errors with GIT_ERROR exit code", async () => {
			mockFetchFromUrl.mockRejectedValue(new Error("Network error"));

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			try {
				await resolveRemoteRefs(range);
				expect.unreachable();
			} catch (error) {
				expect(error).toBeInstanceOf(DiffxError);
				expect((error as DiffxError).exitCode).toBe(ExitCode.GIT_ERROR);
				expect((error as DiffxError).message).toContain("Failed to fetch remote refs");
			}
		});

		it("should include original error message in wrapped error", async () => {
			mockFetchFromUrl.mockRejectedValue(new Error("Connection refused"));

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			try {
				await resolveRemoteRefs(range);
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).message).toContain("Connection refused");
			}
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
				await resolveRemoteRefs(range);
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).exitCode).toBe(ExitCode.INVALID_INPUT);
			}
		});

		it("should return INVALID_INPUT for malformed format", async () => {
			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
				ownerRepo: "invalid",
			};

			try {
				await resolveRemoteRefs(range);
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).exitCode).toBe(ExitCode.INVALID_INPUT);
			}
		});

		it("should return GIT_ERROR for fetch failures", async () => {
			mockFetchFromUrl.mockRejectedValue(new Error("Fetch failed"));

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			try {
				await resolveRemoteRefs(range);
				expect.unreachable();
			} catch (error) {
				expect((error as DiffxError).exitCode).toBe(ExitCode.GIT_ERROR);
			}
		});
	});
});

/**
 * Tests for local ref resolver
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { resolveLocalRefs } from "./local-ref-resolver";
import { gitClient } from "../git/git-client";
import type { RefRange } from "../types";
import { DiffxError, ExitCode } from "../types";

// Mock dependencies
vi.mock("../git/git-client", () => ({
	gitClient: {
		refExistsAny: vi.fn(),
		mergeBase: vi.fn(),
	},
}));

vi.mock("../git/utils", () => ({
	normalizeRef: (ref: string) => ref.replace(/^refs\/(heads|tags)\//, ""),
}));

describe("resolveLocalRefs", () => {
	const mockRefExistsAny = mockedFn(gitClient.refExistsAny);
	const mockMergeBase = mockedFn(gitClient.mergeBase);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("happy path", () => {
		it("should resolve valid local refs", async () => {
			mockRefExistsAny.mockImplementation((ref: string) =>
				Promise.resolve(ref === "main" || ref === "feature"),
			);

			const range: RefRange = {
				type: "local-range",
				left: "main",
				right: "feature",
				rangeSyntax: undefined,
			};

			const result = await resolveLocalRefs(range);

			expect(result).toEqual({
				left: "main",
				right: "feature",
			});
		});

		it("should normalize refs with prefixes", async () => {
			mockRefExistsAny.mockImplementation((ref: string) =>
				Promise.resolve(ref === "main" || ref === "v1.0"),
			);

			const range: RefRange = {
				type: "local-range",
				left: "refs/heads/main",
				right: "refs/tags/v1.0",
				rangeSyntax: undefined,
			};

			const result = await resolveLocalRefs(range);

			expect(result).toEqual({
				left: "main",
				right: "v1.0",
			});
		});

		it("should resolve commit SHAs", async () => {
			mockRefExistsAny.mockResolvedValue(true);

			const range: RefRange = {
				type: "local-range",
				left: "abc123",
				right: "def456",
				rangeSyntax: undefined,
			};

			const result = await resolveLocalRefs(range);

			expect(result).toEqual({
				left: "abc123",
				right: "def456",
			});
		});

		it("should compute merge-base for triple-dot range", async () => {
			mockRefExistsAny.mockResolvedValue(true);
			mockMergeBase.mockResolvedValue("mergebase456\n");

			const range: RefRange = {
				type: "local-range",
				left: "main",
				right: "feature",
				rangeSyntax: "three-dot",
			};

			const result = await resolveLocalRefs(range);

			expect(mockMergeBase).toHaveBeenCalledWith("main", "feature");
			expect(result).toEqual({
				left: "mergebase456",
				right: "feature",
			});
		});

		it("should not compute merge-base for double-dot range", async () => {
			mockRefExistsAny.mockResolvedValue(true);

			const range: RefRange = {
				type: "local-range",
				left: "main",
				right: "feature",
				rangeSyntax: "two-dot",
			};

			const result = await resolveLocalRefs(range);

			expect(mockMergeBase).not.toHaveBeenCalled();
			expect(result).toEqual({
				left: "main",
				right: "feature",
			});
		});
	});

	describe("error cases", () => {
		it("should throw for wrong range type", async () => {
			const range: RefRange = {
				type: "remote-range",
				left: "main",
				right: "feature",
				ownerRepo: "owner/repo",
				rangeSyntax: undefined,
			};

			await expect(resolveLocalRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveLocalRefs(range)).rejects.toThrow("Invalid ref type for local resolver");
		});

		it("should throw when left ref does not exist", async () => {
			mockRefExistsAny.mockImplementation(async (ref: string) => {
				return ref === "feature"; // only right ref exists
			});

			const range: RefRange = {
				type: "local-range",
				left: "nonexistent",
				right: "feature",
				rangeSyntax: undefined,
			};

			await expect(resolveLocalRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveLocalRefs(range)).rejects.toThrow("Left ref does not exist: nonexistent");
		});

		it("should throw when right ref does not exist", async () => {
			mockRefExistsAny.mockImplementation(async (ref: string) => {
				return ref === "main"; // only left ref exists
			});

			const range: RefRange = {
				type: "local-range",
				left: "main",
				right: "nonexistent",
				rangeSyntax: undefined,
			};

			await expect(resolveLocalRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveLocalRefs(range)).rejects.toThrow(
				"Right ref does not exist: nonexistent",
			);
		});

		it("should throw when both refs do not exist", async () => {
			mockRefExistsAny.mockResolvedValue(false);

			const range: RefRange = {
				type: "local-range",
				left: "nonexistent1",
				right: "nonexistent2",
				rangeSyntax: undefined,
			};

			await expect(resolveLocalRefs(range)).rejects.toThrow(DiffxError);
			await expect(resolveLocalRefs(range)).rejects.toThrow(
				"Left ref does not exist: nonexistent1",
			);
		});
	});

	describe("exit codes", () => {
		it("should return INVALID_INPUT exit code for wrong type", async () => {
			const range: RefRange = {
				type: "remote-range",
				left: "main",
				right: "feature",
				ownerRepo: "owner/repo",
				rangeSyntax: undefined,
			};

			try {
				await resolveLocalRefs(range);
				expect.unreachable();
			} catch (error) {
				expect(error).toBeInstanceOf(DiffxError);
				expect((error as DiffxError).exitCode).toBe(ExitCode.INVALID_INPUT);
			}
		});

		it("should return INVALID_INPUT exit code for missing ref", async () => {
			mockRefExistsAny.mockResolvedValue(false);

			const range: RefRange = {
				type: "local-range",
				left: "missing",
				right: "feature",
				rangeSyntax: undefined,
			};

			try {
				await resolveLocalRefs(range);
				expect.unreachable();
			} catch (error) {
				expect(error).toBeInstanceOf(DiffxError);
				expect((error as DiffxError).exitCode).toBe(ExitCode.INVALID_INPUT);
			}
		});
	});
});

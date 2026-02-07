/**
 * Tests for patch generator
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { generatePatch } from "./patch-generator";
import type { GitDiffOptions } from "../git/types";
import type { PatchStyle } from "../types";

// Mock simple-git to prevent real git operations
vi.mock("simple-git", () => {
	const mockGit = {
		diff: vi.fn(),
		raw: vi.fn(),
	};
	return {
		default: vi.fn(() => mockGit),
	};
});

describe("generatePatch", () => {
	let mockGit: {
		diff: Mock;
		raw: Mock;
	};

	beforeEach(async () => {
		const simpleGit = await import("simple-git");
		const git = simpleGit.default();
		mockGit = {
			diff: mockedFn(git.diff),
			raw: mockedFn(git.raw),
		};
		vi.clearAllMocks();
	});

	describe("with default patchStyle", () => {
		it("should use gitClient.diff by default (git compatibility)", async () => {
			mockGit.diff.mockResolvedValue("diff content");

			const result = await generatePatch("v1.0", "v2.0", undefined, undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["v1.0", "v2.0", "--"]);
			expect(result).toBe("diff content");
		});

		it("should use gitClient.formatPatch when patchStyle is explicitly format-patch", async () => {
			mockGit.raw.mockResolvedValue("patch content");

			const patchStyle: PatchStyle = "format-patch";
			const result = await generatePatch("v1.0", "v2.0", undefined, patchStyle);

			expect(mockGit.raw).toHaveBeenCalledWith(["format-patch", "--stdout", "v1.0..v2.0"]);
			expect(result).toBe("patch content");
		});
	});

	describe("with patchStyle=diff", () => {
		it("should use gitClient.diff when patchStyle is 'diff'", async () => {
			mockGit.diff.mockResolvedValue("diff content");

			const patchStyle: PatchStyle = "diff";
			const result = await generatePatch("v1.0", "v2.0", undefined, patchStyle);

			expect(mockGit.diff).toHaveBeenCalledWith(["v1.0", "v2.0", "--"]);
			expect(result).toBe("diff content");
		});
	});

	describe("with GitDiffOptions", () => {
		it("should pass options to diff with default style", async () => {
			mockGit.diff.mockResolvedValue("diff with options");

			const options: GitDiffOptions = {
				color: "never",
				files: ["src/changed.ts"],
			};

			const result = await generatePatch("main", "feature", options, undefined);

			expect(mockGit.diff).toHaveBeenCalledWith([
				"--color=never",
				"main",
				"feature",
				"--",
				"src/changed.ts",
			]);
			expect(result).toBe("diff with options");
		});

		it("should pass options to diff when patchStyle is 'diff'", async () => {
			mockGit.diff.mockResolvedValue("diff with options");

			const options: GitDiffOptions = {
				color: "always",
				files: ["src/file1.ts", "src/file2.ts"],
			};

			const patchStyle: PatchStyle = "diff";
			const result = await generatePatch("main", "feature", options, patchStyle);

			expect(mockGit.diff).toHaveBeenCalledWith([
				"--color=always",
				"main",
				"feature",
				"--",
				"src/file1.ts",
				"src/file2.ts",
			]);
			expect(result).toBe("diff with options");
		});
	});

	describe("different refs", () => {
		it("should handle commit SHAs", async () => {
			mockGit.diff.mockResolvedValue("sha diff");

			const result = await generatePatch("abc123", "def456", undefined, undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["abc123", "def456", "--"]);
			expect(result).toBe("sha diff");
		});

		it("should handle tags", async () => {
			mockGit.diff.mockResolvedValue("tag diff");

			const result = await generatePatch("v1.0.0", "v2.0.0", undefined, undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["v1.0.0", "v2.0.0", "--"]);
			expect(result).toBe("tag diff");
		});

		it("should handle branch names with slashes", async () => {
			mockGit.diff.mockResolvedValue("branch diff");

			const result = await generatePatch(
				"feature/old-branch",
				"feature/new-branch",
				undefined,
				undefined,
			);

			expect(mockGit.diff).toHaveBeenCalledWith(["feature/old-branch", "feature/new-branch", "--"]);
			expect(result).toBe("branch diff");
		});
	});

	describe("PatchStyle type safety", () => {
		it("should handle all PatchStyle values", async () => {
			mockGit.diff.mockResolvedValue("diff output");
			mockGit.raw.mockResolvedValue("patch output");

			const patchStyles: PatchStyle[] = ["diff", "format-patch"];

			for (const style of patchStyles) {
				const result = await generatePatch("main", "feature", undefined, style);
				expect(result).toBeTruthy();
			}
		});
	});
});

/**
 * Tests for output factory
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { generateOutput, generateOutputAgainstWorktree } from "./output-factory";
import type { GitDiffOptions } from "../git/types";
import type { OutputMode, PatchStyle } from "../types";

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

describe("output factory", () => {
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

	describe("generateOutput for range diffs", () => {
		const left = "main";
		const right = "feature";
		const options: GitDiffOptions | undefined = undefined;

		describe("diff mode", () => {
			it("should route to gitClient.diff", async () => {
				mockGit.diff.mockResolvedValueOnce("diff content");

				const result = await generateOutput("diff", left, right, options, undefined);

				expect(mockGit.diff).toHaveBeenCalledWith([left, `${right}`, "--"]);
				expect(result).toBe("diff content");
			});
		});

		describe("patch mode", () => {
			it("should route to gitClient.diff for patches (default patchStyle='diff')", async () => {
				mockGit.diff.mockResolvedValueOnce("patch content");

				const result = await generateOutput("patch", left, right, options, undefined);

				// With default patchStyle='diff', patch mode now uses gitClient.diff
				expect(mockGit.diff).toHaveBeenCalledWith([left, `${right}`, "--"]);
				expect(result).toBe("patch content");
			});

			it("should pass patchStyle parameter to generatePatch", async () => {
				mockGit.diff.mockResolvedValueOnce("patch content");

				const patchStyle: PatchStyle = "diff";
				const result = await generateOutput("patch", left, right, options, patchStyle);

				expect(mockGit.diff).toHaveBeenCalledWith([left, `${right}`, "--"]);
				expect(result).toBe("patch content");
			});

			it("should use format-patch style when specified via patchStyle parameter", async () => {
				mockGit.raw.mockResolvedValueOnce("patch content");

				const patchStyle: PatchStyle = "format-patch";
				const result = await generateOutput("patch", left, right, options, patchStyle);

				expect(mockGit.raw).toHaveBeenCalledWith(["format-patch", "--stdout", `${left}..${right}`]);
				expect(result).toBe("patch content");
			});
		});

		describe("stat mode", () => {
			it("should route to gitClient.diffStat", async () => {
				mockGit.diff.mockResolvedValueOnce("stat content");

				const result = await generateOutput("stat", left, right, options, undefined);

				expect(mockGit.diff).toHaveBeenCalledWith(["--stat", `${left}..${right}`]);
				expect(result).toBe("stat content");
			});
		});

		describe("numstat mode", () => {
			it("should route to gitClient.diffNumStat", async () => {
				mockGit.diff.mockResolvedValueOnce("numstat content");

				const result = await generateOutput("numstat", left, right, options, undefined);

				expect(mockGit.diff).toHaveBeenCalledWith(["--numstat", `${left}..${right}`]);
				expect(result).toBe("numstat content");
			});
		});

		describe("shortstat mode", () => {
			it("should route to gitClient.diffShortStat", async () => {
				mockGit.diff.mockResolvedValueOnce("shortstat content");

				const result = await generateOutput("shortstat", left, right, options, undefined);

				expect(mockGit.diff).toHaveBeenCalledWith(["--shortstat", `${left}..${right}`]);
				expect(result).toBe("shortstat content");
			});
		});

		describe("name-only mode", () => {
			it("should route to gitClient.diffNameOnly", async () => {
				mockGit.diff.mockResolvedValueOnce("file1.txt\nfile2.txt");

				const result = await generateOutput("name-only", left, right, options, undefined);

				expect(mockGit.diff).toHaveBeenCalledWith(["--name-only", `${left}..${right}`]);
				expect(result).toBe("file1.txt\nfile2.txt");
			});
		});

		describe("name-status mode", () => {
			it("should route to gitClient.diffNameStatus", async () => {
				mockGit.diff.mockResolvedValueOnce("M file1.txt\nA file2.txt");

				const result = await generateOutput("name-status", left, right, options, undefined);

				expect(mockGit.diff).toHaveBeenCalledWith(["--name-status", `${left}..${right}`]);
				expect(result).toBe("M file1.txt\nA file2.txt");
			});

			it("should pass options through for name-status range diffs", async () => {
				mockGit.diff.mockResolvedValueOnce("M src/file.ts");

				const result = await generateOutput(
					"name-status",
					left,
					right,
					{ files: ["*.ts"], color: "never", extraArgs: ["-M"] },
					undefined,
				);

				expect(mockGit.diff).toHaveBeenCalledWith([
					"-M",
					"--color=never",
					"--name-status",
					`${left}..${right}`,
					"--",
					"*.ts",
				]);
				expect(result).toBe("M src/file.ts");
			});
		});

		describe("summary mode", () => {
			it("should route to gitClient.diffSummary", async () => {
				mockGit.diff.mockResolvedValueOnce(
					" create mode 100644 file.txt\n rename old.txt -> new.txt",
				);

				const result = await generateOutput("summary", left, right, options, undefined);

				expect(mockGit.diff).toHaveBeenCalledWith(["--summary", `${left}..${right}`]);
				expect(result).toBe(" create mode 100644 file.txt\n rename old.txt -> new.txt");
			});
		});

		describe("type safety", () => {
			it("should have all OutputMode cases covered", async () => {
				// This test ensures type-level coverage - if a new mode is added,
				// TypeScript will complain until it's handled in the factory
				const modes: OutputMode[] = [
					"diff",
					"patch",
					"stat",
					"numstat",
					"shortstat",
					"name-only",
					"name-status",
					"summary",
				];

				for (const mode of modes) {
					// Mock responses for all modes
					mockGit.diff.mockResolvedValue("diff");

					const result = await generateOutput(mode, left, right, options, undefined);
					expect(result).toBeTruthy();
				}
			});
		});
	});

	describe("generateOutputAgainstWorktree", () => {
		const ref = "HEAD";
		const options: GitDiffOptions | undefined = undefined;

		describe("diff mode", () => {
			it("should route to gitClient.diffAgainstWorktree", async () => {
				mockGit.diff.mockResolvedValueOnce("diff content");

				const result = await generateOutputAgainstWorktree("diff", ref, options);

				expect(mockGit.diff).toHaveBeenCalledWith([ref, "--"]);
				expect(result).toBe("diff content");
			});
		});

		describe("patch mode", () => {
			it("should route to gitClient.diffAgainstWorktree for patches", async () => {
				mockGit.diff.mockResolvedValueOnce("patch content");

				const result = await generateOutputAgainstWorktree("patch", ref, options);

				expect(mockGit.diff).toHaveBeenCalledWith([ref, "--"]);
				expect(result).toBe("patch content");
			});
		});

		describe("stat mode", () => {
			it("should route to gitClient.diffStatAgainstWorktree", async () => {
				mockGit.diff.mockResolvedValueOnce("stat content");

				const result = await generateOutputAgainstWorktree("stat", ref, options);

				expect(mockGit.diff).toHaveBeenCalledWith(["--stat", ref]);
				expect(result).toBe("stat content");
			});
		});

		describe("numstat mode", () => {
			it("should route to gitClient.diffNumStatAgainstWorktree", async () => {
				mockGit.diff.mockResolvedValueOnce("numstat content");

				const result = await generateOutputAgainstWorktree("numstat", ref, options);

				expect(mockGit.diff).toHaveBeenCalledWith(["--numstat", ref]);
				expect(result).toBe("numstat content");
			});
		});

		describe("shortstat mode", () => {
			it("should route to gitClient.diffShortStatAgainstWorktree", async () => {
				mockGit.diff.mockResolvedValueOnce("shortstat content");

				const result = await generateOutputAgainstWorktree("shortstat", ref, options);

				expect(mockGit.diff).toHaveBeenCalledWith(["--shortstat", ref]);
				expect(result).toBe("shortstat content");
			});
		});

		describe("name-only mode", () => {
			it("should route to gitClient.diffNameOnlyAgainstWorktree", async () => {
				mockGit.diff.mockResolvedValueOnce("file1.ts\nfile2.ts");

				const result = await generateOutputAgainstWorktree("name-only", ref, options);

				expect(mockGit.diff).toHaveBeenCalledWith(["--name-only", ref]);
				expect(result).toBe("file1.ts\nfile2.ts");
			});
		});

		describe("name-status mode", () => {
			it("should route to gitClient.diffNameStatusAgainstWorktree", async () => {
				mockGit.diff.mockResolvedValueOnce("M file1.ts\nA file2.ts");

				const result = await generateOutputAgainstWorktree("name-status", ref, undefined);

				expect(mockGit.diff).toHaveBeenCalledWith(["--name-status", ref]);
				expect(result).toBe("M file1.ts\nA file2.ts");
			});

			it("should pass options through for name-status worktree diffs", async () => {
				mockGit.diff.mockResolvedValueOnce("M src/file.ts");

				const result = await generateOutputAgainstWorktree("name-status", ref, {
					files: ["*.ts"],
					color: "never",
					extraArgs: ["-M"],
				});

				expect(mockGit.diff).toHaveBeenCalledWith([
					"-M",
					"--color=never",
					"--name-status",
					ref,
					"--",
					"*.ts",
				]);
				expect(result).toBe("M src/file.ts");
			});
		});

		describe("summary mode", () => {
			it("should route to gitClient.diffSummaryAgainstWorktree", async () => {
				mockGit.diff.mockResolvedValueOnce(" create mode 100644 file.ts");

				const result = await generateOutputAgainstWorktree("summary", ref, options);

				expect(mockGit.diff).toHaveBeenCalledWith(["--summary", ref]);
				expect(result).toBe(" create mode 100644 file.ts");
			});
		});

		describe("type safety", () => {
			it("should handle all OutputMode values", async () => {
				const modes: OutputMode[] = [
					"diff",
					"patch",
					"stat",
					"numstat",
					"shortstat",
					"name-only",
					"name-status",
					"summary",
				];

				for (const mode of modes) {
					mockGit.diff.mockResolvedValue("worktree diff");

					const result = await generateOutputAgainstWorktree(mode, ref, options);
					expect(result).toBeTruthy();
				}
			});
		});
	});

	describe("with GitDiffOptions", () => {
		it("should pass options to the underlying generator", async () => {
			mockGit.diff.mockResolvedValueOnce("colored diff");

			const options: GitDiffOptions = {
				color: "never",
				files: ["src/index.ts", "src/utils.ts"],
			};

			const result = await generateOutput("diff", "main", "feature", options, undefined);

			expect(mockGit.diff).toHaveBeenCalledWith([
				"--color=never",
				"main",
				"feature",
				"--",
				"src/index.ts",
				"src/utils.ts",
			]);
			expect(result).toBe("colored diff");
		});

		it("should pass options for worktree diffs", async () => {
			mockGit.diff.mockResolvedValueOnce("colored worktree diff");

			const options: GitDiffOptions = {
				color: "always",
				files: ["src/changed.ts"],
			};

			const result = await generateOutputAgainstWorktree("diff", "HEAD", options);

			expect(mockGit.diff).toHaveBeenCalledWith(["--color=always", "HEAD", "--", "src/changed.ts"]);
			expect(result).toBe("colored worktree diff");
		});
	});
});

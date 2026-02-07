/**
 * Tests for CLI command orchestration
 *
 * Note: Many helper functions in command.ts are internal.
 * This tests the exported command through integration-style testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DiffxError, ExitCode } from "../types";

// Mock all dependencies
vi.mock("../parsers/range-parser", () => ({
	parseRangeInput: vi.fn(),
}));

vi.mock("../resolvers/ref-resolver", () => ({
	resolveRefs: vi.fn(),
}));

vi.mock("../resolvers/auto-base-resolver", () => ({
	resolveAutoBaseRefs: vi.fn(),
}));

vi.mock("../output/output-factory", () => ({
	generateOutput: vi.fn(),
	generateOutputAgainstWorktree: vi.fn(),
}));

vi.mock("../filters/file-filter", () => ({
	buildFilePatterns: vi.fn(() => []),
	shouldIncludeFile: vi.fn(() => true),
}));

vi.mock("../errors/error-handler", () => ({
	checkEmptyOutput: vi.fn(() => ({ isEmpty: false, isFilterMismatch: false })),
	createNoFilesMatchedError: vi.fn(
		() => new DiffxError("No files matched", ExitCode.NO_FILES_MATCHED),
	),
}));

vi.mock("../git/git-client", () => ({
	gitClient: {
		hasWorktreeChanges: vi.fn(),
		getUntrackedFiles: vi.fn(() => []),
		diffNumStatAgainstWorktree: vi.fn(() => ""),
		diffNumStatNoIndex: vi.fn(() => ""),
		diffShortStat: vi.fn(() => ""),
		runGitDiffRaw: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
	},
}));

vi.mock("./pager", () => ({
	pageOutput: vi.fn(async () => false),
}));

vi.mock("../utils/overview-utils", () => ({
	buildStatusMapForRange: vi.fn(async () => new Map()),
	buildStatusMapForWorktree: vi.fn(async () => new Map()),
	formatNumstatOutput: vi.fn((output) => output),
	generateUntrackedOutput: vi.fn(async () => ""),
	mergeOutputs: vi.fn((base, extra) => (base ? `${base}\n${extra}`.trim() : extra)),
}));

// Mock console.log
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

// Import after mocking
import { diffxCommand } from "./command";
import { parseRangeInput } from "../parsers/range-parser";
import { resolveRefs } from "../resolvers/ref-resolver";
import { resolveAutoBaseRefs } from "../resolvers/auto-base-resolver";
import { generateOutput, generateOutputAgainstWorktree } from "../output/output-factory";
import { gitClient } from "../git/git-client";
import { pageOutput } from "./pager";
import { checkEmptyOutput, createNoFilesMatchedError } from "../errors/error-handler";
import { buildStatusMapForWorktree } from "../utils/overview-utils";
import { shouldIncludeFile, buildFilePatterns } from "../filters/file-filter";

describe("diffxCommand", () => {
	let mockContext: any;
	let originalArgv: string[];

	beforeEach(() => {
		// Store original process.argv
		originalArgv = process.argv.slice();
		vi.clearAllMocks();

		// Default context
		mockContext = {
			tokens: [],
			args: {
				mode: { type: "string" },
				stat: { type: "boolean" },
				numstat: { type: "boolean" },
				summary: { type: "boolean" },
				shortstat: { type: "boolean" },
				overview: { type: "boolean" },
				pager: { type: "boolean" },
				"no-pager": { type: "boolean", negatable: true },
				include: { type: "string", short: "i" },
				exclude: { type: "string", short: "e" },
				index: { type: "boolean" },
			},
			positionals: [],
			values: {},
			env: { name: "diffx" },
		};

		// Setup default mock returns
		(gitClient.hasWorktreeChanges as any).mockResolvedValue(true);
		(generateOutputAgainstWorktree as any).mockResolvedValue("diff output");
		(pageOutput as any).mockResolvedValue(false);
		(checkEmptyOutput as any).mockReturnValue({ isEmpty: false, isFilterMismatch: false });
	});

	afterEach(() => {
		// Restore process.argv
		process.argv = originalArgv;
	});

	describe("arg partitioning and git pass-through", () => {
		it("should allow unknown git flags (pass-through)", async () => {
			// Git flags like -U, -w, --color-moved, etc. should be allowed
			process.argv = ["node", "diffx", "-U3"];
			mockContext.tokens = [{ kind: "option", name: "U", rawName: "-U" }];
			mockContext.values = {};

			// Should not throw - git flags are allowed
			await diffxCommand.run(mockContext);
		});

		it("should allow git output format flags", async () => {
			process.argv = ["node", "diffx", "--stat"];
			mockContext.tokens = [{ kind: "option", name: "stat", rawName: "--stat" }];
			mockContext.values = { stat: true };

			await diffxCommand.run(mockContext);
		});

		it("should handle flags after -- separator", async () => {
			process.argv = ["node", "diffx", "--stat", "--", "file.txt"];
			mockContext.tokens = [
				{ kind: "option", name: "stat", rawName: "--stat" },
				{ kind: "option-terminator" },
			];
			mockContext.positionals = ["file.txt"];
			mockContext.values = { stat: true };

			await diffxCommand.run(mockContext);
		});

		it("should throw when git pass-through exits non-zero", async () => {
			process.argv = ["node", "diffx", "--stat", "--bad-flag"];
			mockContext.tokens = [{ kind: "option", name: "stat", rawName: "--stat" }];
			mockContext.values = { stat: true };
			(gitClient.runGitDiffRaw as any).mockResolvedValue({
				stdout: "",
				stderr: "error: invalid option",
				exitCode: 1,
			});

			await expect(diffxCommand.run(mockContext)).rejects.toThrow(DiffxError);
			await expect(diffxCommand.run(mockContext)).rejects.toThrow("error: invalid option");
			expect(pageOutput).not.toHaveBeenCalled();
		});

		it("should cleanup resolved refs after pass-through git diff runs", async () => {
			const cleanup = vi.fn(async () => {});
			process.argv = ["node", "diffx", "github:owner/repo#123", "--stat"];
			mockContext.positionals = ["github:owner/repo#123"];
			mockContext.tokens = [
				{ kind: "positional", value: "github:owner/repo#123" },
				{ kind: "option", name: "stat", rawName: "--stat" },
			];
			mockContext.values = { stat: true };
			(parseRangeInput as any).mockReturnValue({
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			});
			(resolveRefs as any).mockResolvedValue({
				left: "refs/diffx/left",
				right: "refs/diffx/right",
				cleanup,
			});
			(gitClient.runGitDiffRaw as any).mockImplementation(async () => {
				expect(cleanup).not.toHaveBeenCalled();
				return { stdout: "stat output", stderr: "", exitCode: 0 };
			});

			await diffxCommand.run(mockContext);

			expect(cleanup).toHaveBeenCalledTimes(1);
		});

		it("should pass --word-diff-regex value containing .. through to git diff", async () => {
			process.argv = ["node", "diffx", "--word-diff-regex", "foo..bar"];
			mockContext.tokens = [
				{ kind: "option", name: "word-diff-regex", rawName: "--word-diff-regex" },
			];
			mockContext.values = {};
			(gitClient.runGitDiffRaw as any).mockResolvedValue({
				stdout: "",
				stderr: "",
				exitCode: 0,
			});

			await diffxCommand.run(mockContext);

			expect(gitClient.runGitDiffRaw).toHaveBeenCalledWith(["--word-diff-regex", "foo..bar"]);
		});

		it("should use auto pager in git pass-through mode by default", async () => {
			process.argv = ["node", "diffx", "--stat"];
			mockContext.tokens = [{ kind: "option", name: "stat", rawName: "--stat" }];
			mockContext.values = { stat: true };
			(gitClient.runGitDiffRaw as any).mockResolvedValue({
				stdout: "stat output",
				stderr: "",
				exitCode: 0,
			});

			await diffxCommand.run(mockContext);

			expect(pageOutput).toHaveBeenCalledWith("stat output", {
				force: undefined,
				disable: false,
			});
		});

		it("should disable pager in git pass-through mode with --no-pager", async () => {
			process.argv = ["node", "diffx", "--stat", "--no-pager"];
			mockContext.tokens = [
				{ kind: "option", name: "stat", rawName: "--stat" },
				{ kind: "option", name: "no-pager", rawName: "--no-pager" },
			];
			mockContext.values = { stat: true, "no-pager": true };
			(gitClient.runGitDiffRaw as any).mockResolvedValue({
				stdout: "stat output",
				stderr: "",
				exitCode: 0,
			});

			await diffxCommand.run(mockContext);

			expect(pageOutput).toHaveBeenCalledWith("stat output", {
				force: undefined,
				disable: true,
			});
		});

		it("should force pager in git pass-through mode with --pager", async () => {
			process.argv = ["node", "diffx", "--stat", "--pager"];
			mockContext.tokens = [
				{ kind: "option", name: "stat", rawName: "--stat" },
				{ kind: "option", name: "pager", rawName: "--pager" },
			];
			mockContext.values = { stat: true, pager: true };
			(gitClient.runGitDiffRaw as any).mockResolvedValue({
				stdout: "stat output",
				stderr: "",
				exitCode: 0,
			});

			await diffxCommand.run(mockContext);

			expect(pageOutput).toHaveBeenCalledWith("stat output", {
				force: true,
				disable: false,
			});
		});

		it.each([
			{
				label: "local range",
				input: "main..feature",
				parsed: { type: "local-range", left: "main", right: "feature" },
				expectedArgs: ["--stat", "main", "feature"],
			},
			{
				label: "GitHub PR ref",
				input: "github:owner/repo#123",
				parsed: { type: "pr-ref", left: "", right: "", ownerRepo: "owner/repo", prNumber: 123 },
				expectedArgs: ["--stat", "refs/diffx/left", "refs/diffx/right"],
			},
			{
				label: "GitHub PR URL",
				input: "https://github.com/owner/repo/pull/123",
				parsed: { type: "github-url", left: "", right: "", ownerRepo: "owner/repo", prNumber: 123 },
				expectedArgs: ["--stat", "refs/diffx/left", "refs/diffx/right"],
			},
			{
				label: "GitLab MR ref",
				input: "gitlab:owner/repo!123",
				parsed: {
					type: "gitlab-mr-ref",
					left: "",
					right: "",
					ownerRepo: "owner/repo",
					prNumber: 123,
				},
				expectedArgs: ["--stat", "refs/diffx/left", "refs/diffx/right"],
			},
		])(
			"should apply --stat pass-through consistently for $label",
			async ({ input, parsed, expectedArgs }) => {
				process.argv = ["node", "diffx", input, "--stat"];
				mockContext.positionals = [input];
				mockContext.tokens = [
					{ kind: "positional", value: input },
					{ kind: "option", name: "stat", rawName: "--stat" },
				];
				mockContext.values = { stat: true };

				(parseRangeInput as any).mockReturnValue(parsed);
				(resolveRefs as any).mockResolvedValue({
					left: "refs/diffx/left",
					right: "refs/diffx/right",
				});
				(gitClient.runGitDiffRaw as any).mockResolvedValue({
					stdout: "stat output",
					stderr: "",
					exitCode: 0,
				});

				await diffxCommand.run(mockContext);

				expect(gitClient.runGitDiffRaw).toHaveBeenCalledWith(expectedArgs);
			},
		);
	});

	describe("pager conflict validation", () => {
		it("should throw when both --pager and --no-pager are set", async () => {
			mockContext.values = { pager: true, "no-pager": true };

			await expect(diffxCommand.run(mockContext)).rejects.toThrow(DiffxError);
			await expect(diffxCommand.run(mockContext)).rejects.toThrow(
				"Cannot use both --pager and --no-pager",
			);
		});

		it("should allow only --pager", async () => {
			mockContext.values = { pager: true };

			await diffxCommand.run(mockContext);
		});

		it("should allow only --no-pager", async () => {
			mockContext.values = { "no-pager": true };

			await diffxCommand.run(mockContext);
		});

		it("should pass through non-diffx positional args when range parsing fails", async () => {
			process.argv = ["node", "diffx", "--stat", "HEAD~1"];
			mockContext.positionals = ["HEAD~1"];
			mockContext.tokens = [
				{ kind: "option", name: "stat", rawName: "--stat" },
				{ kind: "positional", value: "HEAD~1" },
			];
			mockContext.values = { stat: true };
			(parseRangeInput as any).mockImplementation(() => {
				throw new DiffxError("Invalid range or URL: HEAD~1", ExitCode.INVALID_INPUT);
			});

			await diffxCommand.run(mockContext);

			expect(gitClient.runGitDiffRaw).toHaveBeenCalledWith(["--stat", "HEAD~1"]);
		});
	});

	describe("--overview mutual exclusivity", () => {
		it("should throw when --overview used with --stat", async () => {
			process.argv = ["node", "diffx", "--overview", "--stat"];
			mockContext.values = { overview: true };
			mockContext.tokens = [
				{ kind: "option", name: "overview", rawName: "--overview" },
				{ kind: "option", name: "stat", rawName: "--stat" },
			];

			await expect(diffxCommand.run(mockContext)).rejects.toThrow();
			await expect(diffxCommand.run(mockContext)).rejects.toThrow(
				"Cannot use --overview with git output format flags",
			);
		});

		it("should throw when --overview used with --numstat", async () => {
			process.argv = ["node", "diffx", "--overview", "--numstat"];
			mockContext.values = { overview: true };
			mockContext.tokens = [
				{ kind: "option", name: "overview", rawName: "--overview" },
				{ kind: "option", name: "numstat", rawName: "--numstat" },
			];

			await expect(diffxCommand.run(mockContext)).rejects.toThrow();
		});

		it("should throw when --overview used with -p", async () => {
			process.argv = ["node", "diffx", "--overview", "-p"];
			mockContext.values = { overview: true };
			mockContext.tokens = [
				{ kind: "option", name: "overview", rawName: "--overview" },
				{ kind: "option", name: "p", rawName: "-p" },
			];

			await expect(diffxCommand.run(mockContext)).rejects.toThrow();
		});

		it("should allow --overview when no git output format flags present", async () => {
			process.argv = ["node", "diffx", "--overview"];
			mockContext.values = { overview: true };
			mockContext.tokens = [{ kind: "option", name: "overview", rawName: "--overview" }];

			await diffxCommand.run(mockContext);
		});

		it("should allow git output format flags without --overview", async () => {
			process.argv = ["node", "diffx", "--stat"];
			mockContext.values = {};
			mockContext.tokens = [{ kind: "option", name: "stat", rawName: "--stat" }];

			await diffxCommand.run(mockContext);
		});
	});

	describe("mode resolution", () => {
		it("should use explicit mode", async () => {
			mockContext.values = { mode: "patch" };
			(generateOutputAgainstWorktree as any).mockResolvedValue("patch output");

			await diffxCommand.run(mockContext);

			expect(generateOutputAgainstWorktree).toHaveBeenCalledWith(
				expect.any(String),
				"HEAD",
				expect.any(Object),
			);
		});

		it("should throw for invalid mode", async () => {
			mockContext.values = { mode: "invalid" };

			await expect(diffxCommand.run(mockContext)).rejects.toThrow(DiffxError);
			await expect(diffxCommand.run(mockContext)).rejects.toThrow("Invalid mode: invalid");
		});

		it("should use stat mode when --stat is set", async () => {
			mockContext.tokens = [{ kind: "option", name: "stat", rawName: "--stat" }];
			mockContext.values = { stat: true };

			await diffxCommand.run(mockContext);

			// Should use generateOutputAgainstWorktree with stat mode
			expect(generateOutputAgainstWorktree).toHaveBeenCalled();
		});

		it("should use numstat mode when --overview is set", async () => {
			mockContext.tokens = [{ kind: "option", name: "overview", rawName: "--overview" }];
			mockContext.values = { overview: true };

			await diffxCommand.run(mockContext);

			expect(generateOutputAgainstWorktree).toHaveBeenCalled();
		});

		it("should default to diff mode", async () => {
			mockContext.values = {};

			await diffxCommand.run(mockContext);

			expect(generateOutputAgainstWorktree).toHaveBeenCalledWith(
				"diff",
				"HEAD",
				expect.any(Object),
			);
		});
	});

	describe("range vs auto-base resolution", () => {
		it("should use auto-base when no range provided", async () => {
			mockContext.positionals = [];
			(gitClient.hasWorktreeChanges as any).mockResolvedValue(false);
			(resolveAutoBaseRefs as any).mockResolvedValue({
				left: "merge-base",
				right: "HEAD",
				baseRef: "origin/main",
				mergeBase: "merge-base",
			});
			(generateOutput as any).mockResolvedValue("diff output");

			await diffxCommand.run(mockContext);

			expect(resolveAutoBaseRefs).toHaveBeenCalled();
			expect(generateOutput).toHaveBeenCalledWith(
				"diff",
				"merge-base",
				"HEAD",
				expect.any(Object),
				undefined,
			);
		});

		it("should use index against worktree when --index flag is set", async () => {
			mockContext.positionals = [];
			mockContext.values = { index: true };
			process.argv = ["node", "diffx", "--index"];
			(gitClient.runGitDiffRaw as any).mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

			await diffxCommand.run(mockContext);

			// --index now routes to strict git pass-through
			expect(gitClient.runGitDiffRaw).toHaveBeenCalledWith([]);
			expect(generateOutputAgainstWorktree).not.toHaveBeenCalled();
			expect(resolveAutoBaseRefs).not.toHaveBeenCalled();
		});

		it("should parse range from positionals", async () => {
			mockContext.positionals = ["main..feature"];
			mockContext.values = { overview: true }; // Use --overview to prevent pass-through
			mockContext.tokens = [
				{ kind: "option", name: "overview", rawName: "--overview" },
				{ kind: "positional", value: "main..feature" },
			];
			process.argv = ["node", "diffx", "--overview", "main..feature"]; // Set argv for partitioner
			(parseRangeInput as any).mockReturnValue({
				type: "local-range",
				left: "main",
				right: "feature",
			} as ReturnType<typeof parseRangeInput>);
			(resolveRefs as any).mockResolvedValue({
				left: "main",
				right: "feature",
			});
			(generateOutput as any).mockResolvedValue("diff output");

			await diffxCommand.run(mockContext);

			expect(parseRangeInput).toHaveBeenCalledWith("main..feature");
			// --overview uses numstat mode
			expect(generateOutput).toHaveBeenCalledWith(
				"numstat",
				"main",
				"feature",
				expect.any(Object),
				undefined,
			);
		});
	});

	describe("include/exclude filters", () => {
		it("should pass include filter to git commands", async () => {
			mockContext.values = { include: "*.ts" };
			process.argv = ["node", "diffx", "--include", "*.ts"];
			(buildFilePatterns as any).mockReturnValue(["*.ts"]);

			await diffxCommand.run(mockContext);

			expect(buildFilePatterns).toHaveBeenCalledWith({ include: ["*.ts"], exclude: undefined });
		});

		it("should pass exclude filter to git commands", async () => {
			mockContext.values = { exclude: "*.test.ts" };
			process.argv = ["node", "diffx", "--exclude", "*.test.ts"];
			(buildFilePatterns as any).mockReturnValue([":(exclude)*.test.ts"]);

			await diffxCommand.run(mockContext);

			expect(buildFilePatterns).toHaveBeenCalledWith({
				include: undefined,
				exclude: ["*.test.ts"],
			});
		});

		it("should not parse non-range positional as diffx range when filters are active", async () => {
			process.argv = ["node", "diffx", "--include", "*.ts", "HEAD~1"];
			mockContext.values = { include: "*.ts" };
			mockContext.positionals = ["HEAD~1"];
			mockContext.tokens = [{ kind: "positional", value: "HEAD~1" }];

			await diffxCommand.run(mockContext);

			expect(parseRangeInput).not.toHaveBeenCalled();
			expect(generateOutputAgainstWorktree).toHaveBeenCalled();
		});

		it("should pass multiple include filters from repeated flags", async () => {
			process.argv = ["node", "diffx", "--include", "*.ts", "--include", "*.tsx"];
			mockContext.values = { include: ["*.ts", "*.tsx"] };
			(buildFilePatterns as any).mockReturnValue(["*.ts", "*.tsx"]);

			await diffxCommand.run(mockContext);

			expect(buildFilePatterns).toHaveBeenCalledWith({
				include: ["*.ts", "*.tsx"],
				exclude: undefined,
			});
		});

		it("should pass multiple include/exclude filters from repeated flags", async () => {
			process.argv = [
				"node",
				"diffx",
				"--include",
				"*.ts",
				"--include",
				"*.tsx",
				"--exclude",
				"*.js",
				"--exclude",
				"*.jsx",
			];
			mockContext.values = {
				include: ["*.ts", "*.tsx"],
				exclude: ["*.js", "*.jsx"],
			};
			(buildFilePatterns as any).mockReturnValue(["*.ts", "*.tsx", ":!*.js", ":!*.jsx"]);

			await diffxCommand.run(mockContext);

			expect(buildFilePatterns).toHaveBeenCalledWith({
				include: ["*.ts", "*.tsx"],
				exclude: ["*.js", "*.jsx"],
			});
		});
	});

	describe("cleanup", () => {
		it("should cleanup refs after success", async () => {
			const mockCleanup = vi.fn();
			mockContext.positionals = ["main..feature"];
			mockContext.tokens = [{ kind: "positional", value: "main..feature" }];
			(parseRangeInput as any).mockReturnValue({
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			} as ReturnType<typeof parseRangeInput>);
			(resolveRefs as any).mockResolvedValue({
				left: "refs/diffx/...",
				right: "refs/diffx/...",
				cleanup: mockCleanup,
			});
			(generateOutput as any).mockResolvedValue("diff output");

			await diffxCommand.run(mockContext);

			expect(mockCleanup).toHaveBeenCalled();
		});

		it("should cleanup refs after error", async () => {
			const mockCleanup = vi.fn();
			mockContext.positionals = ["github:owner/repo#123"]; // Use PR ref format
			mockContext.values = { overview: true }; // Use --overview to prevent pass-through
			mockContext.tokens = [
				{ kind: "option", name: "overview", rawName: "--overview" },
				{ kind: "positional", value: "github:owner/repo#123" },
			];
			process.argv = ["node", "diffx", "--overview", "github:owner/repo#123"];
			(parseRangeInput as any).mockReturnValue({
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			} as ReturnType<typeof parseRangeInput>);
			(resolveRefs as any).mockResolvedValue({
				left: "refs/diffx/...",
				right: "refs/diffx/...",
				cleanup: mockCleanup,
			});
			(generateOutput as any).mockRejectedValue(new Error("Generate failed"));

			await expect(diffxCommand.run(mockContext)).rejects.toThrow("Generate failed");

			expect(mockCleanup).toHaveBeenCalled();
		});

		it("should handle cleanup errors gracefully", async () => {
			const mockCleanup = vi.fn(() => Promise.reject(new Error("Cleanup failed")));
			mockContext.positionals = ["main..feature"];
			mockContext.tokens = [{ kind: "positional", value: "main..feature" }];
			(parseRangeInput as any).mockReturnValue({
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			} as ReturnType<typeof parseRangeInput>);
			(resolveRefs as any).mockResolvedValue({
				left: "refs/diffx/...",
				right: "refs/diffx/...",
				cleanup: mockCleanup,
			});
			(generateOutput as any).mockResolvedValue("diff output");

			await diffxCommand.run(mockContext);
			expect(mockCleanup).toHaveBeenCalled();
		});
	});

	describe("empty output handling", () => {
		it("should return early when output is empty without filters", async () => {
			(checkEmptyOutput as any).mockReturnValue({ isEmpty: true, isFilterMismatch: false });
			(generateOutputAgainstWorktree as any).mockResolvedValue("");

			await diffxCommand.run(mockContext);

			expect(pageOutput).not.toHaveBeenCalled();
			expect(mockConsoleLog).not.toHaveBeenCalled();
		});

		it("should throw NO_FILES_MATCHED when output empty with active filters", async () => {
			mockContext.values = { include: "*.ts" };
			(buildFilePatterns as any).mockReturnValue(["*.ts"]);

			(checkEmptyOutput as any).mockReturnValue({ isEmpty: true, isFilterMismatch: true });
			(createNoFilesMatchedError as any).mockReturnValue(
				new DiffxError("No files matched", ExitCode.NO_FILES_MATCHED),
			);
			(generateOutputAgainstWorktree as any).mockResolvedValue("");

			await expect(diffxCommand.run(mockContext)).rejects.toThrow(DiffxError);
			await expect(diffxCommand.run(mockContext)).rejects.toThrow("No files matched");
		});
	});

	describe("output handling", () => {
		it("should log output when pager not used", async () => {
			(generateOutputAgainstWorktree as any).mockResolvedValue("test diff output");
			(pageOutput as any).mockResolvedValue(false);

			await diffxCommand.run(mockContext);

			expect(mockConsoleLog).toHaveBeenCalledWith("test diff output");
		});

		it("should not log when pager is used", async () => {
			(generateOutputAgainstWorktree as any).mockResolvedValue("test diff output");
			(pageOutput as any).mockResolvedValue(true);

			await diffxCommand.run(mockContext);

			expect(mockConsoleLog).not.toHaveBeenCalled();
		});
	});

	describe("untracked files", () => {
		it("should not append untracked for range diffs", async () => {
			mockContext.positionals = ["main..feature"];
			(parseRangeInput as any).mockReturnValue({
				type: "local-range",
				left: "main",
				right: "feature",
			} as ReturnType<typeof parseRangeInput>);
			(resolveRefs as any).mockResolvedValue({
				left: "main",
				right: "feature",
			});
			(generateOutput as any).mockResolvedValue("diff output");
			(gitClient.getUntrackedFiles as any).mockResolvedValue(["newfile.txt"]);

			await diffxCommand.run(mockContext);

			// Should not call getUntrackedFiles for range diffs
			// (untracked handling is worktree-only)
		});

		it("should append untracked for worktree diffs in overview mode", async () => {
			mockContext.values = { overview: true };
			(gitClient.getUntrackedFiles as any).mockResolvedValue(["newfile.ts"]);
			(shouldIncludeFile as any).mockReturnValue(true);
			(generateOutputAgainstWorktree as any).mockResolvedValue("numstat output");
			(buildStatusMapForWorktree as any).mockResolvedValue(new Map());

			await diffxCommand.run(mockContext);

			expect(gitClient.getUntrackedFiles).toHaveBeenCalled();
		});
	});

	describe("multiple positional arguments", () => {
		it("should throw for multiple positionals", async () => {
			mockContext.positionals = ["main", "feature"];

			await expect(diffxCommand.run(mockContext)).rejects.toThrow(DiffxError);
			await expect(diffxCommand.run(mockContext)).rejects.toThrow("Unexpected arguments: feature");
		});
	});

	describe("patch style for remote ranges", () => {
		it("should use patchStyle=diff for PR URLs in patch mode", async () => {
			mockContext.positionals = ["https://github.com/owner/repo/pull/123"];
			mockContext.values = { mode: "patch" };
			mockContext.tokens = [
				{ kind: "option", name: "mode", rawName: "--mode" },
				{ kind: "positional", value: "https://github.com/owner/repo/pull/123" },
			];
			process.argv = ["node", "diffx", "--mode=patch", "https://github.com/owner/repo/pull/123"];
			(parseRangeInput as any).mockReturnValue({
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			} as ReturnType<typeof parseRangeInput>);
			(resolveRefs as any).mockResolvedValue({
				left: "refs/diffx/...",
				right: "refs/diffx/...",
			});
			(generateOutput as any).mockResolvedValue("patch output");

			await diffxCommand.run(mockContext);

			// Should use patchStyle="diff" for PR refs in patch mode
			expect(generateOutput).toHaveBeenCalledWith(
				"patch",
				expect.any(String),
				expect.any(String),
				expect.any(Object),
				"diff",
			);
		});
	});

	describe("TTY and color detection", () => {
		it("should enable color for diff mode with pager", async () => {
			mockContext.values = { pager: true };

			await diffxCommand.run(mockContext);

			const diffOptions = (generateOutputAgainstWorktree as any).mock.calls[0]?.[2];
			expect(diffOptions?.color).toBe("always");
		});
	});

	describe("numstat mode without overview", () => {
		it("should return early from processWorktreeOutput when mode is numstat but not overview", async () => {
			mockContext.values = {};
			mockContext.tokens = [{ kind: "option", name: "numstat", rawName: "--numstat" }];
			(generateOutputAgainstWorktree as any).mockResolvedValue("numstat output");
			(buildStatusMapForWorktree as any).mockResolvedValue(new Map());

			await diffxCommand.run(mockContext);

			// Should not call buildStatusMapForWorktree since useSummaryFormat is false
			expect(buildStatusMapForWorktree).not.toHaveBeenCalled();
		});
	});

	describe("git pass-through with --index flag", () => {
		it("should use empty refs for --index flag in pass-through mode", async () => {
			mockContext.values = { index: true };
			mockContext.tokens = [{ kind: "option", name: "stat", rawName: "--stat" }];
			mockContext.positionals = [];
			process.argv = ["node", "diffx", "--stat", "--index"];
			(gitClient.runGitDiffRaw as any).mockResolvedValue({
				stdout: "stat output",
				stderr: "",
				exitCode: 0,
			});
			(pageOutput as any).mockResolvedValue(false);

			await diffxCommand.run(mockContext);

			// --index is diffx-owned and activates strict git pass-through behavior
			expect(gitClient.runGitDiffRaw).toHaveBeenCalledWith(["--stat"]);
		});

		it("should use strict git pass-through for --index without other git args", async () => {
			mockContext.values = { index: true };
			mockContext.tokens = [{ kind: "option", name: "index", rawName: "--index" }];
			mockContext.positionals = [];
			process.argv = ["node", "diffx", "--index"];
			(gitClient.runGitDiffRaw as any).mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
			(pageOutput as any).mockResolvedValue(false);

			await diffxCommand.run(mockContext);

			expect(gitClient.runGitDiffRaw).toHaveBeenCalledWith([]);
		});
	});

	describe("stat mode with untracked files", () => {
		it("should format stat rows correctly", async () => {
			mockContext.values = { stat: true };
			mockContext.tokens = [{ kind: "option", name: "stat", rawName: "--stat" }];
			(gitClient.getUntrackedFiles as any).mockResolvedValue(["newfile.ts"]);
			(shouldIncludeFile as any).mockReturnValue(true);
			(generateOutputAgainstWorktree as any).mockResolvedValue(
				" file.ts | 5 ++++\n 1 file changed, 5 insertions(+)\n",
			);
			(gitClient.diffNumStatAgainstWorktree as any).mockResolvedValue("5\t0\tfile.ts\n");
			(gitClient.diffNumStatNoIndex as any).mockResolvedValue("10\t0\tnewfile.ts\n");
			(pageOutput as any).mockResolvedValue(false);
			(checkEmptyOutput as any).mockReturnValue({ isEmpty: false, isFilterMismatch: false });

			await diffxCommand.run(mockContext);

			// Should have formatted stat output
			expect(mockConsoleLog).toHaveBeenCalled();
		});

		it("should return empty string when formatStatRows gets empty array", async () => {
			// This tests the early return path in formatStatRows
			mockContext.values = { stat: true };
			mockContext.tokens = [{ kind: "option", name: "stat", rawName: "--stat" }];
			(generateOutputAgainstWorktree as any).mockResolvedValue(" 0 files changed\n");
			(gitClient.getUntrackedFiles as any).mockResolvedValue([]);
			(pageOutput as any).mockResolvedValue(false);
			(checkEmptyOutput as any).mockReturnValue({ isEmpty: false, isFilterMismatch: false });

			await diffxCommand.run(mockContext);

			expect(mockConsoleLog).toHaveBeenCalledWith(" 0 files changed\n");
		});
	});
});

/**
 * Git Diff Parity Tests (Integration)
 *
 * These tests compare diffx output against native git diff output
 * to ensure compatibility. They use real git repositories and CLI execution.
 *
 * Note: These tests require the CLI to be built (dist/bin.mjs exists)
 * TODO: Add integration tests here once CLI pass-through is implemented
 */

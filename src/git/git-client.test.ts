/**
 * Tests for git client
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { GitClient } from "./git-client";
import type { GitDiffOptions } from "./types";
import type { StatusResult } from "simple-git";

// Mock simple-git
vi.mock("simple-git", () => {
	const mockGit = {
		diff: vi.fn(),
		raw: vi.fn(),
		revparse: vi.fn(),
		remote: vi.fn(),
		getRemotes: vi.fn(),
		status: vi.fn(),
		addConfig: vi.fn(),
		init: vi.fn(),
		checkout: vi.fn(),
		checkoutLocalBranch: vi.fn(),
		add: vi.fn(),
		commit: vi.fn(),
		mv: vi.fn(),
		rm: vi.fn(),
		merge: vi.fn(),
		addAnnotatedTag: vi.fn(),
	};

	return {
		default: vi.fn(() => mockGit),
	};
});

describe("GitClient", () => {
	let gitClient: GitClient;
	let mockGit: {
		diff: Mock;
		raw: Mock;
		revparse: Mock;
		remote: Mock;
		getRemotes: Mock;
		status: Mock;
		addConfig: Mock;
		init: Mock;
		checkout: Mock;
		checkoutLocalBranch: Mock;
		add: Mock;
		commit: Mock;
		mv: Mock;
		rm: Mock;
		merge: Mock;
		addAnnotatedTag: Mock;
	};

	beforeEach(async () => {
		// Create a fresh instance for each test
		gitClient = new GitClient();
		const simpleGit = await import("simple-git");
		const git = simpleGit.default();
		mockGit = {
			diff: mockedFn(git.diff),
			raw: mockedFn(git.raw),
			revparse: mockedFn(git.revparse),
			remote: mockedFn(git.remote),
			getRemotes: mockedFn(git.getRemotes),
			status: mockedFn(git.status),
			addConfig: mockedFn(git.addConfig),
			init: mockedFn(git.init),
			checkout: mockedFn(git.checkout),
			checkoutLocalBranch: mockedFn(git.checkoutLocalBranch),
			add: mockedFn(git.add),
			commit: mockedFn(git.commit),
			mv: mockedFn(git.mv),
			rm: mockedFn(git.rm),
			merge: mockedFn(git.merge),
			addAnnotatedTag: mockedFn(git.addAnnotatedTag),
		};
		vi.clearAllMocks();
	});

	describe("diff", () => {
		it("should generate diff between two refs", async () => {
			mockGit.diff.mockResolvedValue("diff content");

			const result = await gitClient.diff("main", "feature", undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["main", "feature", "--"]);
			expect(result).toBe("diff content");
		});

		it("should pass color option", async () => {
			mockGit.diff.mockResolvedValue("diff content");

			const options: GitDiffOptions = {
				color: "never",
			};

			await gitClient.diff("main", "feature", options);

			expect(mockGit.diff).toHaveBeenCalledWith(["--color=never", "main", "feature", "--"]);
		});

		it("should pass file paths", async () => {
			mockGit.diff.mockResolvedValue("diff content");

			const options: GitDiffOptions = {
				files: ["src/index.ts", "src/utils.ts"],
			};

			await gitClient.diff("main", "feature", options);

			expect(mockGit.diff).toHaveBeenCalledWith([
				"main",
				"feature",
				"--",
				"src/index.ts",
				"src/utils.ts",
			]);
		});
	});

	describe("diffAgainstWorktree", () => {
		it("should generate diff between ref and working tree", async () => {
			mockGit.diff.mockResolvedValue("diff content");

			const result = await gitClient.diffAgainstWorktree("HEAD", undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["HEAD", "--"]);
			expect(result).toBe("diff content");
		});

		it("should pass file paths", async () => {
			mockGit.diff.mockResolvedValue("diff content");

			const options: GitDiffOptions = {
				files: ["src/index.ts"],
			};

			await gitClient.diffAgainstWorktree("HEAD", options);

			expect(mockGit.diff).toHaveBeenCalledWith(["HEAD", "--", "src/index.ts"]);
		});
	});

	describe("formatPatch", () => {
		it("should generate patch between two refs", async () => {
			mockGit.raw.mockResolvedValue("patch content");

			const result = await gitClient.formatPatch("v1.0", "v2.0", undefined);

			expect(mockGit.raw).toHaveBeenCalledWith(["format-patch", "--stdout", "v1.0..v2.0"]);
			expect(result).toBe("patch content");
		});

		it("should pass file paths", async () => {
			mockGit.raw.mockResolvedValue("patch content");

			const options: GitDiffOptions = {
				files: ["src/index.ts"],
			};

			await gitClient.formatPatch("v1.0", "v2.0", options);

			expect(mockGit.raw).toHaveBeenCalledWith([
				"format-patch",
				"--stdout",
				"v1.0..v2.0",
				"--",
				"src/index.ts",
			]);
		});
	});

	describe("diffStat", () => {
		it("should generate diff stat between two refs", async () => {
			mockGit.diff.mockResolvedValue(
				" src/file.txt | 5 +--\n 1 file changed, 3 insertions(+), 2 deletions(-)",
			);

			const result = await gitClient.diffStat("main", "feature", undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["--stat", "main..feature"]);
			expect(result).toContain("1 file changed");
		});
	});

	describe("diffStatAgainstWorktree", () => {
		it("should generate diff stat for worktree", async () => {
			mockGit.diff.mockResolvedValue(" src/file.txt | 5 +--\n");

			const result = await gitClient.diffStatAgainstWorktree("HEAD", undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["--stat", "HEAD"]);
			expect(result).toBeTruthy();
		});
	});

	describe("diffNumStat", () => {
		it("should generate numstat between two refs", async () => {
			mockGit.diff.mockResolvedValue("3\t2\tsrc/file.txt\n");

			const result = await gitClient.diffNumStat("main", "feature", undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["--numstat", "main..feature"]);
			expect(result).toBe("3\t2\tsrc/file.txt\n");
		});
	});

	describe("diffNumStatAgainstWorktree", () => {
		it("should generate numstat for worktree", async () => {
			mockGit.diff.mockResolvedValue("5\t0\tsrc/new-file.ts\n");

			const result = await gitClient.diffNumStatAgainstWorktree("HEAD", undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["--numstat", "HEAD"]);
			expect(result).toBe("5\t0\tsrc/new-file.ts\n");
		});
	});

	describe("diffShortStat", () => {
		it("should generate shortstat between two refs", async () => {
			mockGit.diff.mockResolvedValue(" 1 file changed, 3 insertions(+), 2 deletions(-)\n");

			const result = await gitClient.diffShortStat("main", "feature", undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["--shortstat", "main..feature"]);
			expect(result).toContain("1 file changed");
		});
	});

	describe("diffShortStatAgainstWorktree", () => {
		it("should generate shortstat for worktree", async () => {
			mockGit.diff.mockResolvedValue(" 2 files changed, 5 insertions(+)\n");

			const result = await gitClient.diffShortStatAgainstWorktree("HEAD", undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["--shortstat", "HEAD"]);
			expect(result).toContain("2 files changed");
		});
	});

	describe("refExists", () => {
		it("should return true when ref exists", async () => {
			mockGit.revparse.mockResolvedValue("abc123");

			const result = await gitClient.refExists("main");

			expect(mockGit.revparse).toHaveBeenCalledWith(["--verify", "refs/heads/main"]);
			expect(result).toBe(true);
		});

		it("should return false when ref does not exist", async () => {
			mockGit.revparse.mockRejectedValue(new Error("unknown ref"));

			const result = await gitClient.refExists("nonexistent");

			expect(result).toBe(false);
		});
	});

	describe("refExistsAny", () => {
		it("should return true when ref exists", async () => {
			mockGit.revparse.mockResolvedValue("abc123");

			const result = await gitClient.refExistsAny("refs/tags/v1.0");

			expect(mockGit.revparse).toHaveBeenCalledWith(["--verify", "refs/tags/v1.0"]);
			expect(result).toBe(true);
		});

		it("should return false when ref does not exist", async () => {
			mockGit.revparse.mockRejectedValue(new Error("unknown ref"));

			const result = await gitClient.refExistsAny("refs/heads/nonexistent");

			expect(result).toBe(false);
		});
	});

	describe("addRemote", () => {
		it("should add remote", async () => {
			await gitClient.addRemote("origin", "https://github.com/owner/repo.git");

			expect(mockGit.remote).toHaveBeenCalledWith([
				"add",
				"origin",
				"https://github.com/owner/repo.git",
			]);
		});
	});

	describe("getRemotes", () => {
		it("should get all remotes", async () => {
			mockGit.getRemotes.mockResolvedValue([
				{
					name: "origin",
					refs: {
						fetch: "https://github.com/owner/repo.git",
						push: "https://github.com/owner/repo.git",
					},
				},
			]);

			const result = await gitClient.getRemotes();

			expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
			expect(result).toEqual([
				{
					name: "origin",
					fetchUrl: "https://github.com/owner/repo.git",
					pushUrl: "https://github.com/owner/repo.git",
				},
			]);
		});
	});

	describe("fetch", () => {
		it("should fetch refs from remote", async () => {
			await gitClient.fetch("origin", ["refs/heads/main:refs/remotes/origin/main"]);

			expect(mockGit.raw).toHaveBeenCalledWith([
				"fetch",
				"--no-tags",
				"--depth",
				"1",
				"origin",
				"refs/heads/main:refs/remotes/origin/main",
			]);
		});

		it("should fetch without specific refs", async () => {
			await gitClient.fetch("origin", undefined);

			expect(mockGit.raw).toHaveBeenCalledWith(["fetch", "--no-tags", "--depth", "1", "origin"]);
		});
	});

	describe("fetchFromUrl", () => {
		it("should fetch from URL with refspecs", async () => {
			await gitClient.fetchFromUrl(
				"https://github.com/owner/repo.git",
				["refs/heads/main:refs/remotes/tmp/main"],
				1,
			);

			expect(mockGit.raw).toHaveBeenCalledWith([
				"fetch",
				"--no-tags",
				"--depth",
				"1",
				"https://github.com/owner/repo.git",
				"refs/heads/main:refs/remotes/tmp/main",
			]);
		});
	});

	describe("fetchPR", () => {
		it("should fetch PR refs", async () => {
			await gitClient.fetchPR("origin", 123);

			expect(mockGit.raw).toHaveBeenCalledWith([
				"fetch",
				"--no-tags",
				"--depth",
				"2",
				"origin",
				"refs/pull/123/head:refs/remotes/origin/pull/123/head",
				"refs/pull/123/merge:refs/remotes/origin/pull/123/merge",
			]);
		});
	});

	describe("deleteRefs", () => {
		it("should delete refs that exist", async () => {
			mockGit.raw.mockResolvedValue("");

			await gitClient.deleteRefs(["refs/temp/1", "refs/temp/2"]);

			expect(mockGit.raw).toHaveBeenCalledWith(["update-ref", "-d", "refs/temp/1"]);
			expect(mockGit.raw).toHaveBeenCalledWith(["update-ref", "-d", "refs/temp/2"]);
		});

		it("should ignore errors for missing refs", async () => {
			mockGit.raw.mockRejectedValue(new Error("ref not found"));

			await expect(gitClient.deleteRefs(["refs/temp/1"])).resolves.not.toThrow();
		});
	});

	describe("getCurrentBranch", () => {
		it("should return current branch name", async () => {
			mockGit.revparse.mockResolvedValue("main\n");

			const result = await gitClient.getCurrentBranch();

			expect(mockGit.revparse).toHaveBeenCalledWith(["--abbrev-ref", "HEAD"]);
			expect(result).toBe("main");
		});
	});

	describe("getHeadHash", () => {
		it("should return HEAD commit hash", async () => {
			mockGit.revparse.mockResolvedValue("abc123\n");

			const result = await gitClient.getHeadHash();

			expect(mockGit.revparse).toHaveBeenCalledWith(["HEAD"]);
			expect(result).toBe("abc123\n");
		});
	});

	describe("hasWorktreeChanges", () => {
		it("should return true when there are changes", async () => {
			mockGit.status.mockResolvedValue({
				files: [{ path: "file.txt", index: "M", working_dir: "M" }],
				not_added: [],
			} as unknown as StatusResult);

			const result = await gitClient.hasWorktreeChanges();

			expect(result).toBe(true);
		});

		it("should return true when there are untracked files", async () => {
			mockGit.status.mockResolvedValue({
				files: [],
				not_added: ["newfile.txt"],
			} as unknown as StatusResult);

			const result = await gitClient.hasWorktreeChanges();

			expect(result).toBe(true);
		});

		it("should return false when worktree is clean", async () => {
			mockGit.status.mockResolvedValue({
				files: [],
				not_added: [],
			} as unknown as StatusResult);

			const result = await gitClient.hasWorktreeChanges();

			expect(result).toBe(false);
		});
	});

	describe("getStatus", () => {
		it("should return status result", async () => {
			const mockStatus = {
				files: [{ path: "file.txt", index: "M", working_dir: "M" }],
				not_added: ["newfile.txt"],
			};
			mockGit.status.mockResolvedValue(mockStatus as unknown as StatusResult);

			const result = await gitClient.getStatus();

			expect(result).toEqual(mockStatus);
		});
	});

	describe("getUntrackedFiles", () => {
		it("should return untracked files", async () => {
			mockGit.status.mockResolvedValue({
				files: [],
				not_added: ["file1.txt", "file2.txt"],
			} as unknown as StatusResult);

			const result = await gitClient.getUntrackedFiles();

			expect(result).toEqual(["file1.txt", "file2.txt"]);
		});
	});

	describe("diffNoIndex", () => {
		it("should generate diff for untracked file", async () => {
			mockGit.raw.mockResolvedValue("diff content");

			const result = await gitClient.diffNoIndex("newfile.txt", undefined);

			expect(mockGit.raw).toHaveBeenCalledWith([
				"diff",
				"--no-index",
				"--",
				"/dev/null",
				"newfile.txt",
			]);
			expect(result).toBe("diff content");
		});
	});

	describe("diffStatNoIndex", () => {
		it("should generate stat for untracked file", async () => {
			mockGit.raw.mockResolvedValue(" 1 file changed, 5 insertions(+)\n");

			const result = await gitClient.diffStatNoIndex("newfile.txt", undefined);

			expect(mockGit.raw).toHaveBeenCalledWith([
				"diff",
				"--no-index",
				"--stat",
				"--",
				"/dev/null",
				"newfile.txt",
			]);
			expect(result).toContain("1 file changed");
		});
	});

	describe("diffNumStatNoIndex", () => {
		it("should generate numstat for untracked file", async () => {
			mockGit.raw.mockResolvedValue("5\t0\tnewfile.txt\n");

			const result = await gitClient.diffNumStatNoIndex("newfile.txt", undefined);

			expect(mockGit.raw).toHaveBeenCalledWith([
				"diff",
				"--no-index",
				"--numstat",
				"--",
				"/dev/null",
				"newfile.txt",
			]);
			expect(result).toBe("5\t0\tnewfile.txt\n");
		});
	});

	describe("diffNameStatus", () => {
		it("should generate name-status between refs", async () => {
			mockGit.diff.mockResolvedValue("M\tsrc/file.txt\nA\tsrc/new.ts\nD\told.txt\n");

			const result = await gitClient.diffNameStatus("main", "feature", undefined);

			expect(mockGit.diff).toHaveBeenCalledWith(["--name-status", "main..feature"]);
			expect(result).toContain("M\tsrc/file.txt");
		});

		it("should apply files and extra args in name-status mode", async () => {
			mockGit.diff.mockResolvedValue("M\tsrc/file.ts\n");

			const result = await gitClient.diffNameStatus("main", "feature", {
				files: ["*.ts"],
				extraArgs: ["-M"],
				color: "never",
			});

			expect(mockGit.diff).toHaveBeenCalledWith([
				"-M",
				"--color=never",
				"--name-status",
				"main..feature",
				"--",
				"*.ts",
			]);
			expect(result).toContain("src/file.ts");
		});
	});

	describe("getRemoteHeadRef", () => {
		it("should return remote HEAD ref", async () => {
			mockGit.raw.mockResolvedValue("refs/remotes/origin/main");

			const result = await gitClient.getRemoteHeadRef("origin");

			expect(mockGit.raw).toHaveBeenCalledWith([
				"symbolic-ref",
				"--quiet",
				"--short",
				"refs/remotes/origin/HEAD",
			]);
			expect(result).toBe("refs/remotes/origin/main");
		});

		it("should return null when HEAD ref not found", async () => {
			mockGit.raw.mockRejectedValue(new Error("not found"));

			const result = await gitClient.getRemoteHeadRef("origin");

			expect(result).toBeNull();
		});
	});

	describe("getDefaultBranchRef", () => {
		it("should return origin/main when available", async () => {
			mockGit.getRemotes.mockResolvedValue([
				{ name: "origin", refs: { fetch: "url", push: "url" } },
			]);
			mockGit.raw.mockResolvedValue("refs/remotes/origin/main");

			const result = await gitClient.getDefaultBranchRef();

			expect(result).toBe("refs/remotes/origin/main");
		});
	});

	describe("mergeBase", () => {
		it("should return merge-base commit", async () => {
			mockGit.raw.mockResolvedValue("abc123def456\n");

			const result = await gitClient.mergeBase("main", "feature");

			expect(mockGit.raw).toHaveBeenCalledWith(["merge-base", "main", "feature"]);
			expect(result).toBe("abc123def456\n");
		});
	});

	describe("getConfigValue", () => {
		it("should return config value", async () => {
			mockGit.raw.mockResolvedValue("less -R\n");

			const result = await gitClient.getConfigValue("core.pager");

			expect(mockGit.raw).toHaveBeenCalledWith(["config", "--get", "core.pager"]);
			expect(result).toBe("less -R");
		});

		it("should return null when config not found", async () => {
			mockGit.raw.mockRejectedValue(new Error("key not found"));

			const result = await gitClient.getConfigValue("unknown.key");

			expect(result).toBeNull();
		});

		it("should support scope option", async () => {
			mockGit.raw.mockResolvedValue("value\n");

			const result = await gitClient.getConfigValue("core.pager", "global");

			expect(mockGit.raw).toHaveBeenCalledWith(["config", "--global", "--get", "core.pager"]);
			expect(result).toBe("value");
		});
	});

	describe("validateRefs", () => {
		it("should return true when refs are valid", async () => {
			mockGit.diff.mockResolvedValue("");

			const result = await gitClient.validateRefs("main", "feature");

			expect(result).toBe(true);
		});

		it("should return false when refs are invalid", async () => {
			mockGit.diff.mockRejectedValue(new Error("invalid refs"));

			const result = await gitClient.validateRefs("invalid1", "invalid2");

			expect(result).toBe(false);
		});
	});

	describe("getDefaultBranchRef", () => {
		it("should use origin remote when available (preferred)", async () => {
			mockGit.getRemotes.mockResolvedValue([
				{ name: "upstream", refs: { fetch: "url", push: "url" } },
				{ name: "origin", refs: { fetch: "url", push: "url" } },
			]);
			mockGit.raw.mockResolvedValue("refs/remotes/origin/main");

			const result = await gitClient.getDefaultBranchRef();

			expect(result).toBe("refs/remotes/origin/main");
		});
	});

	describe("runGitDiffRaw", () => {
		it("should run git diff with args and capture output", async () => {
			mockGit.raw.mockResolvedValue("diff output");

			const result = await gitClient.runGitDiffRaw(["--stat", "HEAD"]);

			expect(result.stdout).toBe("diff output");
			expect(result.exitCode).toBe(0);
		});

		it("should add color args when in TTY", async () => {
			const originalIsTTY = process.stdout.isTTY;
			Object.defineProperty(process.stdout, "isTTY", { get: () => true, configurable: true });

			mockGit.raw.mockResolvedValue("colored diff");

			const result = await gitClient.runGitDiffRaw(["HEAD"]);

			expect(mockGit.raw).toHaveBeenCalledWith(["diff", "--color=always", "HEAD"]);
			expect(result.stdout).toBe("colored diff");

			Object.defineProperty(process.stdout, "isTTY", {
				get: () => originalIsTTY,
				configurable: true,
			});
		});

		it("should handle git errors and return error info", async () => {
			mockGit.raw.mockRejectedValue(new Error("fatal: bad revision"));

			const result = await gitClient.runGitDiffRaw(["invalid-ref"]);

			expect(result.stdout).toBe("");
			expect(result.stderr).toBe("fatal: bad revision");
			expect(result.exitCode).toBe(1);
		});

		it("should handle non-Error objects in catch block", async () => {
			mockGit.raw.mockRejectedValue("string error");

			const result = await gitClient.runGitDiffRaw(["HEAD"]);

			expect(result.stdout).toBe("");
			expect(result.stderr).toBe("string error");
			expect(result.exitCode).toBe(1);
		});

		it("should work in non-capture mode (still captures for now)", async () => {
			mockGit.raw.mockResolvedValue("diff output");

			const result = await gitClient.runGitDiffRaw(["HEAD"], { capture: false });

			expect(result.stdout).toBe("diff output");
		});
	});
});

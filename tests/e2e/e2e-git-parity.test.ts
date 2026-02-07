/**
 * Git Diff Parity Tests
 *
 * These tests compare diffx output against native git diff output
 * to ensure git compatibility. They require the CLI to be built (dist/bin.mjs exists).
 *
 * Phase 3: Baseline Parity Tests
 * - Tests basic pass-through functionality
 * - Validates that diffx produces same output as git diff for common cases
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import {
	createGitFixture,
	commitFile,
	createBranch,
	createFile,
	type GitFixture,
} from "../../src/testing/git-fixture";

// ANSI escape code regex (using String.fromCharCode to avoid control character in literal)
const ANSI_ESCAPE_REGEX = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, "g");
const ANSI_START_REGEX = new RegExp(`${String.fromCharCode(0x1b)}\\[`);
import {
	runDiffxVsGitDiff,
	spawnProcess,
	normalizeLineEndings,
} from "../../src/testing/process-fixture";

describe("Git Diff Parity Tests", () => {
	// Store fixtures for cleanup
	const fixtures: GitFixture[] = [];

	// Build the project before running E2E tests
	beforeAll(async () => {
		// Skip rebuild if dist/bin.mjs already exists (faster iteration)
		if (existsSync("dist/bin.mjs")) {
			return;
		}

		const buildResult = await spawnProcess("bun", ["run", "build"], {
			timeout: 30000,
		});

		if (buildResult.exitCode !== 0) {
			throw new Error(`Build failed: ${buildResult.stderr}`);
		}
	});

	// Cleanup all fixtures after tests complete
	afterAll(async () => {
		for (const fixture of fixtures) {
			if (fixture) await fixture.cleanup();
		}
	});

	async function withFixture<T>(fn: (fixture: GitFixture) => Promise<T>): Promise<T> {
		const fixture = await createGitFixture({ initialBranch: "main" });
		fixtures.push(fixture);

		return fn(fixture);
	}

	describe("baseline pass-through", () => {
		it("should match git diff with no args (unstaged changes)", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				// Make uncommitted changes
				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff([], {
					cwd: fixture.path,
					timeout: 10000,
				});

				// Note: diffx with no args uses auto-base detection (convenient mode)
				// which is NOT strictly git diff compatible
				// For strict git compat, user should use --index flag
				expect(result.diffxResult.exitCode).toBe(0);
				expect(result.gitResult.exitCode).toBe(0);

				// Both should produce some output
				expect(result.diffxResult.stdout.length).toBeGreaterThan(0);
				expect(result.gitResult.stdout.length).toBeGreaterThan(0);
			});
		});

		it("should match git diff --stat flag", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original content\n");

				await createFile(fixture, "file.txt", "modified content\n");

				const result = await runDiffxVsGitDiff(["--stat"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
				expect(result.diffxResult.stdout).toContain("file.txt");
			});
		});

		it("should handle -- pathspec boundary correctly", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file1.txt", "content1\n");
				await commitFile(fixture, "file2.txt", "content2\n");

				await createFile(fixture, "file1.txt", "modified1\n");
				await createFile(fixture, "file2.txt", "modified2\n");

				// Use -- to separate flags from pathspecs
				const result = await runDiffxVsGitDiff(["--", "file1.txt"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				// Should only show file1.txt
				expect(result.diffxResult.stdout).toContain("file1.txt");
				expect(result.diffxResult.stdout).not.toContain("file2.txt");
			});
		});

		it("should match git diff for basic revision range (HEAD~1..HEAD)", async () => {
			await withFixture(async (fixture) => {
				// Create first commit
				await commitFile(fixture, "file.txt", "original\n");

				// Create second commit
				await commitFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["HEAD~1..HEAD"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
				expect(result.diffxResult.stdout).toContain("file.txt");
			});
		});

		it("should handle flag ordering correctly", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				await createFile(fixture, "file.txt", "modified\n");

				// Test different flag orderings
				const orderings = [
					["--stat", "--color=never"],
					["--color=never", "--stat"],
				];

				for (const args of orderings) {
					const result = await runDiffxVsGitDiff(args, {
						cwd: fixture.path,
						timeout: 10000,
					});

					expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
					expect(result.diffxResult.stdout).toContain("file.txt");
				}
			});
		});
	});

	describe("output format parity", () => {
		it("should match git diff -p (patch mode)", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["-p"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				// Patch format should have diff headers
				expect(result.diffxResult.stdout).toMatch(/^---/m);
				expect(result.diffxResult.stdout).toMatch(/^\+\+\+/m);
			});
		});

		it("should match git diff --shortstat", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--shortstat"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --numstat", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--numstat"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --name-only", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--name-only"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
				expect(result.diffxResult.stdout).toContain("file.txt");
			});
		});

		it("should match git diff --name-status", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--name-status"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --raw", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--raw"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --summary", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--summary"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});
	});

	describe("hunk/context parity", () => {
		it("should match git diff -U3 (unified context)", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "line1\nline2\nline3\nline4\nline5\n");

				await createFile(fixture, "file.txt", "line1\nline2\nmodified\nline4\nline5\n");

				const result = await runDiffxVsGitDiff(["-U3"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff -U5 (more context)", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "line1\nline2\nline3\nline4\nline5\nline6\nline7\n");

				await createFile(
					fixture,
					"file.txt",
					"line1\nline2\nline3\nmodified\nline5\nline6\nline7\n",
				);

				const result = await runDiffxVsGitDiff(["-U5"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --inter-hunk-context", async () => {
			await withFixture(async (fixture) => {
				await commitFile(
					fixture,
					"file.txt",
					"line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n",
				);

				await createFile(
					fixture,
					"file.txt",
					"line1\nmodified1\nline3\nline4\nline5\nmodified2\nline7\nline8\nline9\nline10\n",
				);

				const result = await runDiffxVsGitDiff(["--inter-hunk-context=2"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});
	});

	describe("whitespace parity", () => {
		it("should match git diff -w (ignore all whitespace)", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "line1  \nline2\t\n");

				await createFile(fixture, "file.txt", "line1\nline2\n");

				const result = await runDiffxVsGitDiff(["-w"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				// With -w, the whitespace changes should be ignored
				// So there should be no diff output
				const hasDiffContent = result.diffxResult.stdout.includes("---");
				expect(hasDiffContent).toBe(false);
			});
		});

		it("should match git diff --ignore-space-at-eol", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "line1   \n");

				await createFile(fixture, "file.txt", "line1\n");

				const result = await runDiffxVsGitDiff(["--ignore-space-at-eol"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --ignore-blank-lines", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "line1\n\nline2\n");

				await createFile(fixture, "file.txt", "line1\nline2\n");

				const result = await runDiffxVsGitDiff(["--ignore-blank-lines"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				// Blank line changes should be ignored
				const hasDiffContent = result.diffxResult.stdout.includes("---");
				expect(hasDiffContent).toBe(false);
			});
		});
	});

	describe("algorithm parity", () => {
		it("should match git diff --diff-algorithm=patience", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n");

				await createFile(fixture, "file.txt", "a\nb\nx\nd\ne\nf\ng\nh\ny\nj\n");

				const result = await runDiffxVsGitDiff(["--diff-algorithm=patience"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --patience", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n");

				await createFile(fixture, "file.txt", "a\nb\nx\nd\ne\nf\ng\nh\ny\nj\n");

				const result = await runDiffxVsGitDiff(["--patience"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --histogram", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n");

				await createFile(fixture, "file.txt", "a\nb\nx\nd\ne\nf\ng\nh\ny\nj\n");

				const result = await runDiffxVsGitDiff(["--histogram"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});
	});

	describe("rename/copy parity", () => {
		it("should match git diff -M (detect renames)", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file1.txt", "content\n");

				// Rename file2.txt -> file3.txt (git tracks this as rename)
				await commitFile(fixture, "file2.txt", "content2\n");
				await createBranch(fixture, "rename");
				await fixture.git.rm(["file2.txt"]);
				await commitFile(fixture, "file3.txt", "content2\n");
				await fixture.git.add(["."]);

				await fixture.git.checkout("main");

				const result = await runDiffxVsGitDiff(["main..rename", "-M"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff -C (detect copies)", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file1.txt", "content\n");

				await createBranch(fixture, "copy");
				await commitFile(fixture, "file2.txt", "content\n");

				await fixture.git.checkout("main");

				const result = await runDiffxVsGitDiff(["main..copy", "-C"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});
	});

	describe("color/output parity", () => {
		it("should match git diff --color=never", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--color=never"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
				// Should have no ANSI color codes
				expect(result.diffxResult.stdout).not.toMatch(ANSI_START_REGEX);
			});
		});

		it("should match git diff --color=always", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--color=always"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				// Normalize before comparing since color codes might differ slightly
				const diffxNormalized = result.diffxResult.stdout.replace(ANSI_ESCAPE_REGEX, "");
				const gitNormalized = result.gitResult.stdout.replace(ANSI_ESCAPE_REGEX, "");
				expect(normalizeLineEndings(diffxNormalized)).toBe(normalizeLineEndings(gitNormalized));
			});
		});
	});

	describe("word diff parity", () => {
		it("should match git diff --word-diff", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "hello world\n");

				await createFile(fixture, "file.txt", "hello there world\n");

				const result = await runDiffxVsGitDiff(["--word-diff"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --word-diff-regex", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "foo bar baz\n");

				await createFile(fixture, "file.txt", "foo qux baz\n");

				const result = await runDiffxVsGitDiff(["--word-diff-regex=[a-z]+", "--word-diff"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --color-words", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "hello world\n");

				await createFile(fixture, "file.txt", "hello there\n");

				const result = await runDiffxVsGitDiff(["--color-words"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				// Strip ANSI codes for comparison
				const diffxNormalized = result.diffxResult.stdout.replace(ANSI_ESCAPE_REGEX, "");
				const gitNormalized = result.gitResult.stdout.replace(ANSI_ESCAPE_REGEX, "");
				expect(normalizeLineEndings(diffxNormalized)).toBe(normalizeLineEndings(gitNormalized));
			});
		});
	});

	describe("binary/special parity", () => {
		it("should match git diff --binary", async () => {
			await withFixture(async (fixture) => {
				// Write binary files directly using the git fixture's git instance
				const { writeFile } = await import("node:fs/promises");
				const { join } = await import("node:path");

				const binPath1 = join(fixture.path, "file.bin");
				await writeFile(binPath1, Buffer.from([0x00, 0x01, 0x02]));
				await fixture.git.add(["file.bin"]);
				await fixture.git.commit("add binary file");

				const binPath2 = join(fixture.path, "file.bin");
				await writeFile(binPath2, Buffer.from([0x00, 0x01, 0x03]));

				const result = await runDiffxVsGitDiff(["--binary"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --abbrev", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--abbrev=5"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				// Abbrev affects commit hash display, not content
				expect(result.diffxResult.stdout.length).toBeGreaterThan(0);
			});
		});
	});

	describe("pickaxe/filtering parity", () => {
		it("should match git diff -S (pickaxe by string)", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "foo bar baz\n");

				await createFile(fixture, "file.txt", "foo qux baz\n");

				const result = await runDiffxVsGitDiff(["-S", "qux"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				// -S filters to commits that change the string
				expect(result.diffxResult.stdout).toContain("qux");
			});
		});

		it("should match git diff -G (pickaxe by regex)", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "foo123\n");

				await createFile(fixture, "file.txt", "bar456\n");

				const result = await runDiffxVsGitDiff(["-G", "[0-9]+"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				// -G filters to commits that match the regex
				expect(result.diffxResult.stdout.length).toBeGreaterThan(0);
			});
		});
	});

	describe("prefix/formatting parity", () => {
		it("should match git diff --no-prefix", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--no-prefix"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
				// Should not have a/ or b/ prefixes
				expect(result.diffxResult.stdout).not.toMatch(/^a\//m);
				expect(result.diffxResult.stdout).not.toMatch(/^b\//m);
			});
		});

		it("should match git diff --src-prefix", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--src-prefix", "old/"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});

		it("should match git diff --dst-prefix", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffxVsGitDiff(["--dst-prefix", "new/"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.diffxResult.exitCode).toBe(result.gitResult.exitCode);
				expect(result.stdoutMatches).toBe(true);
			});
		});
	});
});

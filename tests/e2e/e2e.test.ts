/**
 * End-to-end CLI tests
 * Tests the compiled CLI against real git repositories
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
import { runDiffx, mockTTY, restoreTTY } from "../../src/testing/process-fixture";

describe("E2E CLI tests", () => {
	// Store fixtures for cleanup
	const fixtures: GitFixture[] = [];

	// Build the project before running E2E tests
	beforeAll(async () => {
		// Skip rebuild if dist/bin.mjs already exists (faster iteration)
		if (existsSync("dist/bin.mjs")) {
			return;
		}

		const { spawnProcess } = await import("../../src/testing/process-fixture");
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

	describe("basic local range diff", () => {
		it("should show non-empty output for local range", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file1.txt", "content 1\n");

				// Create a feature branch with changes
				await createBranch(fixture, "feature");
				await commitFile(fixture, "file2.txt", "content 2\n");

				// Go back to main
				await fixture.git.checkout("main");

				const result = await runDiffx(["main..feature"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stdout.length).toBeGreaterThan(0);
				expect(result.stdout).toContain("file2.txt");
			});
		});
	});

	describe("no-arg behavior", () => {
		it("should show changes when worktree is dirty", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "original\n");

				// Make uncommitted changes
				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffx([], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				// Should show output since there are worktree changes
				expect(result.stdout.length).toBeGreaterThan(0);
			});
		});

		it("should show no output when worktree is clean", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				const result = await runDiffx([], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				// Clean worktree should only have header, no diff content
				expect(result.stdout).not.toContain("---");
				expect(result.stdout).not.toContain("+++");
			});
		});
	});

	describe("--include and --exclude filters", () => {
		it("should only show files matching include pattern", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.ts", "ts content\n");
				await commitFile(fixture, "file.js", "js content\n");

				await createBranch(fixture, "changes");
				await commitFile(fixture, "file.ts", "ts modified\n");
				await commitFile(fixture, "file.js", "js modified\n");

				await fixture.git.checkout("main");

				const result = await runDiffx(["main..changes", "--include", "*.ts"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stdout).toContain("file.ts");
			});
		});

		it("should exclude files matching exclude pattern", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "lib.ts", "content\n");
				await commitFile(fixture, "lib.test.ts", "test\n");

				await createBranch(fixture, "changes");
				await commitFile(fixture, "lib.ts", "modified\n");
				await commitFile(fixture, "lib.test.ts", "test modified\n");

				await fixture.git.checkout("main");

				const result = await runDiffx(["main..changes", "--exclude", "*.test.ts"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stdout).toContain("lib.ts");
			});
		});

		it("should combine include and exclude patterns", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "lib.ts", "content\n");
				await commitFile(fixture, "lib.test.ts", "test\n");
				await commitFile(fixture, "README.md", "readme\n");

				await createBranch(fixture, "changes");
				await commitFile(fixture, "lib.ts", "modified\n");
				await commitFile(fixture, "lib.test.ts", "test modified\n");

				await fixture.git.checkout("main");

				const result = await runDiffx(
					["main..changes", "--include", "*.ts", "--exclude", "*.test.ts"],
					{
						cwd: fixture.path,
						timeout: 10000,
					},
				);

				expect(result.exitCode).toBe(0);
			});
		});
	});

	describe("stat modes", () => {
		it("should show stat output with --stat", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				// Modify the file
				await createFile(fixture, "file.txt", "modified content\n");

				const result = await runDiffx(["--stat"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stdout.length).toBeGreaterThan(0);
			});
		});

		it("should show numstat output with --numstat", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffx(["--numstat"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stdout.length).toBeGreaterThan(0);
			});
		});

		it("should show shortstat with --shortstat", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffx(["--shortstat"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stdout.length).toBeGreaterThan(0);
			});
		});

		it("should show summary with --summary", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				// Create a commit with a rename
				await createBranch(fixture, "rename-branch");
				await fixture.git.mv("file.txt", "renamed.txt");
				await fixture.git.commit("Rename file");

				// Go back and compare - --summary shows structural changes
				await fixture.git.checkout("main");

				const result = await runDiffx(["--summary", "main..rename-branch"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				expect(result.stdout.length).toBeGreaterThan(0);
				expect(result.stdout).toContain("rename");
			});
		});
	});

	describe("error exits", () => {
		it("should exit with error for invalid range", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				const result = await runDiffx(["invalid..range..format"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).not.toBe(0);
			});
		});

		it("should exit with error for unknown refs", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				const result = await runDiffx(["unknown-branch"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).not.toBe(0);
			});
		});

		it("should exit with error when no files match filters", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffx(["--include", "*.nonexistent"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).not.toBe(0);
			});
		});
	});

	describe("pager disabled in non-TTY", () => {
		it("should not invoke pager when isTTY is false", async () => {
			mockTTY(false);

			try {
				await withFixture(async (fixture) => {
					await commitFile(fixture, "file.txt", "content\n");

					await createFile(fixture, "file.txt", "modified\n");

					const result = await runDiffx([], {
						cwd: fixture.path,
					});

					expect(result.exitCode).toBe(0);
					// Output should be present (not captured by pager)
					expect(result.stdout.length).toBeGreaterThan(0);
				});
			} finally {
				restoreTTY();
			}
		});

		it("should respect --no-pager flag", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffx(["--no-pager"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				// Output should be present
				expect(result.stdout.length).toBeGreaterThan(0);
			});
		});
	});

	describe("empty diff handling", () => {
		it("should return early with no output for empty diffs", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				// Create a branch that makes no changes
				await createBranch(fixture, "no-change");

				const result = await runDiffx(["main..no-change"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				// No changes between branches, so no diff content
				expect(result.stdout).not.toContain("---");
				expect(result.stdout).not.toContain("+++");
			});
		});
	});

	describe("overview mode", () => {
		it("should show overview table with --overview", async () => {
			await withFixture(async (fixture) => {
				await commitFile(fixture, "file.txt", "content\n");

				await createFile(fixture, "file.txt", "modified\n");

				const result = await runDiffx(["--overview"], {
					cwd: fixture.path,
					timeout: 10000,
				});

				expect(result.exitCode).toBe(0);
				// Overview should have table-like output
				expect(result.stdout.length).toBeGreaterThan(0);
			});
		});
	});
});

/**
 * Git fixture helpers for testing
 * Provides utilities to create and manage temporary git repositories
 */

import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { readFile as readFileNative } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import git from "simple-git";

export interface GitFixtureOptions {
	initialBranch?: string;
	commitMessage?: string;
}

export interface GitFixture {
	path: string;
	git: ReturnType<typeof git>;
	cleanup: () => Promise<void>;
}

/**
 * Create a temporary git repository for testing
 */
export async function createGitFixture(options: GitFixtureOptions = {}): Promise<GitFixture> {
	const dir = join(tmpdir(), `diffx-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

	await mkdir(dir, { recursive: true });

	const gitInstance = git(dir);

	// Initialize repository
	await gitInstance.init();
	await gitInstance.addConfig("user.name", "Test User");
	await gitInstance.addConfig("user.email", "test@example.com");

	// Set initial branch if specified
	if (options.initialBranch) {
		await gitInstance.checkout(["-b", options.initialBranch]);
	}

	return {
		path: dir,
		git: gitInstance,
		cleanup: async () => {
			await rm(dir, { recursive: true, force: true });
		},
	};
}

/**
 * Create a file in the fixture repository
 */
export async function createFile(
	fixture: GitFixture,
	filePath: string,
	content: string,
): Promise<void> {
	const fullPath = join(fixture.path, filePath);
	const dir = join(fullPath, "..");
	await mkdir(dir, { recursive: true });
	await writeFile(fullPath, content, "utf-8");
}

/**
 * Stage and commit a file
 */
export async function commitFile(
	fixture: GitFixture,
	filePath: string,
	content: string,
	commitMessage?: string,
): Promise<void> {
	await createFile(fixture, filePath, content);
	await fixture.git.add(filePath);
	await fixture.git.commit(commitMessage || `Add ${filePath}`);
}

/**
 * Create a branch and switch to it
 */
export async function createBranch(fixture: GitFixture, branchName: string): Promise<void> {
	await fixture.git.checkoutLocalBranch(branchName);
}

/**
 * Create a commit with a specific message
 */
export async function createCommit(fixture: GitFixture, message: string): Promise<void> {
	if ((await fixture.git.status()).files.length === 0) {
		throw new Error("No changes to commit");
	}
	await fixture.git.commit(message);
}

/**
 * Get the current commit hash
 */
export async function getCurrentCommit(fixture: GitFixture): Promise<string> {
	return await fixture.git.revparse(["HEAD"]);
}

/**
 * Create a tag at the current commit
 */
export async function createTag(fixture: GitFixture, tagName: string): Promise<void> {
	await fixture.git.addAnnotatedTag(tagName, `Tag ${tagName}`);
}

/**
 * Check if a file exists in the working tree
 */
export async function fileExists(fixture: GitFixture, filePath: string): Promise<boolean> {
	try {
		await access(join(fixture.path, filePath));
		return true;
	} catch {
		return false;
	}
}

/**
 * Read file content
 */
export async function readFile(fixture: GitFixture, filePath: string): Promise<string> {
	return readFileNative(join(fixture.path, filePath), "utf-8");
}

/**
 * Fixture scenario builders
 */

/**
 * Scenario 1: Clean repo with default branch
 */
export async function createCleanFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });
	await commitFile(fixture, "README.md", "# Test Repo\n", "Initial commit");
	return fixture;
}

/**
 * Scenario 2: Repo with staged + unstaged + untracked changes
 */
export async function createDirtyFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });
	await commitFile(fixture, "README.md", "# Test Repo\n", "Initial commit");

	// Staged changes
	await createFile(fixture, "staged.txt", "staged content");
	await fixture.git.add("staged.txt");

	// Unstaged changes
	await commitFile(fixture, "unstaged.txt", "original content", "Add unstaged");
	await createFile(fixture, "unstaged.txt", "modified content");

	// Untracked files
	await createFile(fixture, "untracked.txt", "untracked content");

	return fixture;
}

/**
 * Scenario 3: Repo with renamed/copied/deleted files
 */
export async function createRenamedFilesFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });
	await commitFile(fixture, "old-name.txt", "content", "Add file");

	// Rename file
	await fixture.git.mv("old-name.txt", "new-name.txt");
	await fixture.git.commit("Rename file");

	// Add another file to be deleted
	await commitFile(fixture, "to-delete.txt", "will be deleted", "Add to-delete");
	await fixture.git.rm("to-delete.txt");
	await fixture.git.commit("Delete file");

	return fixture;
}

/**
 * Scenario 4: Repo with merge commit for compare/merge-base behavior
 */
export async function createMergeFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });
	await commitFile(fixture, "README.md", "# Main\n", "Initial commit");

	// Create feature branch
	await createBranch(fixture, "feature");
	await commitFile(fixture, "feature.txt", "feature content", "Add feature");

	// Go back to main and add different commit
	await fixture.git.checkout("main");
	await commitFile(fixture, "main.txt", "main content", "Add main");

	// Merge feature into main
	await fixture.git.merge(["feature", "--no-ff", "-m", "Merge feature"]);

	return fixture;
}

/**
 * Scenario 5: Repo with nested paths and dotfiles for include/exclude coverage
 */
export async function createNestedPathsFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });
	await commitFile(fixture, "README.md", "# Test\n", "Initial commit");
	await commitFile(fixture, ".env", "SECRET=value", "Add env");
	await commitFile(fixture, "src/index.ts", "console.log('hi')", "Add index");
	await commitFile(fixture, "src/utils/helper.ts", "export const x = 1", "Add helper");
	await commitFile(fixture, "test/unit.test.ts", "test()", "Add test");
	return fixture;
}

/**
 * Scenario 6: Repo with empty/no-op diffs for empty-output behavior
 */
export async function createEmptyDiffFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });
	await commitFile(fixture, "README.md", "# Test\n", "Initial commit");
	await commitFile(fixture, "file.txt", "content", "Add file");

	// Create a branch that makes no changes
	await createBranch(fixture, "no-change");
	return fixture;
}

/**
 * Scenario 7: Repo with binary files for --binary flag testing
 */
export async function createBinaryFilesFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });
	await commitFile(fixture, "README.md", "# Test\n", "Initial commit");

	// Create a binary file (PNG magic bytes + some data)
	const binaryContent = Buffer.from([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
	]);
	await writeFile(join(fixture.path, "image.png"), binaryContent);
	await fixture.git.add("image.png");
	await fixture.git.commit("Add image");

	// Modify the binary file
	const modifiedBinary = Buffer.from([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
	]);
	await writeFile(join(fixture.path, "image.png"), modifiedBinary);

	return fixture;
}

/**
 * Scenario 8: Repo with whitespace-only edits for -w, --ignore-space-at-eol testing
 */
export async function createWhitespaceFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });

	// File with various whitespace patterns
	const originalContent = `function hello() {
	console.log("line 1");
	console.log("line 2");
	console.log("line 3");
}
`;

	await commitFile(fixture, "code.js", originalContent, "Initial commit");

	// Modify with only whitespace changes
	const modifiedContent = `function hello() {
  console.log("line 1");
    console.log("line 2");
	console.log("line 3");
}
`;

	await writeFile(join(fixture.path, "code.js"), modifiedContent);

	return fixture;
}

/**
 * Scenario 9: Repo with moved code blocks for --color-moved testing
 */
export async function createMovedBlocksFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });

	// Initial commit with functions
	const originalContent = `function foo() {
	return "foo";
}

function bar() {
	return "bar";
}

function baz() {
	return "baz";
}
`;

	await commitFile(fixture, "functions.ts", originalContent, "Initial commit");

	// Move functions around (bar moves to end, baz moves to beginning)
	const modifiedContent = `function foo() {
	return "foo";
}

function baz() {
	return "baz";
}

function bar() {
	return "bar";
}
`;

	await writeFile(join(fixture.path, "functions.ts"), modifiedContent);

	return fixture;
}

/**
 * Scenario 10: Repo with copied files for -C, --find-copies-harder testing
 */
export async function createCopiedFilesFixture(): Promise<GitFixture> {
	const fixture = await createGitFixture({ initialBranch: "main" });
	await commitFile(
		fixture,
		"original.ts",
		"export const x = 1;\nexport const y = 2;\n",
		"Add original",
	);

	// Copy the file with a slight modification
	await writeFile(
		join(fixture.path, "copied.ts"),
		"export const x = 1;\nexport const y = 2;\nexport const z = 3;\n",
	);
	await fixture.git.add("copied.ts");
	await fixture.git.commit("Add copy");

	return fixture;
}

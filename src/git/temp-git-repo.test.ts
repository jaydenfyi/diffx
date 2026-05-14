import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { createTemporaryGitClient } from "./temp-git-repo";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { GitClient } from "./git-client";

vi.mock("node:fs/promises", () => ({
	mkdtemp: vi.fn(),
	mkdir: vi.fn(),
	rm: vi.fn(),
}));

vi.mock("node:os", () => ({
	tmpdir: vi.fn(),
}));

const gitClientMocks = vi.hoisted(() => ({
	initBare: vi.fn(),
}));

vi.mock("./git-client", () => ({
	GitClient: vi.fn(function GitClient() {
		return gitClientMocks;
	}),
}));

describe("createTemporaryGitClient", () => {
	const originalDiffxTmpdir = process.env.DIFFX_TMPDIR;
	const mockMkdtemp = mockedFn(mkdtemp);
	const mockMkdir = mockedFn(mkdir);
	const mockRm = mockedFn(rm);
	const mockTmpdir = mockedFn(tmpdir);
	const mockGitClient = mockedFn(GitClient);
	const mockInitBare = mockedFn(gitClientMocks.initBare);

	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.DIFFX_TMPDIR;
		mockTmpdir.mockReturnValue("/tmp");
		mockMkdir.mockResolvedValue(undefined);
		mockMkdtemp.mockResolvedValue("/tmp/diffx-abc");
		mockRm.mockResolvedValue(undefined);
		mockInitBare.mockResolvedValue(undefined);
	});

	afterEach(() => {
		if (originalDiffxTmpdir === undefined) {
			delete process.env.DIFFX_TMPDIR;
		} else {
			process.env.DIFFX_TMPDIR = originalDiffxTmpdir;
		}
	});

	it("creates a bare repository under the OS temp directory by default", async () => {
		const result = await createTemporaryGitClient();

		expect(mockMkdir).toHaveBeenCalledWith("/tmp", { recursive: true });
		expect(mockMkdtemp).toHaveBeenCalledWith("/tmp/diffx-");
		expect(mockGitClient).toHaveBeenCalledWith("/tmp/diffx-abc");
		expect(mockInitBare).toHaveBeenCalled();
		expect(result.gitClient).toBe(gitClientMocks);
	});

	it("uses DIFFX_TMPDIR as the temp root when provided", async () => {
		process.env.DIFFX_TMPDIR = "/workspace/.diffx-tmp";
		mockMkdtemp.mockResolvedValue("/workspace/.diffx-tmp/diffx-abc");

		await createTemporaryGitClient();

		expect(mockMkdir).toHaveBeenCalledWith("/workspace/.diffx-tmp", { recursive: true });
		expect(mockMkdtemp).toHaveBeenCalledWith("/workspace/.diffx-tmp/diffx-");
		expect(mockGitClient).toHaveBeenCalledWith("/workspace/.diffx-tmp/diffx-abc");
	});

	it("removes the temporary repo during cleanup", async () => {
		const result = await createTemporaryGitClient();

		await result.cleanup();

		expect(mockRm).toHaveBeenCalledWith("/tmp/diffx-abc", { recursive: true, force: true });
	});

	it("removes the temporary repo when bare init fails", async () => {
		mockInitBare.mockRejectedValue(new Error("init failed"));

		await expect(createTemporaryGitClient()).rejects.toThrow("init failed");

		expect(mockRm).toHaveBeenCalledWith("/tmp/diffx-abc", { recursive: true, force: true });
	});
});

/**
 * Tests for pager utilities
 *
 * Note: Due to vitest ES module limitations, these tests use spies on the real gitClient
 * instead of mocking the module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shouldUsePager, pageOutput } from "./pager";
import { gitClient } from "../git/git-client";

// Mock spawn
const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
	spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// Helper to create a mock child process that exits successfully
function createMockChildProcess() {
	const mockOn = vi.fn((event: string, callback: () => void) => {
		if (event === "exit") {
			// Simulate successful exit asynchronously
			setTimeout(() => callback(), 0);
		}
	});
	return {
		on: mockOn,
		stdin: { on: vi.fn(), write: vi.fn(), end: vi.fn() },
		stdout: { pipe: vi.fn() },
	};
}

// Mock process.stdout.isTTY
const mockIsTTY = vi.fn();

Object.defineProperty(process.stdout, "isTTY", {
	get: () => mockIsTTY(),
	configurable: true,
});

describe("shouldUsePager", () => {
	let getConfigValueSpy: ReturnType<typeof vi.spyOn>;
	let originalPager: string | undefined;
	let originalGitPager: string | undefined;

	beforeEach(() => {
		// Save and clear environment variables
		originalPager = process.env.PAGER;
		originalGitPager = process.env.GIT_PAGER;
		delete process.env.PAGER;
		delete process.env.GIT_PAGER;

		getConfigValueSpy = vi.spyOn(gitClient, "getConfigValue").mockResolvedValue(null);
	});

	afterEach(() => {
		// Restore environment variables
		if (originalPager !== undefined) {
			process.env.PAGER = originalPager;
		} else {
			delete process.env.PAGER;
		}
		if (originalGitPager !== undefined) {
			process.env.GIT_PAGER = originalGitPager;
		} else {
			delete process.env.GIT_PAGER;
		}

		getConfigValueSpy.mockRestore();
	});

	describe("force mode", () => {
		it("should return true when force is true", () => {
			mockIsTTY.mockReturnValue(false);

			const result = shouldUsePager({ force: true });

			expect(result).toBe(true);
		});

		it("should return true when force is true regardless of TTY", () => {
			mockIsTTY.mockReturnValue(false);

			const result = shouldUsePager({ force: true });

			expect(result).toBe(true);
		});

		it("should return false when force is false and not TTY", () => {
			mockIsTTY.mockReturnValue(false);

			const result = shouldUsePager({ force: false });

			expect(result).toBe(false);
		});
	});

	describe("TTY detection", () => {
		it("should return true when TTY and pager configured", async () => {
			mockIsTTY.mockReturnValue(true);
			getConfigValueSpy.mockResolvedValue("less");

			const result = await shouldUsePager({});

			expect(result).toBe(true);
		});

		it("should return false when not TTY", async () => {
			mockIsTTY.mockReturnValue(false);
			getConfigValueSpy.mockResolvedValue("less");

			const result = await shouldUsePager({});

			expect(result).toBe(false);
		});

		it("should return false when TTY but no pager configured", async () => {
			mockIsTTY.mockReturnValue(true);
			getConfigValueSpy.mockResolvedValue(null);

			const result = await shouldUsePager({});

			expect(result).toBe(false);
		});

		it("should return false when TTY but pager is empty string", async () => {
			mockIsTTY.mockReturnValue(true);
			getConfigValueSpy.mockResolvedValue("");

			const result = await shouldUsePager({});

			expect(result).toBe(false);
		});

		it("should return false when TTY but pager is 'false'", async () => {
			mockIsTTY.mockReturnValue(true);
			getConfigValueSpy.mockResolvedValue("false");

			const result = await shouldUsePager({});

			expect(result).toBe(false);
		});
	});

	describe("pager configuration priority", () => {
		it("should use explicit pager option over config", async () => {
			mockIsTTY.mockReturnValue(true);
			getConfigValueSpy.mockResolvedValue("more");

			const result = await shouldUsePager({ pager: "less" });

			expect(result).toBe(true);
		});

		it("should return false when pager option is 'false'", async () => {
			mockIsTTY.mockReturnValue(true);
			getConfigValueSpy.mockResolvedValue("more");

			const result = await shouldUsePager({ pager: "false" });

			expect(result).toBe(false);
		});
	});
});

describe("pageOutput", () => {
	let getConfigValueSpy: ReturnType<typeof vi.spyOn>;
	let originalPager: string | undefined;
	let originalGitPager: string | undefined;

	beforeEach(() => {
		// Save and clear environment variables
		originalPager = process.env.PAGER;
		originalGitPager = process.env.GIT_PAGER;
		delete process.env.PAGER;
		delete process.env.GIT_PAGER;

		getConfigValueSpy = vi.spyOn(gitClient, "getConfigValue").mockResolvedValue(null);
		mockIsTTY.mockReturnValue(true);
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Restore environment variables
		if (originalPager !== undefined) {
			process.env.PAGER = originalPager;
		} else {
			delete process.env.PAGER;
		}
		if (originalGitPager !== undefined) {
			process.env.GIT_PAGER = originalGitPager;
		} else {
			delete process.env.GIT_PAGER;
		}

		getConfigValueSpy.mockRestore();
	});

	it("should spawn pager when configured for TTY", async () => {
		getConfigValueSpy.mockResolvedValue("less");
		mockSpawn.mockReturnValue(createMockChildProcess());

		await pageOutput("test output", {});

		expect(mockSpawn).toHaveBeenCalledWith("less", ["-R"], expect.any(Object));
		// Verify LESS env var is set correctly
		const callArgs = mockSpawn.mock.calls[0];
		expect(callArgs[2].env.LESS).toBe("FRX");
	});

	it("should return false when not using pager (no TTY)", async () => {
		mockIsTTY.mockReturnValue(false);

		const result = await pageOutput("test output", {});

		expect(result).toBe(false);
		expect(mockSpawn).not.toHaveBeenCalled();
	});

	it("should use custom pager when specified", async () => {
		mockSpawn.mockReturnValue(createMockChildProcess());

		await pageOutput("test output", { pager: "more" });

		expect(mockSpawn).toHaveBeenCalledWith("more", [], expect.any(Object));
		// Verify LESS env var is undefined for non-less pagers
		const callArgs = mockSpawn.mock.calls[0];
		expect(callArgs[2].env.LESS).toBeUndefined();
	});

	it("should spawn less with -FRX flags", async () => {
		getConfigValueSpy.mockResolvedValue("less");
		mockSpawn.mockReturnValue(createMockChildProcess());

		await pageOutput("test output", {});

		expect(mockSpawn).toHaveBeenCalledWith("less", ["-R"], expect.any(Object));
		// Verify LESS env var is set to FRX
		const callArgs = mockSpawn.mock.calls[0];
		expect(callArgs[2].env.LESS).toBe("FRX");
	});

	it("should handle pager exit gracefully", async () => {
		getConfigValueSpy.mockResolvedValue("less");
		const mockOn = vi.fn();
		const mockStdin = { on: vi.fn() };
		mockSpawn.mockReturnValue({
			on: mockOn,
			stdin: mockStdin,
			stdout: { pipe: vi.fn() },
		});

		// Simulate pager exit
		mockOn.mockImplementation((event: string, callback: () => void) => {
			if (event === "exit") {
				callback();
			}
		});

		await pageOutput("test output", {});

		expect(mockOn).toHaveBeenCalledWith("exit", expect.any(Function));
	});

	it("should return true when pager was used", async () => {
		getConfigValueSpy.mockResolvedValue("less");
		mockSpawn.mockReturnValue(createMockChildProcess());

		const result = await pageOutput("test output", {});

		expect(result).toBe(true);
	});

	it("should return false when pager was not used", async () => {
		mockIsTTY.mockReturnValue(false);

		const result = await pageOutput("test output", {});

		expect(result).toBe(false);
	});

	it("should handle pager error and return false", async () => {
		getConfigValueSpy.mockResolvedValue("less");
		mockSpawn.mockImplementation(() => {
			throw new Error("Pager spawn failed");
		});

		const result = await pageOutput("test output", {});

		expect(result).toBe(false);
	});

	it("should handle pager non-zero exit code and return false", async () => {
		getConfigValueSpy.mockResolvedValue("less");
		const mockOn = vi.fn();
		const mockStdin = { on: vi.fn() };
		mockSpawn.mockReturnValue({
			on: mockOn,
			stdin: mockStdin,
			stdout: { pipe: vi.fn() },
		});

		// Simulate pager exiting with code 1
		mockOn.mockImplementation((event: string, callback: (code?: number) => void) => {
			if (event === "exit") {
				callback(1);
			}
		});

		const result = await pageOutput("test output", {});

		expect(result).toBe(false);
	});

	it("should ignore EPIPE from pager stdin when pager exits early", async () => {
		getConfigValueSpy.mockResolvedValue("less");

		const mockStdin = {
			on: vi.fn((event: string, callback: (...args: any[]) => void) => {
				if (event === "error") {
					setTimeout(() => callback({ code: "EPIPE" }), 0);
				}
			}),
			write: vi.fn(),
			end: vi.fn(),
		};
		mockSpawn.mockReturnValue({
			on: vi.fn((event: string, callback: (...args: any[]) => void) => {
				if (event === "exit") {
					setTimeout(() => callback(0), 0);
				}
			}),
			stdin: mockStdin,
			stdout: { pipe: vi.fn() },
		});

		const result = await pageOutput("test output", {});
		expect(result).toBe(true);
	});

	it("should handle invalid pager command gracefully", async () => {
		mockIsTTY.mockReturnValue(true);
		getConfigValueSpy.mockResolvedValue("less");

		// Use an invalid pager command that can't be parsed
		const result = await pageOutput("test output", { pager: "unterminated'quote" });

		// Should fall back to not using pager and return false
		expect(result).toBe(false);
	});
});

/**
 * Process fixture helpers for testing
 * Provides utilities for testing CLI command execution
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

export interface ProcessResult {
	exitCode: number | null;
	stdout: string;
	stderr: string;
}

export interface SpawnOptions {
	cwd?: string;
	env?: Record<string, string>;
	timeout?: number;
}

/**
 * Spawn a process and capture its output
 */
export async function spawnProcess(
	command: string,
	args: string[],
	options: SpawnOptions = {},
): Promise<ProcessResult> {
	return new Promise((resolve, reject) => {
		let stdout = "";
		let stderr = "";
		let killed = false;

		const proc = spawn(command, args, {
			cwd: options.cwd,
			env: { ...process.env, ...options.env },
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Set timeout if specified
		if (options.timeout) {
			const timeout = setTimeout(() => {
				killed = true;
				proc.kill("SIGKILL");
			}, options.timeout);
			timeout.unref();
		}

		proc.stdout?.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr?.on("data", (data) => {
			stderr += data.toString();
		});

		proc.on("error", (error) => {
			if (killed) {
				resolve({
					exitCode: -1,
					stdout,
					stderr,
				});
				return;
			}
			reject(error);
		});

		proc.on("close", (code) => {
			resolve({
				exitCode: code,
				stdout,
				stderr,
			});
		});
	});
}

/**
 * Run the diffx CLI with arguments
 * Uses the built CLI directly from dist/bin.mjs
 */
export async function runDiffx(args: string[], options: SpawnOptions = {}): Promise<ProcessResult> {
	const distPath = join(process.cwd(), "dist", "bin.mjs");
	return spawnProcess("node", [distPath, ...args], options);
}

/**
 * Mock process.stdout.isTTY for testing
 */
export function mockTTY(isTTY: boolean): void {
	Object.defineProperty(process.stdout, "isTTY", {
		value: isTTY,
		writable: true,
	});
}

/**
 * Restore original process.stdout.isTTY
 */
export function restoreTTY(): void {
	Object.defineProperty(process.stdout, "isTTY", {
		value: undefined,
		writable: true,
	});
}

/**
 * Create a mock environment for testing
 */
export interface MockEnv {
	set: (key: string, value: string) => void;
	get: (key: string) => string | undefined;
	unset: (key: string) => void;
	restoreAll: () => void;
}

export function createMockEnv(): MockEnv {
	const originalEnv = { ...process.env };
	const set = (key: string, value: string): void => {
		process.env[key] = value;
	};
	const get = (key: string): string | undefined => {
		return process.env[key];
	};
	const unset = (key: string): void => {
		delete process.env[key];
	};
	const restoreAll = (): void => {
		Object.assign(process.env, originalEnv);
	};

	return { set, get, unset, restoreAll };
}

/**
 * Capture console output during a function execution
 */
export async function captureConsole(
	fn: () => Promise<void> | void,
): Promise<{ logs: string[]; errors: string[] }> {
	const logs: string[] = [];
	const errors: string[] = [];

	const originalLog = console.log;
	const originalError = console.error;

	console.log = (...args: unknown[]) => {
		logs.push(args.map((arg) => String(arg)).join(" "));
	};
	console.error = (...args: unknown[]) => {
		errors.push(args.map((arg) => String(arg)).join(" "));
	};

	try {
		await fn();
	} finally {
		console.log = originalLog;
		console.error = originalError;
	}

	return { logs, errors };
}

/**
 * Parity test result
 */
export interface ParityTestResult {
	diffxResult: ProcessResult;
	gitResult: ProcessResult;
	stdoutMatches: boolean;
	stderrMatches: boolean;
	exitCodeMatches: boolean;
}

/**
 * Normalize line endings for cross-platform comparison
 */
export function normalizeLineEndings(str: string): string {
	return str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Run diffx and git diff with the same args and compare results
 * This is the main parity test helper for git diff compatibility
 */
export async function runDiffxVsGitDiff(
	args: string[],
	options: SpawnOptions = {},
): Promise<ParityTestResult> {
	// Run diffx
	const diffxResult = await runDiffx(args, options);

	// Run git diff with the same args (but remove diffx-specific flags)
	// Filter out diffx-owned flags that git doesn't understand
	const diffxOwnedFlags = [
		"--mode",
		"--include",
		"--exclude",
		"--pager",
		"--no-pager",
		"--overview",
	];
	const filteredArgs = args.filter((arg) => {
		// Remove flag and its value if it's a diffx-owned flag
		if (diffxOwnedFlags.includes(arg)) return false;
		// Remove the value for diffx-owned flags (next arg if current is owned flag)
		const prevArg = args[args.indexOf(arg) - 1];
		if (prevArg && diffxOwnedFlags.includes(prevArg)) return false;
		return true;
	});

	const gitResult = await spawnProcess("git", ["diff", ...filteredArgs], options);

	// Strip diffx header if present for accurate comparison
	const diffxStdout = stripDiffxHeader(diffxResult.stdout);

	// Compare results
	const stdoutMatches =
		normalizeLineEndings(diffxStdout) === normalizeLineEndings(gitResult.stdout);
	const stderrMatches =
		normalizeLineEndings(diffxResult.stderr) === normalizeLineEndings(gitResult.stderr);
	const exitCodeMatches = diffxResult.exitCode === gitResult.exitCode;

	return {
		diffxResult: { ...diffxResult, stdout: diffxStdout },
		gitResult,
		stdoutMatches,
		stderrMatches,
		exitCodeMatches,
	};
}

/**
 * Strip the diffx header from output if present
 * The header format is: "diffx (diffx v0.1.0)\n\n"
 */
function stripDiffxHeader(output: string): string {
	const headerMatch = output.match(/^diffx \([^)]+\)\n\n/);
	if (headerMatch) {
		return output.slice(headerMatch[0].length);
	}
	return output;
}

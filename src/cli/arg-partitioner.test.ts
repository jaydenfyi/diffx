/**
 * Tests for argument partitioning
 */

import { describe, it, expect } from "vitest";
import {
	partitionArgs,
	validateOverviewMutualExclusivity,
	isGitOutputFormatFlag,
} from "./arg-partitioner";

describe("partitionArgs", () => {
	it("should extract positional from tokens when not found in argv", () => {
		const argv = ["--stat"];
		const tokens = [
			{ kind: "option", name: "stat", rawName: "--stat" },
			{ kind: "positional", value: "main..feature" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.inputRange).toBe("main..feature");
	});

	it("should handle empty positional values", () => {
		const argv = ["--stat"];
		const tokens = [
			{ kind: "option", name: "stat", rawName: "--stat" },
			{ kind: "positional", value: "" },
			{ kind: "positional", value: "main..feature" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.inputRange).toBe("main..feature");
	});

	it("should ignore positionals with only whitespace", () => {
		const argv = ["--stat"];
		const tokens = [
			{ kind: "option", name: "stat", rawName: "--stat" },
			{ kind: "positional", value: "   " },
			{ kind: "positional", value: "main..feature" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.inputRange).toBe("main..feature");
	});

	it("should prefer range from argv over tokens", () => {
		const argv = ["github:owner/repo#123"];
		const tokens = [{ kind: "positional", value: "main..feature" }];

		const result = partitionArgs(argv, tokens);

		expect(result.inputRange).toBe("github:owner/repo#123");
	});

	it("should handle pathspecs after -- separator", () => {
		const argv = ["--stat", "--", "src/*.ts", "src/**/*.tsx"];
		const tokens: { kind: string; name?: string; rawName?: string; value?: string }[] = [];

		const result = partitionArgs(argv, tokens);

		expect(result.pathspecs).toEqual(["src/*.ts", "src/**/*.tsx"]);
		expect(result.gitArgs).toEqual(["--stat"]);
	});

	it("should treat flag value in next arg correctly", () => {
		const argv = ["--mode", "patch", "--stat"];
		const tokens = [
			{ kind: "option", name: "mode", rawName: "--mode" },
			{ kind: "option", name: "stat", rawName: "--stat" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.diffxFlags.get("--mode")).toBe("patch");
		expect(result.gitArgs).toEqual(["--stat"]);
	});

	it("should treat flag=value format correctly", () => {
		const argv = ["--mode=patch", "--stat"];
		const tokens = [
			{ kind: "option", name: "mode", rawName: "--mode" },
			{ kind: "option", name: "stat", rawName: "--stat" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.diffxFlags.get("--mode")).toBe("patch");
		expect(result.gitArgs).toEqual(["--stat"]);
	});

	it("should handle boolean flag without value", () => {
		const argv = ["--include", "*.ts", "--stat"];
		const tokens = [
			{ kind: "option", name: "include", rawName: "--include" },
			{ kind: "option", name: "stat", rawName: "--stat" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.diffxFlags.get("--include")).toBe("*.ts");
	});

	it("should treat --index as a diffx-owned flag", () => {
		const argv = ["--index", "--stat"];
		const tokens = [
			{ kind: "option", name: "index", rawName: "--index" },
			{ kind: "option", name: "stat", rawName: "--stat" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.diffxFlags.get("--index")).toBe(true);
		expect(result.gitArgs).toEqual(["--stat"]);
	});

	it("should treat -i and -e as diffx-owned filter flags", () => {
		const argv = ["-i", "*.ts", "-e", "*.test.ts", "--stat"];
		const tokens = [
			{ kind: "option", name: "include", rawName: "-i" },
			{ kind: "option", name: "exclude", rawName: "-e" },
			{ kind: "option", name: "stat", rawName: "--stat" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.diffxFlags.get("--include")).toBe("*.ts");
		expect(result.diffxFlags.get("--exclude")).toBe("*.test.ts");
		expect(result.gitArgs).toEqual(["--stat"]);
	});

	it("should collect repeated include flags into an array", () => {
		const argv = ["--include", "*.ts", "--include=*.tsx"];
		const tokens = [
			{ kind: "option", name: "include", rawName: "--include" },
			{ kind: "option", name: "include", rawName: "--include" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.diffxFlags.get("--include")).toEqual(["*.ts", "*.tsx"]);
	});

	it("should collect repeated exclude short flags into an array", () => {
		const argv = ["-e*.js", "-e", "*.jsx"];
		const tokens = [
			{ kind: "option", name: "exclude", rawName: "-e" },
			{ kind: "option", name: "exclude", rawName: "-e" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.diffxFlags.get("--exclude")).toEqual(["*.js", "*.jsx"]);
	});

	it("should not infer non-range positionals from tokens as inputRange", () => {
		const argv = ["--stat"];
		const tokens = [
			{ kind: "option", name: "stat", rawName: "--stat" },
			{ kind: "positional", value: "HEAD~1" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.inputRange).toBeUndefined();
	});

	it("should not treat --word-diff-regex value containing .. as inputRange", () => {
		const argv = ["--word-diff-regex", "foo..bar", "--stat"];
		const tokens = [
			{ kind: "option", name: "word-diff-regex", rawName: "--word-diff-regex" },
			{ kind: "positional", value: "foo..bar" },
			{ kind: "option", name: "stat", rawName: "--stat" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.inputRange).toBeUndefined();
		expect(result.gitArgs).toEqual(["--word-diff-regex", "foo..bar", "--stat"]);
	});

	it("should still detect a real range when git flags with values are also present", () => {
		const argv = ["main..feature", "--word-diff-regex", "foo..bar"];
		const tokens = [
			{ kind: "positional", value: "main..feature" },
			{ kind: "option", name: "word-diff-regex", rawName: "--word-diff-regex" },
		];

		const result = partitionArgs(argv, tokens);

		expect(result.inputRange).toBe("main..feature");
		expect(result.gitArgs).toEqual(["--word-diff-regex", "foo..bar"]);
	});
});

describe("validateOverviewMutualExclusivity", () => {
	it("should throw when --overview used with conflicting flag in diffxFlags", () => {
		const diffxFlags = new Map([
			["--overview", true],
			["--stat", true],
		]);
		const gitArgs: string[] = [];

		expect(() => validateOverviewMutualExclusivity(diffxFlags, gitArgs)).toThrow(
			"Cannot use --overview with git output format flags: --stat",
		);
	});

	it("should throw when --overview used with conflicting flag in gitArgs", () => {
		const diffxFlags = new Map([["--overview", true]]);
		const gitArgs = ["--numstat"];

		expect(() => validateOverviewMutualExclusivity(diffxFlags, gitArgs)).toThrow(
			"Cannot use --overview with git output format flags: --numstat",
		);
	});

	it("should throw when --overview used with multiple conflicting flags", () => {
		const diffxFlags = new Map([["--overview", true]]);
		const gitArgs = ["--stat", "--numstat"];

		expect(() => validateOverviewMutualExclusivity(diffxFlags, gitArgs)).toThrow(
			"Cannot use --overview with git output format flags: --stat, --numstat",
		);
	});

	it("should not throw when --overview used alone", () => {
		const diffxFlags = new Map([["--overview", true]]);
		const gitArgs: string[] = [];

		expect(() => validateOverviewMutualExclusivity(diffxFlags, gitArgs)).not.toThrow();
	});

	it("should not throw when --overview is false", () => {
		const diffxFlags = new Map([
			["--overview", false],
			["--stat", true],
		]);
		const gitArgs: string[] = [];

		expect(() => validateOverviewMutualExclusivity(diffxFlags, gitArgs)).not.toThrow();
	});

	it("should not throw when git flags present but --overview not set", () => {
		const diffxFlags = new Map();
		const gitArgs = ["--stat", "--numstat"];

		expect(() => validateOverviewMutualExclusivity(diffxFlags, gitArgs)).not.toThrow();
	});
});

describe("isGitOutputFormatFlag", () => {
	it("should return true for git output format flags", () => {
		expect(isGitOutputFormatFlag("--stat")).toBe(true);
		expect(isGitOutputFormatFlag("--numstat")).toBe(true);
		expect(isGitOutputFormatFlag("--name-only")).toBe(true);
		expect(isGitOutputFormatFlag("--name-status")).toBe(true);
		expect(isGitOutputFormatFlag("--raw")).toBe(true);
		expect(isGitOutputFormatFlag("-p")).toBe(true);
		expect(isGitOutputFormatFlag("--patch")).toBe(true);
		expect(isGitOutputFormatFlag("--shortstat")).toBe(true);
	});

	it("should return false for diffx flags", () => {
		expect(isGitOutputFormatFlag("--overview")).toBe(false);
		expect(isGitOutputFormatFlag("--mode")).toBe(false);
		expect(isGitOutputFormatFlag("--include")).toBe(false);
		expect(isGitOutputFormatFlag("--exclude")).toBe(false);
		expect(isGitOutputFormatFlag("--pager")).toBe(false);
	});
});

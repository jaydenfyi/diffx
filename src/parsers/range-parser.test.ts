/**
 * Tests for range parser
 */

import { describe, it, expect } from "vitest";
import { parseRangeInput } from "./range-parser";
import { DiffxError } from "../types";

describe("parseRangeInput", () => {
	// Invalid inputs
	describe("invalid inputs", () => {
		it("should throw on missing left side", () => {
			expect(() => parseRangeInput("..feature")).toThrowError(DiffxError);
		});

		it("should throw on missing right side", () => {
			expect(() => parseRangeInput("main..")).toThrowError(DiffxError);
		});

		it("should throw on empty string", () => {
			expect(() => parseRangeInput("")).toThrowError(DiffxError);
		});
	});

	// Precedence tests - ensure specific formats take precedence
	describe("precedence", () => {
		it("should parse PR range before remote range", () => {
			const result = parseRangeInput(
				"https://github.com/owner/repo/pull/123..github:owner/repo#456",
			);
			expect(result.type).toBe("pr-range");
		});

		it("should parse git URL before local refs", () => {
			const result = parseRangeInput("git@github.com:owner/repo.git@main..feature");
			expect(result.type).toBe("git-url-range");
		});

		it("should parse GitHub PR URL before remote range", () => {
			const result = parseRangeInput("https://github.com/owner/repo/pull/123");
			expect(result.type).toBe("github-url");
		});
	});
});

describe("parseGitUrlRange", () => {
	describe("short form (same URL for both refs)", () => {
		it("should parse SSH git URL", () => {
			const result = parseRangeInput("git@github.com:owner/repo.git@main..feature");
			expect(result.type).toBe("git-url-range");
			expect(result.leftGitUrl).toBe("git@github.com:owner/repo.git");
			expect(result.rightGitUrl).toBe("git@github.com:owner/repo.git");
			expect(result.left).toBe("main");
			expect(result.right).toBe("feature");
		});

		it("should parse HTTPS git URL", () => {
			const result = parseRangeInput("https://github.com/owner/repo.git@v1.0..v2.0");
			expect(result.type).toBe("git-url-range");
			expect(result.leftGitUrl).toBe("https://github.com/owner/repo.git");
			expect(result.rightGitUrl).toBe("https://github.com/owner/repo.git");
			expect(result.left).toBe("v1.0");
			expect(result.right).toBe("v2.0");
		});

		it("should parse GitLab SSH URL", () => {
			const result = parseRangeInput("git@gitlab.com:owner/repo.git@develop..main");
			expect(result.type).toBe("git-url-range");
			expect(result.leftGitUrl).toBe("git@gitlab.com:owner/repo.git");
			expect(result.rightGitUrl).toBe("git@gitlab.com:owner/repo.git");
			expect(result.left).toBe("develop");
			expect(result.right).toBe("main");
		});

		it("should parse refs with slashes", () => {
			const result = parseRangeInput(
				"git@github.com:owner/repo.git@refs/tags/v1.0..refs/tags/v2.0",
			);
			expect(result.type).toBe("git-url-range");
			expect(result.left).toBe("refs/tags/v1.0");
			expect(result.right).toBe("refs/tags/v2.0");
		});
	});

	describe("full form (different URLs for each ref)", () => {
		it("should parse full SSH URL form", () => {
			const result = parseRangeInput(
				"git@github.com:owner/repo.git@main..git@github.com:owner/repo.git@feature",
			);
			expect(result.type).toBe("git-url-range");
			expect(result.leftGitUrl).toBe("git@github.com:owner/repo.git");
			expect(result.rightGitUrl).toBe("git@github.com:owner/repo.git");
			expect(result.left).toBe("main");
			expect(result.right).toBe("feature");
		});

		it("should parse different repos", () => {
			const result = parseRangeInput(
				"git@github.com:owner/repo.git@main..git@gitlab.com:owner/fork.git@feature",
			);
			expect(result.type).toBe("git-url-range");
			expect(result.leftGitUrl).toBe("git@github.com:owner/repo.git");
			expect(result.rightGitUrl).toBe("git@gitlab.com:owner/fork.git");
			expect(result.left).toBe("main");
			expect(result.right).toBe("feature");
		});
	});

	describe("should not match non-git-URL patterns", () => {
		it("should not match owner/repo@ref format", () => {
			const result = parseRangeInput("owner/repo@main..feature");
			expect(result.type).not.toBe("git-url-range");
			// Should match as remote-range instead
			expect(result.type).toBe("remote-range");
		});

		it("should not match local refs", () => {
			const result = parseRangeInput("main..feature");
			expect(result.type).not.toBe("git-url-range");
			expect(result.type).toBe("local-range");
		});

		it("should not match refs without @ in URL", () => {
			// Input like "repo.git@main..feature" should not match
			// because "repo.git" doesn't look like a git URL
			const result = parseRangeInput("repo.git@main..feature");
			expect(result.type).not.toBe("git-url-range");
		});
	});

	describe("refs with dots and slashes", () => {
		it("should parse tag with dots", () => {
			const result = parseRangeInput("git@github.com:owner/repo.git@v1.0.0..v2.0.0");
			expect(result.type).toBe("git-url-range");
			expect(result.left).toBe("v1.0.0");
			expect(result.right).toBe("v2.0.0");
		});

		it("should parse refs with slashes", () => {
			const result = parseRangeInput(
				"git@github.com:owner/repo.git@refs/tags/v1.0..refs/tags/v2.0",
			);
			expect(result.type).toBe("git-url-range");
			expect(result.left).toBe("refs/tags/v1.0");
			expect(result.right).toBe("refs/tags/v2.0");
		});

		it("should parse release branches", () => {
			const result = parseRangeInput("git@github.com:owner/repo.git@release/1.0..release/2.0");
			expect(result.type).toBe("git-url-range");
			expect(result.left).toBe("release/1.0");
			expect(result.right).toBe("release/2.0");
		});
	});

	describe("HTTPS URLs", () => {
		it("should parse HTTPS git URL", () => {
			const result = parseRangeInput("https://github.com/owner/repo.git@v1.0..v2.0");
			expect(result.type).toBe("git-url-range");
			expect(result.leftGitUrl).toBe("https://github.com/owner/repo.git");
			expect(result.rightGitUrl).toBe("https://github.com/owner/repo.git");
			expect(result.left).toBe("v1.0");
			expect(result.right).toBe("v2.0");
		});

		it("should parse HTTPS with different repos", () => {
			const result = parseRangeInput(
				"https://github.com/owner/repo.git@main..https://gitlab.com/owner/repo.git@feature",
			);
			expect(result.type).toBe("git-url-range");
			expect(result.leftGitUrl).toBe("https://github.com/owner/repo.git");
			expect(result.rightGitUrl).toBe("https://gitlab.com/owner/repo.git");
		});
	});

	describe("remote ref ranges", () => {
		it("should parse short remote range with dotted refs", () => {
			const result = parseRangeInput("owner/repo@v1.0..v2.0");
			expect(result.type).toBe("remote-range");
			expect(result.left).toBe("owner/repo@v1.0");
			expect(result.right).toBe("owner/repo@v2.0");
			expect(result.ownerRepo).toBe("owner/repo");
		});

		it("should parse full remote range with dotted refs", () => {
			const result = parseRangeInput("owner/repo@release/1.0..owner/repo@release/2.0");
			expect(result.type).toBe("remote-range");
			expect(result.left).toBe("owner/repo@release/1.0");
			expect(result.right).toBe("owner/repo@release/2.0");
			expect(result.ownerRepo).toBe("owner/repo");
		});
	});
});

describe("local ref ranges", () => {
	describe("valid local ranges", () => {
		it("should parse simple branch refs", () => {
			const result = parseRangeInput("main..feature");
			expect(result.type).toBe("local-range");
			expect(result.left).toBe("main");
			expect(result.right).toBe("feature");
		});

		it("should parse refs with slashes", () => {
			const result = parseRangeInput("feature/branch-1..feature/branch-2");
			expect(result.type).toBe("local-range");
			expect(result.left).toBe("feature/branch-1");
			expect(result.right).toBe("feature/branch-2");
		});

		it("should parse tags", () => {
			const result = parseRangeInput("v1.0..v2.0");
			expect(result.type).toBe("local-range");
			expect(result.left).toBe("v1.0");
			expect(result.right).toBe("v2.0");
		});

		it("should parse SHAs", () => {
			const result = parseRangeInput("abc123..def456");
			expect(result.type).toBe("local-range");
			expect(result.left).toBe("abc123");
			expect(result.right).toBe("def456");
		});

		it("should parse refs with prefixes", () => {
			const result = parseRangeInput("refs/heads/main..refs/tags/v1.0");
			expect(result.type).toBe("local-range");
			expect(result.left).toBe("refs/heads/main");
			expect(result.right).toBe("refs/tags/v1.0");
		});
	});
});

describe("PR refs and URLs", () => {
	describe("PR ref format", () => {
		it("should parse github:OWNER/REPO#123 format", () => {
			const result = parseRangeInput("github:owner/repo#123");
			expect(result.type).toBe("pr-ref");
			expect(result.ownerRepo).toBe("owner/repo");
			expect(result.prNumber).toBe(123);
		});
	});

	describe("PR URL", () => {
		it("should parse GitHub PR URL", () => {
			const result = parseRangeInput("https://github.com/owner/repo/pull/123");
			expect(result.type).toBe("github-url");
			expect(result.ownerRepo).toBe("owner/repo");
			expect(result.prNumber).toBe(123);
		});

		it("should parse PR URL with trailing slash", () => {
			const result = parseRangeInput("https://github.com/owner/repo/pull/123/");
			expect(result.type).toBe("github-url");
			expect(result.ownerRepo).toBe("owner/repo");
			expect(result.prNumber).toBe(123);
		});

		it("should parse PR URL with files path", () => {
			const result = parseRangeInput("https://github.com/owner/repo/pull/123/files");
			expect(result.type).toBe("github-url");
			expect(result.ownerRepo).toBe("owner/repo");
			expect(result.prNumber).toBe(123);
		});
	});

	describe("PR range", () => {
		it("should parse PR URL range", () => {
			const result = parseRangeInput(
				"https://github.com/owner/repo/pull/123..https://github.com/owner/repo/pull/456",
			);
			expect(result.type).toBe("pr-range");
			expect(result.leftPr?.prNumber).toBe(123);
			expect(result.rightPr?.prNumber).toBe(456);
		});

		it("should parse mixed PR URL and PR ref", () => {
			const result = parseRangeInput(
				"https://github.com/owner/repo/pull/123..github:owner/repo#456",
			);
			expect(result.type).toBe("pr-range");
			expect(result.leftPr?.prNumber).toBe(123);
			expect(result.rightPr?.prNumber).toBe(456);
		});

		it("should parse PR ref range", () => {
			const result = parseRangeInput("github:owner/repo#123..github:owner/repo#456");
			expect(result.type).toBe("pr-range");
			expect(result.leftPr?.prNumber).toBe(123);
			expect(result.rightPr?.prNumber).toBe(456);
		});
	});
});

describe("github: ref format", () => {
	it("should parse github:OWNER/REPO@ref1..ref2", () => {
		const result = parseRangeInput("github:owner/repo@main..feature");
		expect(result.type).toBe("git-url-range");
		expect(result.leftGitUrl).toBe("git@github.com:owner/repo.git");
		expect(result.rightGitUrl).toBe("git@github.com:owner/repo.git");
		expect(result.left).toBe("main");
		expect(result.right).toBe("feature");
	});

	it("should parse github: refs with tags", () => {
		const result = parseRangeInput("github:owner/repo@v1.0..v2.0");
		expect(result.type).toBe("git-url-range");
		expect(result.leftGitUrl).toBe("git@github.com:owner/repo.git");
		expect(result.left).toBe("v1.0");
		expect(result.right).toBe("v2.0");
	});

	it("should parse github: refs with commits", () => {
		const result = parseRangeInput("github:owner/repo@abc123..def456");
		expect(result.type).toBe("git-url-range");
		expect(result.left).toBe("abc123");
		expect(result.right).toBe("def456");
	});

	it("should parse github: refs with slashes", () => {
		const result = parseRangeInput("github:owner/repo@feature/auth..feature/ui");
		expect(result.type).toBe("git-url-range");
		expect(result.left).toBe("feature/auth");
		expect(result.right).toBe("feature/ui");
	});

	it("should be case insensitive for github: prefix", () => {
		const result = parseRangeInput("GITHUB:owner/repo@main..feature");
		expect(result.type).toBe("git-url-range");
		expect(result.left).toBe("main");
		expect(result.right).toBe("feature");
	});
});

describe("gitlab: ref format", () => {
	it("should parse gitlab:OWNER/REPO@ref1..ref2", () => {
		const result = parseRangeInput("gitlab:owner/repo@main..feature");
		expect(result.type).toBe("git-url-range");
		expect(result.leftGitUrl).toBe("git@gitlab.com:owner/repo.git");
		expect(result.rightGitUrl).toBe("git@gitlab.com:owner/repo.git");
		expect(result.left).toBe("main");
		expect(result.right).toBe("feature");
	});

	it("should parse gitlab: refs with tags", () => {
		const result = parseRangeInput("gitlab:owner/repo@v1.0..v2.0");
		expect(result.type).toBe("git-url-range");
		expect(result.leftGitUrl).toBe("git@gitlab.com:owner/repo.git");
		expect(result.left).toBe("v1.0");
		expect(result.right).toBe("v2.0");
	});

	it("should be case insensitive for gitlab: prefix", () => {
		const result = parseRangeInput("GITLAB:owner/repo@main..feature");
		expect(result.type).toBe("git-url-range");
		expect(result.left).toBe("main");
		expect(result.right).toBe("feature");
	});
});

describe("GitLab MR ref format", () => {
	it("should parse gitlab:OWNER/REPO!123 format", () => {
		const result = parseRangeInput("gitlab:owner/repo!123");
		expect(result.type).toBe("gitlab-mr-ref");
		expect(result.ownerRepo).toBe("owner/repo");
		expect(result.prNumber).toBe(123);
	});

	it("should be case insensitive for gitlab: MR prefix", () => {
		const result = parseRangeInput("GITLAB:owner/repo!456");
		expect(result.type).toBe("gitlab-mr-ref");
		expect(result.ownerRepo).toBe("owner/repo");
		expect(result.prNumber).toBe(456);
	});
});

describe("GitHub commit URL", () => {
	it("should parse commit URL", () => {
		const result = parseRangeInput("https://github.com/owner/repo/commit/abc123");
		expect(result.type).toBe("github-commit-url");
		expect(result.ownerRepo).toBe("owner/repo");
		expect(result.commitSha).toBe("abc123");
	});

	it("should parse commit URL with full SHA", () => {
		const result = parseRangeInput(
			"https://github.com/owner/repo/commit/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
		);
		expect(result.type).toBe("github-commit-url");
		expect(result.commitSha).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");
	});

	it("should reject invalid commit URL", () => {
		expect(() => parseRangeInput("https://github.com/owner/repo/commit/invalid")).toThrowError(
			DiffxError,
		);
	});
});

describe("GitHub PR changes URL", () => {
	it("should parse PR changes URL", () => {
		const result = parseRangeInput("https://github.com/owner/repo/pull/123/changes/abc123..def456");
		expect(result.type).toBe("github-pr-changes-url");
		expect(result.ownerRepo).toBe("owner/repo");
		expect(result.prNumber).toBe(123);
		expect(result.leftCommitSha).toBe("abc123");
		expect(result.rightCommitSha).toBe("def456");
	});

	it("should parse PR URL without changes as regular PR URL", () => {
		const result = parseRangeInput("https://github.com/owner/repo/pull/123/changes");
		expect(result.type).toBe("github-url");
		expect(result.ownerRepo).toBe("owner/repo");
		expect(result.prNumber).toBe(123);
	});
});

describe("GitHub compare URL", () => {
	describe("same-repo compare", () => {
		it("should parse compare URL with simple refs", () => {
			const result = parseRangeInput("https://github.com/owner/repo/compare/main...feature");
			expect(result.type).toBe("github-compare-url");
			expect(result.ownerRepo).toBe("owner/repo");
			expect(result.leftRef).toBe("main");
			expect(result.rightRef).toBe("feature");
			expect(result.rightOwner).toBeUndefined();
			expect(result.rightRepo).toBeUndefined();
		});

		it("should parse compare URL with branches containing slashes", () => {
			const result = parseRangeInput(
				"https://github.com/owner/repo/compare/feature/old...feature/new",
			);
			expect(result.type).toBe("github-compare-url");
			expect(result.leftRef).toBe("feature/old");
			expect(result.rightRef).toBe("feature/new");
		});

		it("should parse compare URL with tags", () => {
			const result = parseRangeInput("https://github.com/owner/repo/compare/v1.0...v2.0");
			expect(result.type).toBe("github-compare-url");
			expect(result.leftRef).toBe("v1.0");
			expect(result.rightRef).toBe("v2.0");
		});
	});

	describe("cross-fork compare", () => {
		it("should parse cross-fork compare with colon format", () => {
			const result = parseRangeInput(
				"https://github.com/owner/repo/compare/main...other:repo:feature",
			);
			expect(result.type).toBe("github-compare-url");
			expect(result.ownerRepo).toBe("owner/repo");
			expect(result.leftRef).toBe("main");
			expect(result.rightRef).toBe("feature");
			expect(result.rightOwner).toBe("other");
			expect(result.rightRepo).toBe("repo");
		});

		it("should parse cross-fork compare with branch path", () => {
			const result = parseRangeInput(
				"https://github.com/owner/repo/compare/main...other:repo:feature/add-plugin",
			);
			expect(result.type).toBe("github-compare-url");
			expect(result.rightRef).toBe("feature/add-plugin");
			expect(result.rightOwner).toBe("other");
			expect(result.rightRepo).toBe("repo");
		});

		it("should parse cross-fork compare with slash format", () => {
			const result = parseRangeInput(
				"https://github.com/owner/repo/compare/main...other:repo/feature",
			);
			expect(result.type).toBe("github-compare-url");
			expect(result.rightRef).toBe("feature");
			expect(result.rightOwner).toBe("other");
			expect(result.rightRepo).toBe("repo");
		});

		it("should parse cross-fork compare with slash and branch path", () => {
			const result = parseRangeInput(
				"https://github.com/owner/repo/compare/main...other:repo/feature/branch",
			);
			expect(result.type).toBe("github-compare-url");
			expect(result.rightRef).toBe("feature/branch");
			expect(result.rightOwner).toBe("other");
			expect(result.rightRepo).toBe("repo");
		});
	});
});

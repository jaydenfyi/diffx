/**
 * Tests for git utility functions
 */

import { describe, it, expect } from "vitest";
import {
	buildGitHubUrl,
	parseOwnerRepoFromUrl,
	createRemoteName,
	isCommitHash,
	normalizeRef,
	getPRRefName,
	createTempRefPrefix,
} from "./utils";

describe("buildGitHubUrl", () => {
	it("should build GitHub HTTPS URL from owner and repo", () => {
		const result = buildGitHubUrl("owner", "repo");
		expect(result).toBe("https://github.com/owner/repo.git");
	});

	it("should handle owner with special characters", () => {
		const result = buildGitHubUrl("owner-name", "repo_name");
		expect(result).toBe("https://github.com/owner-name/repo_name.git");
	});
});

describe("parseOwnerRepoFromUrl", () => {
	describe("HTTPS URLs", () => {
		it("should parse HTTPS URL with .git suffix", () => {
			const result = parseOwnerRepoFromUrl("https://github.com/owner/repo.git");
			expect(result).toEqual({ owner: "owner", repo: "repo" });
		});

		it("should parse HTTPS URL without .git suffix", () => {
			const result = parseOwnerRepoFromUrl("https://github.com/owner/repo");
			expect(result).toEqual({ owner: "owner", repo: "repo" });
		});

		it("should parse HTTPS URL with nested path", () => {
			const result = parseOwnerRepoFromUrl("https://github.com/org-name/repo-name");
			expect(result).toEqual({ owner: "org-name", repo: "repo-name" });
		});
	});

	describe("SSH URLs", () => {
		it("should parse SSH URL with .git suffix", () => {
			const result = parseOwnerRepoFromUrl("git@github.com:owner/repo.git");
			expect(result).toEqual({ owner: "owner", repo: "repo" });
		});

		it("should parse SSH URL without .git suffix", () => {
			const result = parseOwnerRepoFromUrl("git@github.com:owner/repo");
			expect(result).toEqual({ owner: "owner", repo: "repo" });
		});
	});

	describe("invalid URLs", () => {
		it("should return null for non-GitHub URLs", () => {
			const result = parseOwnerRepoFromUrl("https://gitlab.com/owner/repo");
			expect(result).toBeNull();
		});

		it("should return null for malformed URLs", () => {
			const result = parseOwnerRepoFromUrl("not-a-url");
			expect(result).toBeNull();
		});

		it("should return null for URLs without owner/repo", () => {
			const result = parseOwnerRepoFromUrl("https://github.com");
			expect(result).toBeNull();
		});
	});
});

describe("createRemoteName", () => {
	it("should create remote name from owner and repo", () => {
		const result = createRemoteName("owner", "repo");
		expect(result).toBe("diffx-owner-repo");
	});

	it("should normalize slashes to hyphens", () => {
		const result = createRemoteName("owner/name", "repo/name");
		expect(result).toBe("diffx-owner-name-repo-name");
	});

	it("should convert to lowercase", () => {
		const result = createRemoteName("Owner", "Repo");
		expect(result).toBe("diffx-owner-repo");
	});

	it("should handle mixed separators", () => {
		const result = createRemoteName("owner_name/repo-name", "my_repo");
		// The function replaces both / and _ with -
		expect(result).toBe("diffx-owner-name-repo-name-my-repo");
	});
});

describe("isCommitHash", () => {
	describe("valid commit hashes", () => {
		it("should accept full 40-character SHA", () => {
			const hash = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
			expect(isCommitHash(hash)).toBe(true);
		});

		it("should accept abbreviated hashes (4-40 characters)", () => {
			expect(isCommitHash("abc1")).toBe(true);
			expect(isCommitHash("abc123")).toBe(true);
			expect(isCommitHash("a1b2c3d4e5f6")).toBe(true);
		});

		it("should accept uppercase hex characters", () => {
			expect(isCommitHash("ABC123")).toBe(true);
			expect(isCommitHash("A1B2C3")).toBe(true);
		});

		it("should accept mixed case hex characters", () => {
			expect(isCommitHash("AbC123")).toBe(true);
		});
	});

	describe("invalid inputs", () => {
		it("should reject hashes shorter than 4 characters", () => {
			expect(isCommitHash("abc")).toBe(false);
			expect(isCommitHash("ab")).toBe(false);
			expect(isCommitHash("a")).toBe(false);
		});

		it("should reject hashes longer than 40 characters", () => {
			const hash = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0extra";
			expect(isCommitHash(hash)).toBe(false);
		});

		it("should reject non-hex characters", () => {
			expect(isCommitHash("ghijkl")).toBe(false);
			expect(isCommitHash("abc123xyz")).toBe(false);
		});

		it("should reject non-string inputs", () => {
			expect(isCommitHash(123 as unknown as string)).toBe(false);
			expect(isCommitHash(null as unknown as string)).toBe(false);
			expect(isCommitHash(undefined as unknown as string)).toBe(false);
		});
	});
});

describe("normalizeRef", () => {
	describe("refs/heads/ prefix", () => {
		it("should remove refs/heads/ prefix", () => {
			expect(normalizeRef("refs/heads/main")).toBe("main");
		});

		it("should remove refs/heads/ from branch with slashes", () => {
			expect(normalizeRef("refs/heads/feature/branch")).toBe("feature/branch");
		});
	});

	describe("refs/tags/ prefix", () => {
		it("should remove refs/tags/ prefix", () => {
			expect(normalizeRef("refs/tags/v1.0")).toBe("v1.0");
		});

		it("should remove refs/tags/ from tag with slashes", () => {
			expect(normalizeRef("refs/tags/release/v1.0")).toBe("release/v1.0");
		});
	});

	describe("refs without subdirectory", () => {
		it("should not remove refs/ prefix without subdirectory", () => {
			expect(normalizeRef("refs/unknown/main")).toBe("refs/unknown/main");
		});
	});

	describe("refs without prefix", () => {
		it("should return ref as-is when no prefix", () => {
			expect(normalizeRef("main")).toBe("main");
			expect(normalizeRef("feature/branch")).toBe("feature/branch");
			expect(normalizeRef("v1.0")).toBe("v1.0");
		});
	});

	describe("edge cases", () => {
		it("should handle empty string", () => {
			expect(normalizeRef("")).toBe("");
		});

		it("should handle just the prefix", () => {
			expect(normalizeRef("refs/heads/")).toBe("");
			expect(normalizeRef("refs/tags/")).toBe("");
		});
	});
});

describe("getPRRefName", () => {
	it("should create PR ref from PR number", () => {
		expect(getPRRefName(123)).toBe("refs/pull/123/head");
	});

	it("should handle large PR numbers", () => {
		expect(getPRRefName(99999)).toBe("refs/pull/99999/head");
	});

	it("should handle PR number 0", () => {
		expect(getPRRefName(0)).toBe("refs/pull/0/head");
	});
});

describe("createTempRefPrefix", () => {
	it("should create unique ref prefix", () => {
		const prefix1 = createTempRefPrefix();
		const prefix2 = createTempRefPrefix();

		expect(prefix1).toMatch(/^refs\/diffx\/tmp\/[a-z0-9]+-[a-f0-9]+$/);
		expect(prefix2).toMatch(/^refs\/diffx\/tmp\/[a-z0-9]+-[a-f0-9]+$/);
		expect(prefix1).not.toBe(prefix2);
	});

	it("should use correct format with timestamp and token", () => {
		const prefix = createTempRefPrefix();
		const parts = prefix.split("/");
		expect(parts[0]).toBe("refs");
		expect(parts[1]).toBe("diffx");
		expect(parts[2]).toBe("tmp");

		const lastPart = parts[3];
		const [timestamp, token] = lastPart.split("-");

		// Verify timestamp is base36 (should only contain [a-z0-9])
		expect(timestamp).toMatch(/^[a-z0-9]+$/);

		// Verify token is hex (16 bytes = 32 hex chars)
		expect(token).toMatch(/^[a-f0-9]{16}$/i);
	});
});

import { describe, it, expect } from "vitest";
import { buildGitHubUrl, normalizeRef, createTempRefPrefix } from "./utils";

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

		expect(timestamp).toMatch(/^[a-z0-9]+$/);
		expect(token).toMatch(/^[a-f0-9]{16}$/i);
	});
});

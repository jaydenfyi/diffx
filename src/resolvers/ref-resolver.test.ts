/**
 * Tests for ref resolver dispatcher
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockedFn } from "vitest-mock-extended";
import { resolveRefs } from "./ref-resolver";
import { resolveLocalRefs } from "./local-ref-resolver";
import { resolveRemoteRefs } from "./remote-ref-resolver";
import {
	resolvePRRefs,
	resolvePRRangeRefs,
	resolveGitHubCommitRefs,
	resolveGitHubPRChangesRefs,
	resolveGitHubCompareRefs,
} from "./pr-url-resolver";
import { resolveGitUrlRefs } from "./git-url-resolver";
import { resolveGitLabMRRefs } from "./gitlab-mr-resolver";
import type { RefRange } from "../types";

// Mock all resolvers
vi.mock("./local-ref-resolver", () => ({
	resolveLocalRefs: vi.fn(),
}));

vi.mock("./remote-ref-resolver", () => ({
	resolveRemoteRefs: vi.fn(),
}));

vi.mock("./pr-url-resolver", () => ({
	resolvePRRefs: vi.fn(),
	resolvePRRangeRefs: vi.fn(),
	resolveGitHubCommitRefs: vi.fn(),
	resolveGitHubPRChangesRefs: vi.fn(),
	resolveGitHubCompareRefs: vi.fn(),
}));

vi.mock("./git-url-resolver", () => ({
	resolveGitUrlRefs: vi.fn(),
}));

vi.mock("./gitlab-mr-resolver", () => ({
	resolveGitLabMRRefs: vi.fn(),
}));

describe("resolveRefs", () => {
	const mockResolveLocalRefs = mockedFn(resolveLocalRefs);
	const mockResolveRemoteRefs = mockedFn(resolveRemoteRefs);
	const mockResolvePRRefs = mockedFn(resolvePRRefs);
	const mockResolvePRRangeRefs = mockedFn(resolvePRRangeRefs);
	const mockResolveGitUrlRefs = mockedFn(resolveGitUrlRefs);
	const mockResolveGitHubCommitRefs = mockedFn(resolveGitHubCommitRefs);
	const mockResolveGitHubPRChangesRefs = mockedFn(resolveGitHubPRChangesRefs);
	const mockResolveGitHubCompareRefs = mockedFn(resolveGitHubCompareRefs);
	const mockResolveGitLabMRRefs = mockedFn(resolveGitLabMRRefs);

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default successful return values
		mockResolveLocalRefs.mockResolvedValue({ left: "main", right: "feature" });
		mockResolveRemoteRefs.mockResolvedValue({
			left: "refs/diffx/tmp/left",
			right: "refs/diffx/tmp/right",
			cleanup: vi.fn(),
		});
		mockResolvePRRefs.mockResolvedValue({
			left: "merge^1",
			right: "merge",
			cleanup: vi.fn(),
		});
		mockResolvePRRangeRefs.mockResolvedValue({
			left: "pr1",
			right: "pr2",
			cleanup: vi.fn(),
		});
		mockResolveGitUrlRefs.mockResolvedValue({
			left: "url-left",
			right: "url-right",
			cleanup: vi.fn(),
		});
		mockResolveGitHubCommitRefs.mockResolvedValue({
			left: "commit^",
			right: "commit",
			cleanup: vi.fn(),
		});
		mockResolveGitHubPRChangesRefs.mockResolvedValue({
			left: "left-sha",
			right: "right-sha",
			cleanup: vi.fn(),
		});
		mockResolveGitHubCompareRefs.mockResolvedValue({
			left: "merge-base",
			right: "feature",
			cleanup: vi.fn(),
		});
		mockResolveGitLabMRRefs.mockResolvedValue({
			left: "mr^1",
			right: "mr",
			cleanup: vi.fn(),
		});
	});

	describe("dispatcher routing", () => {
		it("should route local-range to resolveLocalRefs", async () => {
			const range: RefRange = {
				type: "local-range",
				left: "main",
				right: "feature",
			};

			const result = await resolveRefs(range);

			expect(mockResolveLocalRefs).toHaveBeenCalledWith(range);
			expect(result).toEqual({ left: "main", right: "feature" });
		});

		it("should route remote-range to resolveRemoteRefs", async () => {
			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			const result = await resolveRefs(range);

			expect(mockResolveRemoteRefs).toHaveBeenCalledWith(range);
			expect(result.left).toBe("refs/diffx/tmp/left");
		});

		it("should route pr-ref to resolvePRRefs", async () => {
			const range: RefRange = {
				type: "pr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			};

			const result = await resolveRefs(range);

			expect(mockResolvePRRefs).toHaveBeenCalledWith(range);
			expect(result.left).toBe("merge^1");
		});

		it("should route github-url to resolvePRRefs", async () => {
			const range: RefRange = {
				type: "github-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 456,
			};

			const _result = await resolveRefs(range);

			expect(mockResolvePRRefs).toHaveBeenCalledWith(range);
		});

		it("should route pr-range to resolvePRRangeRefs", async () => {
			const range: RefRange = {
				type: "pr-range",
				left: "",
				right: "",
				leftPr: { owner: "owner", repo: "repo", prNumber: 123 },
				rightPr: { owner: "owner", repo: "repo", prNumber: 456 },
			};

			const result = await resolveRefs(range);

			expect(mockResolvePRRangeRefs).toHaveBeenCalledWith(range);
			expect(result.left).toBe("pr1");
		});

		it("should route git-url-range to resolveGitUrlRefs", async () => {
			const range: RefRange = {
				type: "git-url-range",
				left: "main",
				right: "feature",
				leftGitUrl: "git@github.com:owner/repo.git",
				rightGitUrl: "git@github.com:owner/repo.git",
			};

			const result = await resolveRefs(range);

			expect(mockResolveGitUrlRefs).toHaveBeenCalledWith(range);
			expect(result.left).toBe("url-left");
		});

		it("should route github-commit-url to resolveGitHubCommitRefs", async () => {
			const range: RefRange = {
				type: "github-commit-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				commitSha: "abc123",
			};

			const result = await resolveRefs(range);

			expect(mockResolveGitHubCommitRefs).toHaveBeenCalledWith(range);
			expect(result.left).toBe("commit^");
		});

		it("should route github-pr-changes-url to resolveGitHubPRChangesRefs", async () => {
			const range: RefRange = {
				type: "github-pr-changes-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
				leftCommitSha: "abc123",
				rightCommitSha: "def456",
			};

			const result = await resolveRefs(range);

			expect(mockResolveGitHubPRChangesRefs).toHaveBeenCalledWith(range);
			expect(result.left).toBe("left-sha");
		});

		it("should route github-compare-url to resolveGitHubCompareRefs", async () => {
			const range: RefRange = {
				type: "github-compare-url",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				leftRef: "main",
				rightRef: "feature",
			};

			const result = await resolveRefs(range);

			expect(mockResolveGitHubCompareRefs).toHaveBeenCalledWith(range);
			expect(result.left).toBe("merge-base");
		});

		it("should route gitlab-mr-ref to resolveGitLabMRRefs", async () => {
			const range: RefRange = {
				type: "gitlab-mr-ref",
				left: "",
				right: "",
				ownerRepo: "owner/repo",
				prNumber: 123,
			};

			const result = await resolveRefs(range);

			expect(mockResolveGitLabMRRefs).toHaveBeenCalledWith(range);
			expect(result.left).toBe("mr^1");
		});
	});

	describe("type safety", () => {
		it("should handle all RefType values", async () => {
			const refTypes: RefRange["type"][] = [
				"local-range",
				"remote-range",
				"pr-ref",
				"github-url",
				"pr-range",
				"git-url-range",
				"github-commit-url",
				"github-pr-changes-url",
				"github-compare-url",
				"gitlab-mr-ref",
			];

			for (const type of refTypes) {
				const range: RefRange = {
					type,
					left: "main",
					right: "feature",
				};

				// Should not throw
				const result = await resolveRefs(range);
				expect(result).toBeDefined();
			}
		});
	});

	describe("propagation of errors", () => {
		it("should propagate errors from local resolver", async () => {
			mockResolveLocalRefs.mockRejectedValue(new Error("Local error"));

			const range: RefRange = {
				type: "local-range",
				left: "main",
				right: "feature",
			};

			await expect(resolveRefs(range)).rejects.toThrow("Local error");
		});

		it("should propagate errors from remote resolver", async () => {
			mockResolveRemoteRefs.mockRejectedValue(new Error("Remote error"));

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			await expect(resolveRefs(range)).rejects.toThrow("Remote error");
		});
	});

	describe("cleanup propagation", () => {
		it("should return cleanup function from remote resolver", async () => {
			const cleanupFn = vi.fn();
			mockResolveRemoteRefs.mockResolvedValue({
				left: "refs/diffx/tmp/left",
				right: "refs/diffx/tmp/right",
				cleanup: cleanupFn,
			});

			const range: RefRange = {
				type: "remote-range",
				left: "owner/repo@main",
				right: "owner/repo@feature",
				ownerRepo: "owner/repo",
			};

			const result = await resolveRefs(range);

			expect(result.cleanup).toBeDefined();

			if (result.cleanup) {
				await result.cleanup();
				expect(cleanupFn).toHaveBeenCalled();
			}
		});

		it("should not return cleanup for local refs", async () => {
			const range: RefRange = {
				type: "local-range",
				left: "main",
				right: "feature",
			};

			const result = await resolveRefs(range);

			expect(result.cleanup).toBeUndefined();
		});
	});
});

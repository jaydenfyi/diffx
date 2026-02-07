import { describe, expect, it } from "vitest";
import { checkEmptyOutput, createNoFilesMatchedError, handleError } from "./error-handler";
import { DiffxError, ExitCode } from "../types";

describe("checkEmptyOutput", () => {
	it("returns non-empty status when output has content", () => {
		const result = checkEmptyOutput("diff --git a/file b/file", {
			hasActiveFilters: false,
			hasUnfilteredChanges: false,
		});

		expect(result).toEqual({
			isEmpty: false,
			isFilterMismatch: false,
		});
	});

	it("treats empty output with no filters as no-diff", () => {
		const result = checkEmptyOutput("", {
			hasActiveFilters: false,
			hasUnfilteredChanges: true,
		});

		expect(result).toEqual({
			isEmpty: true,
			isFilterMismatch: false,
		});
	});

	it("marks empty output as filter mismatch when unfiltered changes exist", () => {
		const result = checkEmptyOutput("", {
			hasActiveFilters: true,
			hasUnfilteredChanges: true,
		});

		expect(result).toEqual({
			isEmpty: true,
			isFilterMismatch: true,
		});
	});

	describe("whitespace-only output", () => {
		it("treats whitespace-only output as empty", () => {
			const result = checkEmptyOutput("   \n\t\n  ", {
				hasActiveFilters: false,
				hasUnfilteredChanges: true,
			});

			expect(result).toEqual({
				isEmpty: true,
				isFilterMismatch: false,
			});
		});

		it("treats whitespace-only output as filter mismatch when filters are active", () => {
			const result = checkEmptyOutput("   \n\t\n  ", {
				hasActiveFilters: true,
				hasUnfilteredChanges: true,
			});

			expect(result).toEqual({
				isEmpty: true,
				isFilterMismatch: true,
			});
		});

		it("treats newlines-only output as empty", () => {
			const result = checkEmptyOutput("\n\n\n", {
				hasActiveFilters: false,
				hasUnfilteredChanges: false,
			});

			expect(result).toEqual({
				isEmpty: true,
				isFilterMismatch: false,
			});
		});

		it("treats tabs-only output as empty", () => {
			const result = checkEmptyOutput("\t\t\t", {
				hasActiveFilters: false,
				hasUnfilteredChanges: false,
			});

			expect(result).toEqual({
				isEmpty: true,
				isFilterMismatch: false,
			});
		});
	});
});

describe("createNoFilesMatchedError", () => {
	it("creates a typed error with the expected exit code", () => {
		const error = createNoFilesMatchedError();
		expect(error.message).toBe("No files matched the specified filters");
		expect(error.exitCode).toBe(ExitCode.NO_FILES_MATCHED);
	});

	// Regression test to ensure message and exit code remain consistent
	it("maintains stable error message for user expectations", () => {
		const error = createNoFilesMatchedError();

		// Snapshot test to catch unintentional changes
		expect({
			message: error.message,
			exitCode: error.exitCode,
			exitCodeValue: ExitCode.NO_FILES_MATCHED,
		}).toMatchSnapshot();
	});
});

describe("handleError", () => {
	it("returns the same DiffxError instance", () => {
		const input = new DiffxError("bad input", ExitCode.INVALID_INPUT);
		expect(handleError(input)).toBe(input);
	});

	it("wraps a standard Error with GIT_ERROR exit code", () => {
		const normalized = handleError(new Error("boom"));
		expect(normalized).toBeInstanceOf(DiffxError);
		expect(normalized.message).toBe("boom");
		expect(normalized.exitCode).toBe(ExitCode.GIT_ERROR);
	});

	it("wraps non-Error values with GIT_ERROR exit code", () => {
		const normalized = handleError("unexpected");
		expect(normalized).toBeInstanceOf(DiffxError);
		expect(normalized.message).toBe("unexpected");
		expect(normalized.exitCode).toBe(ExitCode.GIT_ERROR);
	});
});

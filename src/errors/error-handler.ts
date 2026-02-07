/**
 * Error handler
 * Normalizes unknown errors into DiffxError instances
 */

import { DiffxError, ExitCode } from "../types";

/**
 * Normalize an unknown error into a typed DiffxError
 */
export function handleError(error: unknown): DiffxError {
	if (error instanceof DiffxError) {
		return error;
	}

	if (error instanceof Error) {
		return new DiffxError(error.message, ExitCode.GIT_ERROR);
	}

	return new DiffxError(String(error), ExitCode.GIT_ERROR);
}

type EmptyOutputCheckInput = {
	hasActiveFilters: boolean;
	hasUnfilteredChanges: boolean;
};

type EmptyOutputCheckResult = {
	isEmpty: boolean;
	isFilterMismatch: boolean;
};

/**
 * Check whether output is empty and whether that emptiness came from file filters
 */
export function checkEmptyOutput(
	output: string,
	{ hasActiveFilters, hasUnfilteredChanges }: EmptyOutputCheckInput,
): EmptyOutputCheckResult {
	const isEmpty = !output || output.trim().length === 0;
	if (!isEmpty) {
		return { isEmpty: false, isFilterMismatch: false };
	}

	return {
		isEmpty: true,
		isFilterMismatch: hasActiveFilters && hasUnfilteredChanges,
	};
}

/**
 * Create a typed no-files-matched error
 */
export function createNoFilesMatchedError(): DiffxError {
	return new DiffxError("No files matched the specified filters", ExitCode.NO_FILES_MATCHED);
}

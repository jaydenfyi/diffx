/**
 * File filter
 * Handles include/exclude patterns for filtering diff output
 */

import type { FilterOptions } from "../types";
import { minimatch } from "minimatch";

/**
 * Build file patterns array for git commands
 * Filters include patterns first, then excludes from those results
 */
export function buildFilePatterns(options: FilterOptions): string[] {
	const patterns: string[] = [];

	// If no filters specified, return empty array (include all)
	if (!options.include && !options.exclude) {
		return patterns;
	}

	// For now, we'll pass patterns directly to git
	// Git's pathspec behavior is complex, so we use a simplified approach:
	// 1. If includes specified, add them as positive patterns
	// 2. If excludes specified, add them as negative patterns

	if (options.include && options.include.length > 0) {
		patterns.push(...options.include);
	}

	if (options.exclude && options.exclude.length > 0) {
		// Add as negative patterns (prefixed with :)
		options.exclude.forEach((pattern) => {
			patterns.push(`:!${pattern}`);
		});
	}

	return patterns;
}

/**
 * Check if a file path matches the given patterns
 */
export function fileMatchesPattern(filePath: string, pattern: string): boolean {
	// Handle negative patterns
	if (pattern.startsWith(":!")) {
		const negPattern = pattern.slice(2);
		return !minimatch(filePath, negPattern, { dot: true });
	}

	return minimatch(filePath, pattern, { dot: true });
}

/**
 * Check if a file should be included based on filter options
 */
export function shouldIncludeFile(filePath: string, options: FilterOptions): boolean {
	// If no filters, include everything
	if (!options.include && !options.exclude) {
		return true;
	}

	// Check excludes first
	if (options.exclude && options.exclude.length > 0) {
		for (const pattern of options.exclude) {
			if (minimatch(filePath, pattern, { dot: true })) {
				return false;
			}
		}
	}

	// Check includes
	if (options.include && options.include.length > 0) {
		for (const pattern of options.include) {
			if (minimatch(filePath, pattern, { dot: true })) {
				return true;
			}
		}
		// If includes specified but none matched, exclude the file
		return false;
	}

	return true;
}

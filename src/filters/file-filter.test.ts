/**
 * Tests for file filter
 */

import { describe, it, expect } from "vitest";
import { buildFilePatterns, fileMatchesPattern, shouldIncludeFile } from "./file-filter";
import type { FilterOptions } from "../types";

describe("buildFilePatterns", () => {
	describe("with include only", () => {
		it("should return positive patterns", () => {
			const options: FilterOptions = {
				include: ["*.ts", "*.js"],
				exclude: [],
			};
			const result = buildFilePatterns(options);
			expect(result).toEqual(["*.ts", "*.js"]);
		});

		it("should handle single include pattern", () => {
			const options: FilterOptions = {
				include: ["src/**/*.ts"],
				exclude: [],
			};
			const result = buildFilePatterns(options);
			expect(result).toEqual(["src/**/*.ts"]);
		});
	});

	describe("with exclude only", () => {
		it("should return negative pathspecs", () => {
			const options: FilterOptions = {
				include: [],
				exclude: ["node_modules", "*.test.ts"],
			};
			const result = buildFilePatterns(options);
			expect(result).toEqual([":!node_modules", ":!*.test.ts"]);
		});
	});

	describe("with both include and exclude", () => {
		it("should return positive patterns followed by negative patterns", () => {
			const options: FilterOptions = {
				include: ["src/**/*.ts"],
				exclude: ["*.test.ts"],
			};
			const result = buildFilePatterns(options);
			expect(result).toEqual(["src/**/*.ts", ":!*.test.ts"]);
		});
	});

	describe("with no filters", () => {
		it("should return empty array", () => {
			const options: FilterOptions = {
				include: [],
				exclude: [],
			};
			const result = buildFilePatterns(options);
			expect(result).toEqual([]);
		});

		it("should return empty array when both undefined", () => {
			const options: FilterOptions = {};
			const result = buildFilePatterns(options);
			expect(result).toEqual([]);
		});
	});
});

describe("fileMatchesPattern", () => {
	describe("positive patterns", () => {
		it("should match exact filename", () => {
			expect(fileMatchesPattern("file.ts", "*.ts")).toBe(true);
		});

		it("should match glob patterns", () => {
			expect(fileMatchesPattern("src/utils/helper.ts", "src/**/*.ts")).toBe(true);
		});

		it("should not match non-matching files", () => {
			expect(fileMatchesPattern("file.js", "*.ts")).toBe(false);
		});
	});

	describe("negative patterns", () => {
		it("should handle negative pathspec prefix", () => {
			// Negative pattern means "exclude if matches"
			// But fileMatchesPattern checks if the pattern matches the file
			// A negative pattern starting with :! means the file should NOT match the inner pattern
			expect(fileMatchesPattern("file.ts", ":!*.ts")).toBe(false); // Excluded
			expect(fileMatchesPattern("file.js", ":!*.ts")).toBe(true); // Not excluded
		});

		it("should handle negative glob patterns", () => {
			expect(fileMatchesPattern("node_modules/foo.js", ":!node_modules/**")).toBe(false);
			expect(fileMatchesPattern("src/foo.js", ":!node_modules/**")).toBe(true);
		});
	});

	describe("dotfiles", () => {
		it("should match dotfiles with dot option", () => {
			expect(fileMatchesPattern(".env", ".*")).toBe(true);
			expect(fileMatchesPattern(".git/config", ".git/*")).toBe(true);
		});

		it("should match dotfiles with double-star patterns", () => {
			expect(fileMatchesPattern(".env", "**/.env")).toBe(true);
			expect(fileMatchesPattern("src/.env", "**/.env")).toBe(true);
		});
	});
});

describe("shouldIncludeFile", () => {
	describe("with no filters", () => {
		it("should include all files", () => {
			const options: FilterOptions = {};
			expect(shouldIncludeFile("file.ts", options)).toBe(true);
			expect(shouldIncludeFile("file.js", options)).toBe(true);
			expect(shouldIncludeFile(".env", options)).toBe(true);
		});
	});

	describe("exclude precedence", () => {
		it("should exclude files matching exclude pattern", () => {
			const options: FilterOptions = {
				include: [],
				exclude: ["*.test.ts"],
			};
			expect(shouldIncludeFile("file.test.ts", options)).toBe(false);
		});

		it("should exclude matching files even when include also matches", () => {
			const options: FilterOptions = {
				include: ["*.ts"],
				exclude: ["*.test.ts"],
			};
			expect(shouldIncludeFile("file.test.ts", options)).toBe(false);
		});

		it("should include non-excluded files", () => {
			const options: FilterOptions = {
				include: [],
				exclude: ["*.test.ts"],
			};
			expect(shouldIncludeFile("file.ts", options)).toBe(true);
		});
	});

	describe("include only", () => {
		it("should include files matching include pattern", () => {
			const options: FilterOptions = {
				include: ["*.ts"],
				exclude: [],
			};
			expect(shouldIncludeFile("file.ts", options)).toBe(true);
		});

		it("should exclude files not matching include pattern", () => {
			const options: FilterOptions = {
				include: ["*.ts"],
				exclude: [],
			};
			expect(shouldIncludeFile("file.js", options)).toBe(false);
		});

		it("should handle multiple include patterns", () => {
			const options: FilterOptions = {
				include: ["*.ts", "*.js"],
				exclude: [],
			};
			expect(shouldIncludeFile("file.ts", options)).toBe(true);
			expect(shouldIncludeFile("file.js", options)).toBe(true);
			expect(shouldIncludeFile("file.py", options)).toBe(false);
		});
	});

	describe("both include and exclude", () => {
		it("should include files matching include but not exclude", () => {
			const options: FilterOptions = {
				include: ["src/**/*.ts"],
				exclude: ["**/*.test.ts"],
			};
			expect(shouldIncludeFile("src/utils/helper.ts", options)).toBe(true);
			expect(shouldIncludeFile("src/utils/helper.test.ts", options)).toBe(false);
		});

		it("should exclude files matching exclude regardless of include", () => {
			const options: FilterOptions = {
				include: ["**/*.ts"],
				exclude: ["node_modules/**"],
			};
			expect(shouldIncludeFile("src/index.ts", options)).toBe(true);
			expect(shouldIncludeFile("node_modules/typescript/index.d.ts", options)).toBe(false);
		});
	});

	describe("dotfiles", () => {
		it("should include dotfiles by default", () => {
			const options: FilterOptions = {};
			expect(shouldIncludeFile(".env", options)).toBe(true);
			expect(shouldIncludeFile(".gitignore", options)).toBe(true);
		});

		it("should exclude dotfiles matching exclude pattern", () => {
			const options: FilterOptions = {
				exclude: [".env", ".git/*"],
			};
			expect(shouldIncludeFile(".env", options)).toBe(false);
			expect(shouldIncludeFile(".git/config", options)).toBe(false);
			expect(shouldIncludeFile(".gitignore", options)).toBe(true);
		});

		it("should include dotfiles matching include pattern", () => {
			const options: FilterOptions = {
				include: [".env*"],
			};
			expect(shouldIncludeFile(".env", options)).toBe(true);
			expect(shouldIncludeFile(".env.local", options)).toBe(true);
			expect(shouldIncludeFile(".gitignore", options)).toBe(false);
		});
	});

	describe("nested paths", () => {
		it("should handle nested directory patterns", () => {
			const options: FilterOptions = {
				include: ["src/**/*.ts"],
				exclude: ["**/*.test.ts"],
			};
			expect(shouldIncludeFile("src/utils/helper.ts", options)).toBe(true);
			expect(shouldIncludeFile("src/components/Button.tsx", options)).toBe(false);
			expect(shouldIncludeFile("src/utils/helper.test.ts", options)).toBe(false);
		});

		it("should handle complex nested patterns", () => {
			const options: FilterOptions = {
				include: ["src/**/*", "lib/**/*"],
				exclude: ["**/dist/**", "**/node_modules/**"],
			};
			expect(shouldIncludeFile("src/index.ts", options)).toBe(true);
			expect(shouldIncludeFile("lib/utils.js", options)).toBe(true);
			expect(shouldIncludeFile("src/dist/bundle.js", options)).toBe(false);
			expect(shouldIncludeFile("node_modules/pkg/index.js", options)).toBe(false);
		});
	});
});

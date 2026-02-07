import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		exclude: ["node_modules/**", "dist/**", "opensrc/**"],
		testTimeout: 15000,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/**",
				"dist/**",
				"opensrc/**",
				"src/testing/**",
				"**/*.test.ts",
				"**/*.d.ts",
			],
			// Global thresholds (slightly below current coverage to prevent regression)
			thresholds: {
				lines: 80,
				functions: 90,
				branches: 70,
				statements: 80,
				// Per-module thresholds for critical files
				// Note: These are currently below target - improve incrementally
				// Target: >=95% lines, >=90% branches for critical modules
				// TODO: Increase thresholds as coverage improves
			},
		},
	},
});

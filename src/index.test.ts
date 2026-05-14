import { describe, expectTypeOf, it } from "vitest";
import type { DiffxOptions } from ".";

describe("public API", () => {
	it("exports DiffxOptions for compatibility", () => {
		expectTypeOf<DiffxOptions>().toEqualTypeOf<{
			mode: "diff" | "patch" | "stat" | "numstat" | "shortstat" | "name-only" | "name-status" | "summary";
			include?: string | string[];
			exclude?: string | string[];
		}>();
	});
});

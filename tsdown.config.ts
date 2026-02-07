import { defineConfig } from "tsdown";

export default defineConfig({
	exports: true,
	entry: {
		index: "src/index.ts",
		bin: "src/bin.ts",
	},
});

import type { PatchStyle, FilterOptions } from "../types";

export interface ResolvedRefs {
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
	patchStyle?: PatchStyle;
}

export type FileFilterOptions = FilterOptions;

export interface CliToken {
	kind: string;
	name?: string;
	rawName?: string;
}

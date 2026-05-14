import type { PatchStyle, FilterOptions } from "../types";
import type { GitClient } from "../git/git-client";

export interface ResolvedRefs {
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
	patchStyle?: PatchStyle;
	gitClient?: GitClient;
}

export type FileFilterOptions = FilterOptions;

export interface CliToken {
	kind: string;
	name?: string;
	rawName?: string;
}

/**
 * Public library API for diffx
 */

export { diffxCommand } from "./cli/command";
export { parseRangeInput } from "./parsers/range-parser";
export { resolveRefs } from "./resolvers/ref-resolver";
export type {
	DiffxOptions,
	FilterOptions,
	GitHubCommitUrl,
	GitHubCompareUrl,
	GitHubPRChangesUrl,
	GitHubPRUrl,
	OutputMode,
	PatchStyle,
	RefRange,
	RefType,
} from "./types";
export { DiffxError, ExitCode } from "./types";

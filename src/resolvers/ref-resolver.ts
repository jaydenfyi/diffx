/**
 * Ref resolver orchestrator
 * Routes to the appropriate resolver based on ref type
 */

import type { RefRange, RefType } from "../types";
import { resolveLocalRefs } from "./local-ref-resolver";
import { resolveRemoteRefs } from "./remote-ref-resolver";
import {
	resolvePRRangeRefs,
	resolvePRRefs,
	resolveGitHubCommitRefs,
	resolveGitHubPRChangesRefs,
	resolveGitHubCompareRefs,
} from "./pr-url-resolver";
import { resolveGitUrlRefs } from "./git-url-resolver";
import { resolveGitLabMRRefs } from "./gitlab-mr-resolver";

const resolversByRefRangeType = {
	"local-range": resolveLocalRefs,
	"remote-range": resolveRemoteRefs,
	"pr-ref": resolvePRRefs,
	"github-url": resolvePRRefs,
	"pr-range": resolvePRRangeRefs,
	"git-url-range": resolveGitUrlRefs,
	"github-commit-url": resolveGitHubCommitRefs,
	"github-pr-changes-url": resolveGitHubPRChangesRefs,
	"github-compare-url": resolveGitHubCompareRefs,
	"gitlab-mr-ref": resolveGitLabMRRefs,
} as const satisfies Record<
	RefType,
	(range: RefRange) => Promise<{
		left: string;
		right: string;
		cleanup?: () => Promise<void>;
	}>
>;
/**
 * Resolve any ref range to concrete left/right refs
 */
export async function resolveRefs(range: RefRange): Promise<{
	left: string;
	right: string;
	cleanup?: () => Promise<void>;
}> {
	const resolver = resolversByRefRangeType[range.type];

	return resolver(range);
}

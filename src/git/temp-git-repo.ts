import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitClient } from "./git-client";

const TMP_PREFIX = "diffx-";

export type TemporaryGitClient = {
	gitClient: GitClient;
	cleanup: () => Promise<void>;
};

function getTempRoot(): string {
	return process.env.DIFFX_TMPDIR || tmpdir();
}

export async function createTemporaryGitClient(): Promise<TemporaryGitClient> {
	const tempRoot = getTempRoot();
	await mkdir(tempRoot, { recursive: true });

	const repoPath = await mkdtemp(join(tempRoot, TMP_PREFIX));
	const gitClient = new GitClient(repoPath);

	try {
		await gitClient.initBare();
	} catch (error) {
		await rm(repoPath, { recursive: true, force: true });
		throw error;
	}

	return {
		gitClient,
		cleanup: async () => {
			await rm(repoPath, { recursive: true, force: true });
		},
	};
}

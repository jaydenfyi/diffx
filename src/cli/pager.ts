/**
 * Pager utilities
 */

import { spawn } from "node:child_process";
import { gitClient } from "../git/git-client";

type PagerControl = {
	force?: boolean;
	disable?: boolean;
	pager?: string;
};

export function shouldUsePager(control: PagerControl): boolean | Promise<boolean> {
	if (control.disable) return false;
	if (control.force) return true;
	if (!process.stdout.isTTY) return false;

	// Check if pager option is explicitly set to "false"
	if (control.pager === "false") return false;

	// If pager is explicitly provided (and not "false"), use it
	if (control.pager) return true;

	// Otherwise, check if there's a valid pager configured (async, no default)
	return resolvePagerCommand().then((cmd) => cmd !== null && cmd !== "" && cmd !== "false");
}

async function resolvePagerCommand(): Promise<string | null> {
	const gitPager = process.env.GIT_PAGER;
	if (gitPager && gitPager.trim().length > 0) {
		return gitPager.trim();
	}

	// Only trust user-level git config; do not execute repository-local core.pager.
	const corePager =
		(await gitClient.getConfigValue("core.pager", "global")) ??
		(await gitClient.getConfigValue("core.pager", "system"));
	if (corePager && corePager.trim().length > 0) {
		return corePager.trim();
	}

	const pager = process.env.PAGER;
	if (pager && pager.trim().length > 0) {
		return pager.trim();
	}

	return null;
}

function parsePagerCommand(command: string): { file: string; args: string[] } | null {
	const tokens: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;
	let escaping = false;

	for (let i = 0; i < command.length; i++) {
		const char = command[i];

		if (escaping) {
			current += char;
			escaping = false;
			continue;
		}

		if (char === "\\") {
			escaping = true;
			continue;
		}

		if (quote) {
			if (char === quote) {
				quote = null;
			} else {
				current += char;
			}
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}

		if (/\s/.test(char)) {
			if (current.length > 0) {
				tokens.push(current);
				current = "";
			}
			continue;
		}

		current += char;
	}

	if (escaping || quote) {
		return null;
	}

	if (current.length > 0) {
		tokens.push(current);
	}

	if (tokens.length === 0) {
		return null;
	}

	const [file, ...args] = tokens;
	return { file, args };
}

async function runPager(command: string, output: string): Promise<void> {
	const parsed = parsePagerCommand(command);
	if (!parsed) {
		throw new Error("Invalid pager command");
	}

	// Determine args and environment based on pager type
	let args = parsed.args;
	const env: Record<string, string | undefined> = {};

	// Special handling for less pager
	const isLess = parsed.file.endsWith("less") || parsed.file === "less";
	if (isLess) {
		// Add -R flag for less if not already present
		if (!args.includes("-R")) {
			args = ["-R", ...args];
		}
		// Set LESS environment variable
		env.LESS = "FRX";
	} else {
		// Explicitly set LESS to undefined for non-less pagers
		env.LESS = undefined;
	}

	await new Promise<void>((resolve, reject) => {
		let settled = false;
		const resolveOnce = () => {
			if (settled) return;
			settled = true;
			resolve();
		};
		const rejectOnce = (error: Error) => {
			if (settled) return;
			settled = true;
			reject(error);
		};

		const child = spawn(parsed.file, args, {
			stdio: ["pipe", "inherit", "inherit"],
			env: { ...process.env, ...env },
		});

		child.on("error", (error) => rejectOnce(error instanceof Error ? error : new Error(String(error))));
		child.on("exit", (code) => {
			if (code && code !== 0) {
				rejectOnce(new Error(`Pager exited with code ${code}`));
				return;
			}
			resolveOnce();
		});

		if (child.stdin) {
			child.stdin.on("error", (error: NodeJS.ErrnoException) => {
				// Pager may exit before fully consuming stdin (e.g. user presses "q" in delta/less).
				// Treat broken pipe/closed stream as expected pager shutdown.
				if (error.code === "EPIPE" || error.code === "ERR_STREAM_DESTROYED") {
					return;
				}
				rejectOnce(error);
			});
			child.stdin.write(output);
			child.stdin.end();
		}
	});
}

export async function pageOutput(output: string, control: PagerControl): Promise<boolean> {
	const shouldPage = await shouldUsePager(control);
	if (!shouldPage) {
		return false;
	}

	// Use explicit pager if provided, otherwise resolve from config
	let pagerCommand = control.pager;
	if (!pagerCommand) {
		pagerCommand = (await resolvePagerCommand()) ?? "less -R";
	}

	try {
		await runPager(pagerCommand, output);
		return true;
	} catch {
		return false;
	}
}

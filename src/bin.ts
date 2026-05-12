#!/usr/bin/env node
/**
 * CLI entry point for diffx
 */

import { cli } from "gunshi";
import { diffxCommand } from "./cli/command";
import { handleError } from "./errors/error-handler";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

// Run the CLI
const argv = process.argv.slice(2);

try {
	await cli(argv, diffxCommand, {
		name: "diffx",
		version,
	});
} catch (error) {
	const diffxError = handleError(error);
	console.error(`Error: ${diffxError.message}`);
	process.exit(diffxError.exitCode);
}

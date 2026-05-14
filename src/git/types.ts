export interface GitDiffOptions {
	files?: string[];
	color?: "always" | "never" | "auto";
	extraArgs?: string[];
}

export interface GitRemote {
	name: string;
	fetchUrl?: string;
	pushUrl?: string;
}

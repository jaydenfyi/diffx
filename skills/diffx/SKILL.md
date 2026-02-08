---
name: diffx
description: Operate the diffx Git-diff CLI for worktree diffs, local/remote ref ranges, GitHub PR diffs, GitLab MR diffs, commit/compare URL diffs, and git-diff-compatible pass-through. Use when an agent must decide what to diff, map intent to `diffx` input syntax, choose output mode (`diff`/`patch`/`stat`/etc.), apply include/exclude filters, or resolve common flag/pager conflicts.
---

# Use Diffx CLI

Use this skill to translate a diffing request into the right `diffx` command.

## Decision Flow

1. Classify the target.
- Current repo changes only -> load `references/worktree.md`.
- Two refs/branches/tags/SHAs -> load `references/local-and-remote-ranges.md`.
- GitHub PR/commit/compare URL or `github:owner/repo#123` -> load `references/github-and-gitlab.md`.
- GitLab MR (`gitlab:owner/repo!123`) -> load `references/github-and-gitlab.md`.

2. Choose output shape.
- Full code review output -> `diff` (default).
- Apply-ready output -> `--mode patch`.
- Summary output -> `--stat`, `--numstat`, `--shortstat`, `--name-only`, `--name-status`, or `--summary`.
- Custom table output -> `--overview` only.

3. Apply optional narrowing.
- File globs -> load `references/filters-and-pass-through.md`.
- Native git diff flags/pathspec -> load `references/filters-and-pass-through.md`.

4. Handle failures/conflicts.
- Unexpected empty output, invalid input, or flag conflicts -> load `references/troubleshooting.md`.

## Defaults

- For generic "what changed?": `diffx --no-pager`
- For compact review: `diffx <range-or-target> --stat --no-pager`
- For patch handoff: `diffx <range-or-target> --mode patch --no-pager`

## Reference Map

- `references/worktree.md`: current working tree and `--index` behavior.
- `references/local-and-remote-ranges.md`: branch/tag/SHA and remote shorthand ranges.
- `references/github-and-gitlab.md`: PR/MR/commit/compare forms.
- `references/filters-and-pass-through.md`: include/exclude, git flags, pathspec.
- `references/troubleshooting.md`: invalid combos, exit codes, quick fixes.

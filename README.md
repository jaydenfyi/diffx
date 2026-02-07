<h1 align="center">diffx</h1>

<p align="center">A CLI utility for easily diffing Git changes across your working tree, local refs, remote refs, GitHub PRs, GitLab MRs, or any Git URLs.</p>

## Quick Start

### Install

```bash
# npm
npm install -g @jaydenfyi/diffx

# bun
bun add -g @jaydenfyi/diffx

# no install
npx @jaydenfyi/diffx --help
```

### Most useful commands

```bash
# 1) Show all current local changes (tracked + untracked)
diffx

# 2) Compare two refs
diffx main..feature

# 3) Diff a GitHub PR
diffx https://github.com/owner/repo/pull/123

# 4) Generate an apply-able patch
diffx main..feature --mode patch

# 5) Quick status view
diffx --name-status
```

## `diffx` vs `git diff`

| Capability | `diffx` | `git diff` |
| ---------- | ------- | ---------- |
| Full working tree snapshot (tracked + untracked) | ✅ | ❌ |
| Direct GitHub PR and GitLab MR diffing | ✅ | ❌ |
| Cross-remote and fork comparisons | ✅ | ❌ |
| Include/exclude glob filtering | ✅ | ❌ |
| `git diff` compatibility | ✅ | ✅ |

## Command

```bash
diffx [range-or-url] [options] [-- <pathspec...>]
```

Use `--index` for strict `git diff` compatibility (index vs worktree behavior).

## Input Formats

### No range argument (default behavior)

```bash
# Uses current worktree first (tracked + untracked)
diffx

# If there are no local changes, falls back to inferred base..HEAD
```

### Local ranges

```bash
diffx main..feature
diffx abc123..def456
diffx refs/heads/main..refs/tags/v1.0
```

### Remote shorthand ranges

```bash
diffx owner/repo@main..owner/repo@feature
diffx owner/repo@main..feature
```

### Git URL ranges (SSH/HTTPS, any host)

```bash
diffx git@github.com:owner/repo.git@main..feature
diffx https://github.com/owner/repo.git@v1.0..v2.0
diffx git@github.com:owner/repo.git@main..git@gitlab.com:owner/fork.git@feature
```

### GitHub refs and URLs

```bash
# GitHub ref shorthand
diffx github:owner/repo@main..feature

# PR reference
diffx github:owner/repo#123

# PR URL
diffx https://github.com/owner/repo/pull/123

# PR vs PR
diffx github:owner/repo#123..github:owner/repo#456

# Commit URL
diffx https://github.com/owner/repo/commit/abc123

# PR changes URL
diffx https://github.com/owner/repo/pull/123/changes/abc123..def456

# Compare URL (same repo or cross-fork)
diffx https://github.com/owner/repo/compare/main...feature
diffx https://github.com/owner/repo/compare/main...other-owner:other-repo:feature
```

### GitLab refs

```bash
# GitLab shorthand range
diffx gitlab:owner/repo@main..feature

# Merge request ref
diffx gitlab:owner/repo!123
```

## Output Modes

`diffx` defaults to `diff` mode.

- `diff`: unified diff output.
- `patch`: patch output (for `git apply` style use).
- `stat`: per-file histogram + summary line.
- `numstat`: tab-delimited additions/deletions per file.
- `shortstat`: one summary line only.
- `name-only`: changed filenames only.
- `name-status`: status + filename (e.g. `M`, `A`, `D`, `U`).
- `summary`: structural summary (`create mode`, `rename`, etc.), equivalent to `git diff --summary`.

Examples:

```bash
diffx main..feature --mode patch
diffx https://github.com/owner/repo/pull/123 --stat
diffx --name-status
```

## Filtering

```bash
# Include only TypeScript files
diffx main..feature --include "src/**/*.ts"

# Exclude tests
diffx main..feature --exclude "**/*.test.ts"

# Combine include + exclude
diffx main..feature --include "src/**" --exclude "**/*.spec.ts"

# Repeat include/exclude flags (matches any include; excludes any exclude)
diffx --include "*.ts" --include "*.tsx" --exclude "*.js" --exclude "*.jsx"
```

## Pager behavior

- Diff/patch output auto-pages on TTY (git-like behavior).
- Honors `GIT_PAGER`, `core.pager`, `PAGER`.
- Use `--pager` to force paging.
- Use `--no-pager` to disable paging.

## Options Reference

| Option                | Short | Description                                                                                                |
| --------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| `--mode <mode>`       |       | Select output mode: `diff`, `patch`, `stat`, `numstat`, `shortstat`, `name-only`, `name-status`, `summary` |
| `--stat`              |       | Shortcut for stat output                                                                                   |
| `--numstat`           |       | Shortcut for numstat output                                                                                |
| `--summary`           |       | Structural summary (native `git diff --summary`)                                                           |
| `--shortstat`         |       | Shortcut for shortstat output                                                                              |
| `--name-only`         |       | Show filenames only                                                                                        |
| `--name-status`       |       | Show status + filename                                                                                     |
| `--include <pattern>` | `-i`  | Include only files matching glob (repeatable)                                                              |
| `--exclude <pattern>` | `-e`  | Exclude files matching glob (repeatable)                                                                   |
| `--pager`             |       | Force pager                                                                                                |
| `--no-pager`          |       | Disable pager                                                                                              |
| `--index`             |       | Strict `git diff` compatibility mode                                                                       |
| `--help`              | `-h`  | Show help                                                                                                  |
| `--version`           | `-v`  | Show version                                                                                               |

## Git Pass-through Compatibility

`diffx` forwards unknown/standard `git diff` flags to git when possible, including pathspec support after `--`.

```bash
diffx main..feature -U10 --word-diff

diffx --stat -- src/cli src/utils
```

This allows existing `git diff` habits while still using `diffx` input resolution and workflows.

## Exit Codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| `0`  | Success                                  |
| `1`  | No files matched filters                 |
| `2`  | Invalid input / unsupported range format |
| `3`  | Git execution/fetch error                |

## Development

This repository uses `bun`.

```bash
bun install
bun run build
bun run test
bun run test:e2e
bun run lint
bun run typecheck
```

## License

MIT

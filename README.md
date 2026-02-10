# diffx

A CLI utility for diffing Git changes across working trees, refs, GitHub PRs, GitLab MRs, and Git URLs.

## Install

```bash
npm install -g @jaydenfyi/diffx
npx @jaydenfyi/diffx
```

## Quick Start

```bash
diffx                                    # Show all local changes
diffx main..feature                      # Compare two refs
diffx https://github.com/owner/repo/pull/123  # Diff a GitHub PR
diffx main..feature --mode patch         # Generate a patch
diffx --name-status                      # Quick status view
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

### No argument

```bash
diffx  # Current worktree (tracked + untracked)
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

`diff`, `patch`, `stat`, `numstat`, `shortstat`, `name-only`, `name-status`, `summary`

```bash
diffx main..feature --mode patch
diffx https://github.com/owner/repo/pull/123 --stat
diffx --name-status
```

## Filtering

```bash
diffx main..feature --include "src/**/*.ts"          # Include only
diffx main..feature --exclude "**/*.test.ts"         # Exclude only
diffx main..feature -i "src/**" -e "**/*.spec.ts"    # Both (repeatable)
```

## Pager behavior

Auto-pages on TTY. Honors `GIT_PAGER`, `core.pager`, `PAGER`. Use `--pager` / `--no-pager` to override.

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

## Git Pass-through

Forwards unknown flags to `git diff`, including pathspec after `--`.

```bash
diffx main..feature -U10 --word-diff
diffx --stat -- src/cli src/utils
```

## Exit Codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| `0`  | Success                                  |
| `1`  | No files matched filters                 |
| `2`  | Invalid input / unsupported range format |
| `3`  | Git execution/fetch error                |

## Development

```bash
bun install
bun run build
bun run test
bun run lint
bun run typecheck
```

## License

MIT

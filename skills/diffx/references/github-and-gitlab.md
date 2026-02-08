# GitHub And GitLab Targets

Use when the input is a hosted PR/MR reference, URL, commit URL, or compare URL.

## GitHub

```bash
# PR ref shorthand
diffx github:owner/repo#123 --stat --no-pager

# PR URL
diffx https://github.com/owner/repo/pull/123 --no-pager

# Commit URL
diffx https://github.com/owner/repo/commit/abc123 --no-pager

# Compare URL
diffx https://github.com/owner/repo/compare/main...feature --no-pager
```

## GitLab

```bash
# MR ref shorthand
diffx gitlab:owner/repo!123 --no-pager

# Range shorthand
diffx gitlab:owner/repo@main..feature --no-pager
```

## Guidance

- Use `--stat` for quick PR/MR summaries.
- Use `--mode patch` when the user requests apply-able output.

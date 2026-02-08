# Worktree Use Cases

Use when the request is about local uncommitted changes.

## Core commands

```bash
# Show tracked + untracked local changes
diffx --no-pager

# Compact status view
diffx --name-status --no-pager

# Strict git index/worktree behavior
diffx --index --no-pager
```

## Guidance

- Prefer plain `diffx` for "what changed locally?".
- Add a summary flag (`--stat`, `--shortstat`, `--name-only`) when user asks for concise output.

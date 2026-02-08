# Local And Remote Ranges

Use when the request compares two refs, branches, tags, or SHAs.

## Local ranges

```bash
diffx main..feature --no-pager
diffx abc123..def456 --no-pager
diffx refs/heads/main..refs/tags/v1.0 --no-pager
```

## Remote shorthand ranges

```bash
diffx owner/repo@main..owner/repo@feature --no-pager
diffx owner/repo@main..feature --no-pager
```

## Output variants

```bash
diffx main..feature --stat --no-pager
diffx main..feature --mode patch --no-pager
```

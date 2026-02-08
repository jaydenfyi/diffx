# Filters And Git Pass-Through

Use when the user wants narrowed output or native `git diff` flags.

## Include/exclude filters

```bash
diffx main..feature --include "src/**/*.ts" --no-pager
diffx main..feature --exclude "**/*.test.ts" --no-pager
diffx --include "*.ts" --include "*.tsx" --exclude "*.js" --exclude "*.jsx" --no-pager
```

## Native git flag pass-through

```bash
diffx main..feature -U10 --word-diff --no-pager
diffx --word-diff-regex 'foo..bar' --no-pager
```

## Pathspec

```bash
diffx --stat --no-pager -- src/cli src/utils
```

## Guidance

- Quote globs to avoid shell expansion side effects.
- Place pathspecs after `--`.

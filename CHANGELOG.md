# @jaydenfyi/diffx

## 0.0.5

### Patch Changes

- [#3](https://github.com/jaydenfyi/diffx/pull/3) [`58ab252`](https://github.com/jaydenfyi/diffx/commit/58ab252dfc0f99ad089747b22e13cd39aba36fe7) Thanks [@jaydenfyi](https://github.com/jaydenfyi)! - Resolve GitHub PR URLs in an isolated temporary Git repository so URL diffs work outside an existing Git checkout and support sandbox temp roots via `DIFFX_TMPDIR`.

## 0.0.4

### Patch Changes

- Fix CLI version reporting by reading from package.json instead of using a hardcoded version string.
  EOF

  # 3) version to 0.0.4

  bunx changeset version

  # 4) build the correct dist

  bun run build

  # 5) commit the 0.0.4 release files

  git add .
  git commit -m "chore: version package to 0.0.4"

  # 6) publish

  bunx changeset publish

  # 7) push the release commits

  git push origin main

## 0.0.3

### Patch Changes

- Fix CLI version reporting by reading from package.json instead of hardcoded value

## 0.0.2

### Patch Changes

- 1d37359: Add three-dot (A...B) range syntax support with merge-base semantics
  - Parser detects separator and sets rangeSyntax ("two-dot" | "three-dot")
  - Resolvers compute merge-base when rangeSyntax is "three-dot"
  - Supported across local, remote, git-url, github, and gitlab ranges

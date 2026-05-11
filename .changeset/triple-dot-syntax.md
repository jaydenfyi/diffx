---
"@jaydenfyi/diffx": minor
---

Add three-dot (A...B) range syntax support with merge-base semantics

- Parser detects separator and sets rangeSyntax ("two-dot" | "three-dot")
- Resolvers compute merge-base when rangeSyntax is "three-dot"
- Supported across local, remote, git-url, github, and gitlab ranges

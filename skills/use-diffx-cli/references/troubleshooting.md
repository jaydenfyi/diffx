# Troubleshooting

Use when command output is empty, errors occur, or flags conflict.

## Invalid combinations

- Do not combine `--pager` with `--no-pager`.
- Do not combine `--overview` with git output-format flags:
  - `--stat`, `--numstat`, `--name-only`, `--name-status`, `--raw`, `-p`, `--patch`, `--shortstat`

## Exit code meaning

- `0`: success
- `1`: no files matched filters
- `2`: invalid range/input format
- `3`: git/fetch execution failure

## Quick fixes

- If filters return nothing, retry without filters to verify data exists.
- If range parsing fails, try explicit local range form (`left..right`) or hosted shorthand (`github:...`, `gitlab:...`).
- If automation hangs, add `--no-pager`.

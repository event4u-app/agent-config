# skill-writing — read-only-by-default scripts

> Mode body of the [`skill-writing`](../SKILL.md) skill (router-head
> retrofit, 2026-08-20). Content moved VERBATIM from SKILL.md — load this
> file when the mode table in SKILL.md routes here.

## Read-only-by-default scripts

A script shipped inside a skill (`scripts/**`) is **side-effect-free by
default** — it inspects, computes, and prints; it does not mutate the
filesystem. Any mutation (writing a file, deleting, rename/copy) must be gated
behind an explicit flag named in this SKILL.md — `--writable` / `--apply` /
`--write` / `--output` / `--fix` — so the default invocation is safe to run
blind. A generator whose *declared purpose* is to write (it emits an artifact
to a caller-supplied path) is allowlisted with a rationale in
`src/scripts/lint_skill_scripts_readonly_allowlist.json` rather than carrying a
redundant flag. `lint_skill_scripts_readonly` enforces this: an ungated,
non-allowlisted write fails the build.

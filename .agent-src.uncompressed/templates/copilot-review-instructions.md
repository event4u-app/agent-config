# Copilot Code Review — Repository-Specific Suppressions

> Read by GitHub Copilot Code Review (PR bot) when reviewing this repo.
> Companion to `.github/copilot-instructions.md`. **This file is the
> path-resolution suppression floor** — it carries the rules Copilot
> needs to *not* flag, sharply scoped to the agent-config layout.

## Why this file exists

The repo ships agent-config rules, skills, commands, and contexts under
`.augment/`, `.agent-src/`, and (during authoring) `.agent-src.uncompressed/`.
Cross-references inside those trees are valid via the **delivered**
`.augment/` layout — not via raw git checkout. Copilot's static checker
walks the git tree, so it sees broken paths where there are none.

This is **intentional, not a bug**. The installer (`scripts/install.sh`)
projects `.agent-src/` → `.augment/` and creates the symlinks that make
the paths resolve at agent runtime.

## ✅ Known False Positives — Do NOT Flag

### Relative cross-references inside markdown rules / skills / commands

```markdown
[link](../docs/guidelines/foo.md)
[link](../contexts/bar.md)
[link](../../docs/guidelines/baz.md)
```

These resolve from the file's delivered location (e.g.
`.augment/rules/<rule>.md`). Even when the file is symlinked into
`.claude/rules/`, `.cursor/rules/`, or `.clinerules/`, the relative
form is correct by construction.

### `path_prefix:` triggers containing `.agent-src.uncompressed/`

```yaml
triggers:
  - path_prefix: ".agent-src.uncompressed/rules/"
```

This is a **literal match string** for the host's router — *not* a file
reference. Source-of-truth meta-rules (`augment-source-of-truth`,
`augment-portability`, `skill-quality`, `docs-sync`,
`rule-type-governance`) legitimately match against the authoring tree.

### Symlinked rule / skill / command files

Targets resolve into `.augment/rules/`, `.augment/skills/`,
`.augment/commands/` via installer-managed symlinks. Missing-file
reports under `.claude/`, `.cursor/`, `.clinerules/` are renderer
artifacts, not real bugs.

### Body-link forms `../docs/guidelines/...`

Single-up form is the post-rewrite shape produced by
`scripts/compress.py`. The compressed `.agent-src/rules/` tree is one
level deeper than the source `.agent-src.uncompressed/rules/`, so the
rewriter collapses `../../docs/...` to `../docs/...`. Both forms are
expected — one in source, one in compressed output.

## ✅ What TO flag

- Code defects, security issues, broken tests, type errors — normal
  review.
- New `.agent-src.uncompressed/` substrings introduced into
  `.agent-src/rules/` body content (the `check-compressed-paths` task
  already gates this — flag it as a regression if it slips through).
- Rule frontmatter with `load_context:` entries that don't follow the
  logical-name convention (`contexts/<area>/<file>.md`).

## Pointer

The full architecture is in `docs/architecture.md` § "Path resolution
and Copilot integration". The compressed-path validator is
`scripts/check_compressed_paths.py`, wired into `task ci`.

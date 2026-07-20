---
model_tier: medium
name: contribution-precheck
pack: meta
tier: 2
visibility: internal
skills: [lint-skills, check-refs]
description: "Contributor self-service precheck: run the PR-relevant lint subset (skill linter, originality gate, frontmatter schema) on changed files locally — a verdict with fix hints before opening a PR."
suggestion:
  eligible: false
  rationale: "Package-internal — contributors to event4u/agent-config invoke it explicitly before opening a PR."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# contribution-precheck

Run the same gates a PR will hit — locally, Node-only, before pushing. Mirrors
the CI enforcement path (`originality-gate` + skill-lint jobs in
`.github/workflows/skill-lint.yml`) so a contributor never learns about a
failure from remote CI first.

Requires only Node + installed `node_modules` (the `./scripts-run` shim invokes
`tsx` directly — no task runner, no full `task ci` toolchain).

## Instructions

### 1. Compute the changed set

```bash
BASE=$(git merge-base origin/main HEAD 2>/dev/null || echo HEAD)
CHANGED=$(git diff --name-only --diff-filter=ACMR "$BASE" -- \
  'src/skills/*/SKILL.md' \
  'src/agent-src/personas/*.md' \
  'src/domains/**/command.md' \
  | grep -v '^src/agent-src/personas/_' || true)
```

Uncommitted work counts: append `git diff --name-only` + `git diff --cached
--name-only` output filtered to the same patterns. Empty set → report
"nothing to precheck — no changed skills / personas / domain commands" and
stop (that is an honest no-op, not a pass).

### 2. Run the three gates, in order

| Gate | Command | Mirrors |
|---|---|---|
| Frontmatter schema | `./scripts-run src/scripts/validate_frontmatter --root src` | CI schema validation |
| Skill lint | `./scripts-run src/scripts/skill_linter <changed SKILL.md files>` | `skill-lint` job (`--changed`) |
| Originality (anti-reskin) | `./scripts-run src/scripts/lint_originality --changed $CHANGED` | `originality-gate` job |

Notes:

- `skill_linter` takes positional paths — pass the changed `SKILL.md` files
  explicitly (its own `--changed` derivation filters to the projected trees,
  not `src/`, and would silently check nothing on authored edits).
- `lint_originality --changed` needs the explicit file list from step 1 — it
  does not self-derive.

### 3. Emit the verdict

One compact block, worst gate first:

```
Precheck: <N> changed file(s)
  ✅|❌ frontmatter — <0 failing | list failing files + first error each>
  ✅|❌ skill lint  — <pass/warn/fail counts | per-file errors>
  ✅|❌ originality — <no overlap ≥ WARN | offending pair + overlap %>
Verdict: READY | FIX FIRST (<n> blocking finding(s))
```

For every ❌ add one fix hint: the failing file, the rule/pair it tripped, and
the smallest change that clears it (e.g. "overlap 72% with `<skill>` — rewrite
the shared procedure sections in your own words; find-replace re-skins score
~100% because entities are neutralized").

### 4. Degraded mode (no git remote / shallow clone)

`origin/main` missing → fall back to `git diff --name-only HEAD` (working
tree) for step 1 and say so in the verdict header. Never claim the CI result
will match exactly in degraded mode — the PR gate diffs against the real base.

## Gotcha

- A clean precheck is **necessary, not sufficient** — remote CI additionally
  runs the per-pack matrix, security linters and reference checks. The
  precheck covers the gates that most commonly fail external contributions.
- Do not "fix" an originality failure by shuffling words until the score dips
  under the threshold — the entity-neutralized shingle gate is calibrated for
  find-replace re-skins; a borderline score means the artifact needs its own
  substance, not better camouflage.

## Do NOT

- Do NOT run `task ci` as a substitute — this command exists precisely so a
  contributor without the full toolchain gets a verdict.
- Do NOT skip step 1's empty-set report — "0 files checked" is INCONCLUSIVE,
  never a pass (same guard as CI).

---
complexity: lightweight
review_by: 2026-12-27
---

# Stub: road to hermetic `explain_run` tests

> **Stub — not active work.** A red observed 2026-08-27 while draining
> `road-to-composition-before-creation`. Recorded rather than fixed because the
> correct fix turns on cwd semantics the observation did not settle, which puts
> it above the fix-now bar in
> [`active-remediation`](../../../src/rules/active-remediation.md) (same
> path/module, ≤ ~10 lines). Landed in the same change as the observation, per
> [`fix-what-you-see`](../../../src/rules/fix-what-you-see.md): a red is either
> fixed with its verification, or it gets a tracked follow-up — never named and
> handed back.

## The defect

`tests/scripts/explain_run.test.ts` § *buildReport — end to end* has two specs
that assert an **empty** fixture produces honest no-data output:

- `every section reports honest "no data" over an empty directory`
- `summary renders honest no-data one-liners when every source is absent`

They fail on a machine where `agents/state/` exists:

```
→ expected '# explain-run\n\nWindow: task=any · s…'
  to match /no data — none of the candidate paths exist/
→ expected … to contain '- Session health: no state recorded.'
```

**Reproduced in both directions**, which is what makes it a defect rather than a
flake: with `agents/state/` moved aside the file is **19/19 green**; moved back,
**2 failed | 17 passed**. `agents/state/` is gitignored (`.gitignore:244`) and is
written by the hook dispatcher during any local session, so CI shards start clean
and never see it. It is a **local-only false red**, and the kind that costs a
future reader an hour because the failure names no file they touched.

## Cause

`baseOpts()` (`:46-57`) pins `router`, `auditDir` and `engagement` into the
fixture directory but leaves `hygiene: null`. `null` makes `explain_run` fall
back to `DEFAULT_HYGIENE_CANDIDATES` (`src/scripts/explain_run.ts:78`):

```ts
const DEFAULT_HYGIENE_CANDIDATES = ['agents/state/context-hygiene.json', 'agents/runtime/state/context-hygiene.json'];
```

Those are **relative** paths, resolved against `process.cwd()` — the repository
root when vitest runs — so one of four inputs escapes the fixture and reads live
repository state.

## Why it was not fixed on sight

The obvious one-line fix (point `hygiene` at a path inside the fixture) collides
with a second spec at `:232-237`, which writes
`p('agents','state','context-hygiene.json')` **inside** the fixture and then
passes `hygiene: null`, expecting the default-candidate resolution to find it.
That only works if the candidates resolve relative to the fixture — and the test
file contains **no `chdir`**, so today it works for the wrong reason: it finds
the real repository's file, not the one it just wrote.

So the two specs want opposite things from the same `null`, and settling it
means deciding whether `explain_run`'s default candidates are cwd-relative by
contract or root-relative by accident — a question about the script, not the
test. Guessing it inside an unrelated roadmap's PR is how a test gets pinned to
the wrong reading.

## What closes it

1. Decide the contract: are `DEFAULT_HYGIENE_CANDIDATES` resolved against the
   process cwd (documented, and the test chdirs into its fixture) or against a
   passed-in root (the script gains a root parameter, as several sibling gates
   already have for exactly this reason)?
2. Make all four inputs hermetic under that decision — no spec may read a path
   outside its own fixture.
3. Prove it in both directions: the suite is green with `agents/state/` present
   **and** absent. One direction is what currently passes by accident.
4. Sweep for siblings: `grep -rln "process.cwd()" src/scripts/` against the test
   files that drive those scripts. This defect class is "a test whose fixture has
   a hole", and one instance is a sample, not the population.

## What this stub does NOT cover

The other three reds observed in the same run, each attributed and each
environmental rather than a defect in the tree:

- `check_rule_projection_integrity` — the known worktree red; `.agent-settings.yml`
  is absent from a worktree, so the ADR-236 delivery partition projects a
  *partial* plan, which the spec's own `skipIf(planEmpty)` guard does not cover.
  Already recorded in the maintainer's notes; green on all eight CI shards.
- `check_preamble_payload_budget` — same root cause, arithmetically: it measures
  138,277 tokens against a 107,646 ceiling in a worktree, dominated by
  `project-scope rules 122,680`. Any single change is noise against a +30,631
  overshoot.
- Nothing here proposes changing either ceiling or either baseline.

# Code-graph extractor repair — measurement, and the pre-falsifier verdict

<!-- evidence-type: analysis -->

**Date:** 2026-08-22. Roadmap: `road-to-code-graph-extractor-defect`, Phase 0.
All builds run through the supported entry point (`agent-config code-graph
build`) against real repositories, output to gitignored paths under
`agents/runtime/tmp/`.

## Verdict, first

```
THE EXTRACTION DEFECT WAS REAL AND IS REPAIRED. IT IS NOT THE CAUSE OF THE NULL.
THE PRE-FALSIFIER FIRES. THE ROADMAP CLOSES AT PHASE 0 AS AN HONEST NULL.
```

The repair **doubles** the TypeScript symbol-node count on the repo the report's
figure came from (130 → 265). The post-repair count is still **46× below** its
PHP sibling, so the order-of-magnitude bar the roadmap registered *before* any
repair is missed, and Phases 1 and 2 do not run.

## Step 0.1 — the extractor repair, and the fixture

`extractTsJs` handled six node kinds. A grep for `lexical_declaration`,
`variable_declarator`, `arrow_function` and `public_field_definition` across the
whole engine returned **zero** hits, so the dominant modern TS declaration form
was unreachable. Added: function-valued `variable_declarator` bindings (emitting
`function`, or `method` inside a class) and `public_field_definition` holding a
function (emitting `method`).

Scoped to bindings whose value **is** a function. `const x = 3` stays
unrepresented on purpose: emitting a node per constant would raise the count
without improving recall, which is the cosmetic-improvement failure the
pre-falsifier exists to catch.

On the roadmap's own 5-TS / 3-PHP fixture, rebuilt with a real build:

| Declared | Before | After |
|---|---|---|
| `export const alpha = (x) => …` | none | `function alpha` |
| `const beta = function () { … }` | none | `function beta` |
| `class C { m = () => 1 }` | `C` only | `C` + `method m` |
| `export function gamma(y) { … }` | `function gamma` | unchanged |
| `class D { classic() { … } }` | `D` + `method classic` | unchanged |
| PHP `class P { one; two }`, `function three` | 3 of 3 | unchanged |

**5 of 5 TS symbols and 3 of 3 PHP symbols.** `git show
HEAD:src/scripts/code_graph/extract.ts | grep -c lexical_declaration` returns 0.

## Step 0.2 — the reachability repair

`_dispatch.bash` parses `--root` globally, strips it from argv, and exports
`AGENT_CONFIG_PROJECT_ROOT`; the engine read neither and fell back to its own
module path. `resolveRoot` now resolves `--root` > `AGENT_CONFIG_PROJECT_ROOT` >
module tree, through `realpathSync`, applied at all five sites that previously
read `flag(argv, '--root') ?? REPO_ROOT`.

**Sensitivity, and it is the sharpest measurement in this record.** With the
env-var rung neutralised and nothing else changed, the same dispatcher
invocation — `agent-config code-graph build --root <2-file fixture>` — indexes
**2,763 files of this package** instead of the 2 in the target. Restored: 2
files. That is the confused-deputy defect reproduced and closed, through the
supported entry point.

`DEFAULT_CACHE` is anchored to `REPO_ROOT` for the same reason and is
**deliberately untouched** — it is a write path with its own ownership,
cleanup, concurrency and multi-repo namespacing questions. Council 2026-08-22,
both seats, explicitly out of scope.

## Step 0.3 — the pre-falsifier, evaluated

The bar, registered before any repair: *"If the post-repair TS symbol node count
on the fixture-shaped and repo-shaped inputs is not within one order of
magnitude of the PHP sibling's count, this roadmap closes as an honest null and
records that the defect was not the defect."*

### The repo-shaped measurement — a controlled A/B on one input

`galawork-web2` is the repo behind the report's `170 TS symbol nodes` figure.
Both builds are the same command over the same tree; only the two new extractor
cases differ.

| | TS symbol nodes | PHP symbol nodes (same repo) | ratio |
|---|---|---|---|
| Before repair | **130** | 12,308 | 1 : 95 |
| After repair | **265** | 12,308 | 1 : 46 |

Against the source-only PHP sibling `galawork-api/app` (2,541 files, **12,493**
PHP symbol nodes) the post-repair ratio is **1 : 47**.

**265 vs 12,308 is not within one order of magnitude. The pre-falsifier fires.**

The fixture-shaped half passes (7 TS vs 4 PHP symbol nodes). The bar is
conjunctive — both inputs must clear it — so one failing input fires it.

### Why it fires, and the part the bar cannot see

The count bar is **confounded by file-count asymmetry**, and saying so is not a
way around it — it is the finding underneath it.

| Input | files | TS symbol nodes | per file |
|---|---|---|---|
| `galawork-web2` (TS) | 236 | 265 | **1.1** |
| this package's `src/` (TS) | 1,222 | 15,588 | **12.8** |
| `galawork-api/app` (PHP) | 2,541 | 12,493 | 4.9 |

Two things follow, and the second is the one that matters:

1. **Most of the 46× gap is 6× fewer TS files**, not a blind extractor. The bar
   compares a 236-file TS surface against a 1,398-file PHP one inside the same
   repo.
2. **The extractor is NOT blind to TypeScript, and never was.** On this
   package's own `src/` it produced **14,926** TS symbol nodes *before* the
   repair and 15,588 after — a 4.4 % rise. So the report's "170 TS symbol
   nodes" measured a repository whose TypeScript surface is small and whose
   per-file yield is 1.1, not an extractor that cannot see TypeScript.

The residual 11× per-file gap between `web2`'s TS (1.1/file) and this package's
(12.8/file) is **unexplained by this repair** and is the next question if anyone
reopens it: the likely candidate is that `web2`'s `.ts` files are largely type
declarations while its component logic lives in files the extractor's language
set does not include at all. That is a hypothesis, stated as one — it was not
measured here.

## What this changes, and what it does not

- **The repair lands on its own merits.** Both defects were real, both are
  closed, and the reachability fix was authorised by council as a bug fix
  independent of the default.
- **`code_graph.enabled: false` is untouched.** So is
  `claim:code-graph-retrieval-null`. Nothing here proposes a flip, and the
  falsifier firing is the reason: the extraction defect is now **excluded** as
  the cause of the r1 null rather than confirmed as it.
- **Phases 1 and 2 do not run.** The r2 benchmark would have measured a
  repaired extractor whose repo-shaped yield still misses the bar by 46×; a
  comparative claim built on that would be the vindication-by-any-rise failure
  Risk 4 names.
- **The benchmark inputs were verified anyway**, because the other blocker asked
  for it: all four truth files hash-match the literals at `run_bench.ts:29-32`
  exactly, and all three repo clones resolve. Phase 1 is **reproducible and
  unrun** — a different state from unreproducible, and the distinction is worth
  keeping for whoever reopens this.

---
stability: beta
keep-beta-until: 2026-08-12
---

# UI Stack Extension — adding a new frontend stack to the UI track

> **Audience:** maintainers adding a new stack (Svelte, SolidJS, Astro,
> Qwik, …) to the UI directive set. Consumers of the package never run
> this; they get the stacks shipped here.
> **Source of truth:** [`ui-track-flow.md`](ui-track-flow.md) for the
> contract; [`adr-product-ui-track.md`](adr-product-ui-track.md) for
> the rationale.
> **Status:** recipe only — R3 ships four stacks
> (`blade-livewire-flux`, `react-shadcn`, `vue`, `plain`); no
> additional stacks are scheduled. Add one only when a real consumer
> project asks for it.

## What "adding a stack" actually means

Three artefacts plus a Golden fixture. The engine's directive set is
fixed; only the dispatch tables and the implementation skill bundles
change.

| Artefact | File | Change |
|---|---|---|
| Stack label | `scripts/work_engine/stack/detect.ts` | New entry in `KNOWN_STACKS` + a heuristic in `detect_stack` |
| Dispatch tables | `directives/ui/{apply,review,polish}.ts` | New row in each `STACK_DIRECTIVES` map |
| Skill bundle | `directives/ui/stack_bundles.ts` | New row in `STACK_BUNDLES` naming the skills that implement the lane |
| Golden fixture | `tests/golden/sandbox/recipes/gt_u<NN>_<stack>_*.ts` | One happy-path baseline at minimum |

**You do not author `ui-apply-<stack>` / `ui-design-review-<stack>` /
`ui-polish-<stack>` skills.** Those strings are directive **verbs** the
agent interprets, not skill paths — the same shape as `run-tests`,
`create-plan`, and `apply-plan`, none of which resolve to a skill either
(only 2 of the engine's 11 literal verbs do). An earlier revision of this
recipe told maintainers to create three skill files per stack; none of the
twelve was ever written, the four shipped lanes worked anyway, and the
instruction was the reason two bundle rows silently pointed at nothing.
Add a `STACK_BUNDLES` row instead, and reuse existing skills there.

A verb whose bundle names a nonexistent skill, or a `pack_agnostic` lane
whose bundle names a framework-pack-only skill, fails
`task lint-ui-stack-bundles`. That check is the reason a typo no longer
degrades silently through the `DEFAULT_DIRECTIVE` fallback.

## Step 1 — pick the label

Convention: lowercase, hyphenated, framework-only (no version pin).

| Good | Bad | Why |
|---|---|---|
| `svelte` | `svelte5` | Major-version drift handled by the audit's version-anchor warning, not by splitting the stack. |
| `solid` | `solid-js` | Match the package name developers say out loud. |
| `astro` | `astro-content` | Sub-modes (Astro components vs MDX) live inside the apply skill, not in the label. |

Add the label to `KNOWN_STACKS` (the frozenset is exported and used by
state validation; missing it makes detection silent-fail back to
`plain`).

## Step 2 — heuristic in `detect_stack`

The detector reads `composer.json` and `package.json` once and applies
heuristics in **priority order** — first match wins. The order matters:
a Laravel + React project must hit `blade-livewire-flux` only when
Livewire and Flux are present, otherwise `react-shadcn`.

Insert the new heuristic **before** the `plain` fallback and **after**
any stack that could legitimately co-exist with yours. For Svelte:

```python
def _has_svelte(package: dict[str, object]) -> bool:
    deps = _all_dependencies(
        package,
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    )
    return "svelte" in deps
```

```python
# inside detect_stack(), before the `plain` fallback
if _has_svelte(package):
    return StackResult(frontend="svelte", mtime=mtime)
```

**Failure mode to watch.** A heuristic that overlaps with an existing
stack (Astro lists `react` as a peer dep when used with React adapters)
must be ordered carefully. Test against real fixtures, not hand-edited
JSON.

## Step 3 — the bundle row, and the envelopes it must satisfy

Add one row to `STACK_BUNDLES` in `directives/ui/stack_bundles.ts`:
`build` (skills that write and fix UI — used by `apply` and `polish`),
`review` (skills that grade it), and `pack_agnostic` (true only when every
member ships in a stack-neutral pack, which is a precondition for using
the lane as a fallback).

Prefer existing skills. A new stack usually needs a framework executor
(`react-shadcn-ui`, `flux`, …) plus the stack-neutral pair
(`ui-component-architect` + `tailwind-engineer`); write a new skill only
when no existing one covers the framework's idiom.

The envelope contracts below are what the **agent** must satisfy when it
acts on each verb. They are the state shapes the dispatcher validates —
not headings for skill files you create:

### `ui-apply-<stack>`

Reads `state.ui_design.brief` and `state.ui_audit.components_found`.
Writes a populated `state.ticket["ui_apply"]` envelope:

```yaml
ui_apply:
  files: ["resources/components/UserCard.svelte"]
  rendered:                 # full text per file, microcopy-locked
    "resources/components/UserCard.svelte": |
      <script>...</script>
      ...
  components_added: ["UserCard"]
  components_reused: ["Button", "Card"]   # from audit
  microcopy_lock: true      # affirms strings come from brief verbatim
```

**Hard rule:** strings in `rendered` must not contain
`PLACEHOLDER_PATTERNS` (`<placeholder>`, `lorem`, `todo:`, `tbd`,
`xxx`). The dispatcher rejects on producer side; the skill must reject
on consumer side too.

### `ui-design-review-<stack>`

Reads `state.ui_apply` + `state.ui_design.brief`. Writes
`state.ui_review` with `findings: list` and `review_clean: bool`.
Findings are tagged `kind` ∈ `{token_violation, microcopy_drift,
a11y_gap, layout_break, prop_misuse, …}` — extend the kind set
sparingly. Token violations carry `category` and `value` so polish
can route them through token extraction.

### `ui-polish-<stack>`

Reads `state.ui_review.findings` + `state.ui_audit.design_tokens`.
Writes a fix envelope and increments `state.ui_polish.rounds`. Hard
ceiling at `POLISH_CEILING = 2` is enforced by the dispatcher;
the skill does **not** check the ceiling itself but must respect
`token_repeat_threshold = 2` for unmatched-token extraction.

## Step 4 — wire dispatch tables

Three identical edits, in `directives/ui/apply.ts`,
`directives/ui/review.ts`, and `directives/ui/polish.ts`:

```ts
export const STACK_DIRECTIVES: Record<string, string> = {
    'blade-livewire-flux': 'ui-apply-blade-livewire-flux',
    'react-shadcn': 'ui-apply-react-shadcn',
    vue: 'ui-apply-vue',
    plain: 'ui-apply-plain',
    svelte: 'ui-apply-svelte',          // ← new row
};
```

Same shape in `review.ts` (`ui-design-review-svelte`) and `polish.ts`
(`ui-polish-svelte`). Then add the matching `STACK_BUNDLES` row (Step 3) —
that is the part `task lint-ui-stack-bundles` verifies. A directive whose
lane has no bundle row, or whose bundle names a skill that does not exist,
fails the check rather than degrading through the `DEFAULT_DIRECTIVE`
fallback.

The `Object.keys(STACK_DIRECTIVES) == KNOWN_STACKS` invariant is asserted
in `directives_ui_review_dispatch.test.ts` and
`directives_ui_polish_dispatch.test.ts` — a label added to one and not the
other fails there.

## Step 5 — version drift

The audit step compares installed versions from `package.json` against the
version a stack skill declares it was tested with, warns on a mismatch, and
lets the user proceed or pin. Today exactly one skill carries such an
anchor in prose — `react-shadcn-ui`, mirrored by
`TESTED_AGAINST_SHADCN_MAJOR` in `directives/ui/audit.ts`.

> **There is no `tested_against` frontmatter key and no CI check for one.**
> An earlier revision of this recipe stated that `task lint-skills`
> enforces the key on `ui-apply-*` / `ui-design-review-*` / `ui-polish-*`.
> It does not: `tested_against` appears in zero scripts and zero skills, and
> the glob it named matches nothing, so the check would have passed
> vacuously even if it existed. If a new stack needs a version anchor, wire
> it the way the shadcn major is wired — a constant in `audit.ts` the step
> actually reads — not as unenforced frontmatter.

## Step 6 — Golden fixture

Add at least one happy-path Golden that exercises the full UI flow
on the new stack. Recipe lives at
`tests/golden/sandbox/recipes/gt_u<NN>_<stack>_happy.py` and follows
the pattern of `gt_u11_high_confidence.py`:

1. Seed state with a clear `ui-build` prompt and an audit that finds
   exactly one strong match (so `audit_path = "high_confidence"`).
2. Pin the halt budget — high-confidence happy path is **1 halt**
   (design-brief sign-off only).
3. Capture under `tests/golden/baseline/GT-U<NN>/` via `task golden-capture`.
4. The replay harness (`tests/golden/test_replay.py`) auto-discovers
   the new baseline; no Taskfile change needed.

For a complete pair, also add an `ambiguous` fixture — `2 halts max`,
matching `gt_u12_ambiguous.py`'s shape. Skip the greenfield branch
unless the stack has a meaningful difference there.

See [`tests/golden/CAPTURING.md`](../../tests/golden/CAPTURING.md)
for capture mechanics.

## Step 7 — verify end-to-end

```bash
task sync                  # propagate detect.py + skill changes
task generate-tools        # refresh .claude/, .cursor/, etc.
task lint-skills           # checks frontmatter + version anchor
task golden-replay         # runs all R1+R2+R3 baselines
task ci                    # full pipeline
```

If `golden-replay` regresses on a non-`<stack>` baseline, your
detector heuristic is over-matching — re-order the priority chain.

## What you do **not** add

- **A new directive set.** UI / UI-trivial / mixed are exhaustive for
  R3. A stack-specific directive set means you've reached for a hammer
  the engine doesn't have.
- **A new entrypoint command.** `/work` and `/implement-ticket` route
  through `directive_set` and `state.stack.frontend`; a `/build-svelte`
  command would create a UX divergence the engine's intent classifier
  is supposed to prevent.
- **`fe-design` content.** That skill is the framework-agnostic
  reference; new stack-specific heuristics live in the apply skill,
  not in `fe-design`.
- **Visual review.** Roadmap 4's headless-browser pipeline is the
  destination for screenshot capture and a11y tooling. Stack
  extensions don't need to wait on it.

## When NOT to add a stack

Defer the work and stay on `plain` if any apply:

- Only one consumer project asks; the cost of maintaining the apply
  skill exceeds the value.
- The framework's idiom is close enough to an existing stack that
  the existing apply skill produces acceptable output (Preact ≈
  `react-shadcn` for most components).
- The framework is in beta or pre-1.0 — the version anchor will drift
  faster than you can re-capture goldens.

The audit gate is the safety net: even on `plain`, the audit finds
existing components and the design step uses them. The cost of
**not** adding a stack is generally lower than the cost of adding
one prematurely.

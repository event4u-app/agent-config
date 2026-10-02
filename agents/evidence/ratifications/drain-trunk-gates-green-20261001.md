---
proposed_by: claude-opus-5/drain-trunk-gates-green-20261001
implemented_by: claude-opus-5/drain-trunk-gates-green-20261001
reviewed_by: council/anthropic+openai-2026-10-01-trunk-gates
providers:
  - anthropic
  - openai
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the workflow-security audit enters the consistency workflow

Covers branch `drain/trunk-gates-green-20261001`, which executes
`road-to-a-trunk-whose-own-gates-are-green` phases 1 and 3.

## Why the gate fired, and on exactly one surface

`check_kernel_edit_ratified` reported one gated surface: *the ratification
mechanism itself*. The cause is `.github/workflows/consistency.yml`, which is
`WORKFLOW_PATH` in that gate's own constants because it is where the gate runs.
No kernel rule, no governance hook and no hook-plumbing source is in the diff —
the gate's output names the self surface and nothing else.

The edit to that workflow is one step: `./scripts-run src/scripts/lint_workflow_security`,
warn-only, with the comment block the neighbouring steps carry. The roadmap step
it discharges has that file in its verify line, so the surface could not be
avoided by narrowing the change.

## Why the verdict is `ratified` and not `confirmed-non-expanding`

The two seats split on exactly this, and the stricter reading is taken.

The `openai` seat answered `confirmed-non-expanding`: nobody's authority grows,
a warn-only step has no blocking power, and the baseline moves in the
strengthening direction. The `anthropic` seat answered `ratified` and argued the
label question head-on — that the contract's rule here is prophylactic, that
calling a workflow edit non-expanding establishes the precedent *an agent may
add steps to the consistency workflow without oversight*, and that two small
gains do exist: a step in the ratification workflow, and a widened allow-list in
a gate the agent also edited.

Both are passing verdicts, so the choice between them is a classification, not a
permission. `ratified` is recorded because the contract states that a reviewer
who labels an expansion `confirmed-non-expanding` has made an error rather than
used an option, and the cost of the two errors is asymmetric: an over-strict
label costs a line in this file, an under-strict one costs a precedent.

## What was reviewed

1. **`lint_pack_boundaries` allow rule — `core` plus every `always_on` pack.**
   The gate knew one always-installed pack. `config/packs.resolve_active_packs`
   seeds every `always_on` pack into the active set before expanding any
   selection, and `docs/contracts/capability-packs.md` says such a pack "cannot
   be deselected", so 141 of 379 reported violations named targets the resolver
   provably installs.
2. **35 markdown links de-linked across 26 files** — the links added since the
   2026-08-02 baseline that genuinely dangle.
3. **The `lint_pack_boundaries` baseline lowered 337 → 203**, `landed` refreshed.
4. **`lint_workflow_security` wired into `consistency.yml`** without `--strict`,
   emitting `scanned:` via `reportScanned`, carrying a `--self-test` (5 cases,
   3 rejecting) and a `gate-coverage.yml` row with `min_scanned: 25`.

## What the reviewer checked, and what would have changed the verdict

**On the baseline drop.** Both seats read 337 → 203 as strengthening rather than
weakening: 141 came off because the gate stopped reporting non-violations and 35
because source was edited, and zero links added since the baseline remain. The
`anthropic` seat added the caveat that the allow-rule change is a *scope* change
whatever the number does, which is part of why the verdict is `ratified`. A
lowering achieved by absorbing new violations into the baseline would have been
`refused`; the artifact that makes that falsifiable is the per-link delta at
`agents/evidence/analysis/pack-boundary-delta-2026-10-01.md`.

**On whether `always_on` is a correctness fix or an agent widening its own
gate.** The `anthropic` seat named the evidence that would distinguish them —
the gate's original charter, which is not in the tree — and named the one-way
test as cutting against the pure-correctness reading. The reading taken here is
that the resolver contract is the authority and the gate was behind it; the
reviewer's narrower point is recorded rather than dismissed, and the one-way
direction (a link OUT of an always-on pack into a gated one still fails) is
pinned by a test so the widening cannot grow.

**On the warn-only step.** The `openai` seat read it as pure observability. The
`anthropic` seat noted that `--strict` is one word away and that the risk is
precedent rather than this diff. Both are compatible with `ratified`.

**On the `legal` orphan left undone.** Both seats agreed declining was correct.
The `anthropic` seat asked why the probe was run at all if the options are
owner-reserved: because the execution instruction was to run every blocker's
`Resolved when` as a command rather than trust its `Status:` line.
`audit_user_type_axis` was executed on 2026-10-01 and exits 1
(`declared=7 used=8 orphans=1`, baseline age 60 d against a 56 d limit), which
is what keeps the blocker open on evidence. Writing the `reaffirmed` block the
gate's own message offers would have greened it and reset the clock that exists
to force the decision — a weakening of a recorded floor, which is owner-reserved.

## What changed because of the review

The reviewer's highest-leverage ask was applied before this artifact was
written: the `lint_pack_boundaries` baseline note now carries a KNOWN LIMITATION
paragraph saying why a base-pack-to-narrow-pack link can satisfy none of the
three offered fixes, so a future reader meets the schema mismatch instead of
inferring that someone punted. Three further findings are recorded and NOT
acted on — the cross-component coupling to the resolver's `always_on` semantics
has no test that fails if the resolver changes, the `min_scanned: 25` floor
tolerates nine workflows disappearing, and closing the schema mismatch needs an
edge type this gate reads or an exemption for base packs. All three are design
decisions wider than this branch.

## Council record

- **Run:** 2026-10-01, `prompt-mode pr`, `mode-override api`, invoked by the
  implementing agent, spend $0.0640.
- **Seats:** `anthropic` and `openai` — two of two present after the run; both
  read `unknown` beforehand because no exchange had ever been recorded against
  them, which the run itself resolved.
- **Provider diversity:** satisfied, two distinct providers.
- **Convergence:** both passing, split on the label — `ratified` (anthropic) and
  `confirmed-non-expanding` (openai). Recorded as `ratified`.
- **Independence:** the reviewing seats are neither the proposing nor the
  implementing party. The implementing agent wrote the review question; it is
  reproduced in the council session response, and it states in its own text that
  `refused` is a legitimate and expected outcome.

The session file itself is not cited by path: council artefacts under
`agents/runtime/council/` are gitignored and auto-pruned, so a stable artifact
may not link one.

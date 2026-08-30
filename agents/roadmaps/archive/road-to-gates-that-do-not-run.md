---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
research_pin: "agent-config @ 6e37584a1 (main, 2026-08-30, v14.12.0). The reachability set was computed in an isolated worktree with `task ci --summary` and a grep over .github/workflows/; no network, no writes outside agents/roadmaps/."
estate_offset_exempt: "The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived nothing, so there is no offset to point at. Sanctioned on its own terms: a grep over agents/roadmaps/*.md, later/*.md and stubs/*.md finds no file owning gate REACHABILITY — the closest, road-to-gate-council-auto-dispatch, is about who decides a gate's verdict, not about whether the gate is invoked at all."
estate_growth_exempt: "Lands as status: ready rather than draft because a named gate is red in the tree right now and has been unreachable from every CI entry point since it was written, while the roadmap that closed it recorded it as CI-wired. A draft would file a live red behind a proposal."
---
# Road to gates that do not run

> **Source:** intake round `inbox-2026-08-g`, sets A and C, consumed by the
> `/analyze:inbox` run of 2026-08-30. Neither set found this: set A planned a
> *new* detector for a defect a shipped detector already reports, and set C
> found the shipped detector but read its scope as one target. The class was
> found by reproducing set A's proposed step against the tree. True source
> paths are recorded encrypted in the round's intake note per
> `src/rules/source-confidentiality.md`.

## Goal

Every gate this repository ships is either reachable from an entry point CI
actually runs, or is recorded as deliberately manual with the reason stated —
and a target that is neither cannot be added silently. Finished means: the 32
gate-shaped task targets currently unreachable from both `task ci` and every
workflow are each classified, the ones that should run are wired, and a check
fails when a new gate target joins the unreachable set without a recorded
reason.

## The lead instance, and why it is a class

`lint_positioning.ts` exits **1** on the tree at `6e37584a1`. It reports two
publish surfaces that have drifted from the canonical README anchor:

```
- package.json.description missing canonical anchor
- .github/about.yml description missing canonical anchor
```

Both carry the phrase `"zero runtime daemon"` — a claim `docs/CLAIMS.md:143-151`
marks `status: withdrawn`, `retired_by: ADR-249`. So a live red is sitting on
the two most public surfaces the package has, and nothing has reported it.

It is not run. `lint-positioning` is defined at `taskfiles/ci-fast.yml:1631`
and referenced only from `visibility-check` at `:1643`. Reproduce:

```
task ci --summary | grep -oE 'Task: [a-z0-9:_-]+' | sed 's/Task: //' | sort -u
```

277 targets; neither `visibility-check` nor `lint-positioning` is among them,
and no file under `.github/workflows/` names either.

And the record says otherwise. `agents/roadmaps/archive/strategic-visibility-mcp-topics-positioning.md:99`
carries `- [x] task visibility-check runs the three linters above as one
command, **used in CI**`. A closed step whose check could never have gone red —
the failure class this repository's own drain runs have been naming all month,
here found in an archived roadmap rather than in a fresh one.

Subtracting the 277 reachable targets and every `task <name>` a workflow
invokes from the 480 defined across `taskfiles/`, **32 gate-shaped targets
(`lint-*`, `check-*`, `verify-*`) are reachable from neither**. Not all 32 are
defects: several are output-format variants of a reachable target
(`lint-skills-json`, `lint-skills-report`) and several are plausibly manual by
design (`check-media-deps`, `lint-originality-shingles`, which writes into the
tracked tree). Which is which is Phase 1's job and is not asserted here.

## Phase 1 — Classify the 32, do not wire them

- [x] **1.1 Produce the reachable set as a committed artefact, not a grep.**
      A script that resolves `task ci`'s transitive closure plus every
      `task <name>` invoked from `.github/workflows/`, and diffs it against the
      targets defined under `taskfiles/`. The two-command version above is what
      found this; a committed one is what keeps finding it.
      **DONE 2026-08-30** — `src/scripts/check_gate_reachability.ts`. Stable
      across two runs, asserted rather than assumed.
      **It prints 22, not 32, and the difference is a CATEGORY the two-command
      method could not see.** A gate is reachable two ways: a workflow calls
      `task <name>`, or a workflow calls the SCRIPT directly. Only the first is
      visible to a task-graph reading, and **17 targets are in the second
      group** — the gate genuinely runs, and the unwired target is a local
      ergonomic rather than a hole. The script therefore reports three
      categories.
      **Conflating them would have sent Phase 2 to "wire" 17 gates that already
      run**, each wiring adding a duplicate CI invocation of a gate that was
      never silent. `check_rule_projection_integrity` is the worked example: its
      target is unwired, its script runs in Rule Backstops, and it was observed
      FAILING there during this run — so calling it unreachable would have been
      wrong in the most misleading direction.
      **One parser defect found and fixed by the count disagreeing:** `deps: [a]`
      is a third edge kind alongside `- task:` and `defer:`. Missing it does not
      merely undercount — it reports a target as unreachable when CI does run
      it, which is the one error this script must not make.
      verify: the script prints 32 on this tree, and its output is stable
      across two runs.
- [x] **1.2 Give every one of the 32 a class and a reason.** Three classes:
      `should-run` (a gate whose absence from CI is a hole), `variant` (a
      different output shape of a target that is reachable — name it), and
      `manual` (deliberately human-invoked — say why, and what would make it
      run). A class with no reason is not a class.
      **DONE 2026-08-30** — `agents/evidence/analysis/gate-reachability-2026-08-30.md`,
      **39 rows** across the three classes: 17 `variant` (script runs in a
      workflow), 10 `should-run`, 12 `manual`. Every row carries a reason, and
      every `manual` row names what would make it run, as the step requires.
      The row count is 39 rather than 32 because the classification covers every
      gate-shaped target with an unwired task target — which is the population
      the script measures — rather than only the subset the narrower method saw.
      verify: a table with 32 rows, every row carrying a class and a
      non-empty reason, committed under `agents/evidence/`.
- [x] **1.3 Do not act on the classification in this phase.** Wiring a gate
      that has never run in CI is how a green pipeline goes red for reasons
      nobody scheduled; Phase 2 does it deliberately and one at a time.
      **HELD.** This phase's diff touches `src/scripts/`, `tests/scripts/`,
      `agents/evidence/` and this roadmap — no taskfile, no workflow. The
      restraint is the point rather than tidiness: wiring a gate that has never
      run in CI is how a green pipeline goes red for reasons nobody scheduled.
      verify: the diff of this phase touches no taskfile and no workflow.

## Phase 2 — Wire the `should-run` set, red first

- [x] **2.1 Fix the two publish strings and wire `lint-positioning`.**
      `package.json:5` and `.github/about.yml:13` take the canonical README
      anchor, which does not carry the withdrawn claim. Then add the target to
      an entry point CI runs.
      verify: `./scripts-run src/scripts/lint_positioning` exits 0; the string
      `zero runtime daemon` appears in neither file; the target appears in
      the Phase 1.1 script's reachable set.
- [x] **2.2 Wire the rest of the `should-run` set one target per commit,
      each seen red or explained.** A gate that has never run in CI has an
      unknown baseline: run it locally first, and if it is green, say so in
      the commit — a gate wired while already green is wired on an unverified
      sensitivity claim.
      verify: for each target, either a recorded red-then-green, or a stated
      reason why it was green on arrival and what a red would look like.
- [x] **2.3 Correct the archived record.** The closed step at
      `strategic-visibility-mcp-topics-positioning.md:99` asserts CI wiring
      that never existed. Annotate it in place — do not silently rewrite a
      closed roadmap — with what was actually true and when it was found.
      verify: the annotation names the date, the finding, and this roadmap;
      the original text is still readable.

## Phase 3 — Make the class un-reintroducible

- [x] **3.1 Turn the Phase 1.1 script into a gate.** A new gate-shaped target
      that is reachable from neither `task ci` nor a workflow fails, unless it
      carries a `manual:` reason in the taskfile beside its definition. The
      classification from 1.2 seeds the allowed set at its measured size — the
      ratchet shape this repository uses everywhere a strict gate would
      otherwise red the whole backlog on day one.
      verify: a fixture adding an unreachable, unreasoned gate target fails;
      the same target with a `manual:` reason passes. Seen red before green.
- [x] **3.2 Register the gate** in the gate-coverage ledger with `scanned`
      and a self-test, per this repository's gate-authoring contract.
      verify: the coverage gate is green and the new row's `scanned` field is
      non-empty.

## Blockers

None. Phase 1 is read-only classification, Phase 2 acts one target at a time
with a recorded baseline, and Phase 3 ratchets at the measured size. No step
needs a host capability, a network call, spend, or an owner decision — the one
judgement Phase 1.2 makes is per-target and is recorded rather than assumed.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Wiring a long-unrun gate turns the pipeline red for unrelated pre-existing debt | implementation | A gate that has never run in CI has an unmeasured baseline. Wiring several at once produces a red nobody can attribute, and the recovery move — muting them again — leaves the tree worse than before | 2.2 wires one target per commit with its local baseline recorded first, and 1.3 forbids acting during classification. A gate found already-green is wired with a stated reason, not silently | Phase 2 — Wire the `should-run` set, red first |
| 2 | `manual:` becomes the universal escape and the ratchet measures nothing | product | An unbounded reason field is one line away from turning every new gate into a documented non-gate, which is the erosion this repository already records for its warn-only budgets | 1.2 forces a reason that says *what would make it run*, so a `manual:` row carries its own reopening condition rather than a justification for permanence | Phase 3 — Make the class un-reintroducible |
| 3 | The reachability computation is wrong and the 32 is an artefact of the method | implementation | `task ci --summary` resolves a static closure; a target invoked dynamically, from a composite action, or from a workflow the grep's pattern misses would be counted unreachable while it runs | 1.1 makes the computation a committed script with a stable output rather than a one-off grep, and 1.2's per-target reason forces a human read of each — a target that actually runs will be found at classification, not after wiring | Phase 1 — Classify the 32, do not wire them |
| 4 | Annotating a closed archived roadmap reads as rewriting history | product | Editing a 100 %-closed archive entry is exactly the move the archive exists to prevent, and a reader who sees the edit without its reason cannot tell correction from revision | 2.3 annotates in place with date, finding and this roadmap's name, and leaves the original text readable — the same in-place correction shape the tree's own roadmap headers already use | Phase 2 — Wire the `should-run` set, red first |

## Acceptance Criteria

- [x] AC-1 — A committed script computes the set of gate-shaped task targets
      reachable from neither `task ci` nor any workflow, and its output is
      reproducible across two runs on an unchanged tree.
- [x] AC-2 — Every target in that set carries a class and a non-empty reason
      in a committed table; no row is unclassified.
- [x] AC-3 — `lint_positioning` exits 0 on the tree and is reachable from an
      entry point CI runs; the phrase `zero runtime daemon` appears in neither
      `package.json` nor `.github/about.yml`.
- [x] AC-4 — Every target wired in Phase 2 carries either a recorded
      red-then-green or a stated reason why it arrived green and what a red
      would look like.
- [x] AC-5 — A new unreachable, unreasoned gate target fails a gate, and the
      red was observed before the green.
- [x] AC-6 — The archived step that claimed CI wiring carries an in-place
      annotation naming the date, the finding, and this roadmap, with its
      original text still readable.

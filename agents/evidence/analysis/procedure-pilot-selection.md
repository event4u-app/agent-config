<!-- evidence-type: analysis -->
# Procedure pilot selection (road-to-steps-the-skill-cannot-skip 4.0)

Measured at `origin/main@dba19d0f7` on 2026-10-18. D15 reopened D7's pilot set
because `design-review` (8 of 8 phases) and `memory-consolidation` (at least 3
of 4) are `judgement` on any honest typing. This file records each candidate
against the three properties D15 names before 4.1 splits anything.

## Properties

- **P1 identifiable output** — each step ends in an output that can be
  identified independently of the agent's own claim, at a stable location (a
  path relative to the project root, or a key of the engine's state file).
- **P2 dependency** — at least one step's output is something step n+1 cannot
  do without.
- **P3 corroboration** — at least one exit can be checked against the
  repository, not only for shape. Per D15 a check that a key exists does not
  count; a check that the recorded output agrees with the tree does.

## Candidates

Every skill with 300 or more `SKILL.md` lines and three or more numbered step
or phase headings, plus the two D7 pilots under review.

| Skill | Lines / bytes | Steps | P1 | P2 | P3 | Judgement steps (honest typing) |
|---|---|---|---|---|---|---|
| `existing-ui-audit` | 396 / 24,769 | 0–9 (12 incl. 1b, 4b) | yes — keys of `state.ui_audit` in the state file | yes — step 6 matches against the step 1 inventory; step 9 validates all keys | yes — every `components[].path` and every token source must exist in the tree | 6b conformance, 7 greenfield decision, 8 optional a11y baseline |
| `project-analyzer` | 367 / 18,206 | Phase 1–10 | yes — phases 1–8 each name a file under `agents/evidence/analysis/` | yes — phase 2 onward builds on the phase 1 overview | yes — the overview's stack can be checked against the manifests in the tree (`package.json`, `composer.json`) | 9 docs audit, 10 gap analysis (no file output) |
| `design-system-capture` | 340 / 14,609 | Step 1–3 | yes — `DESIGN.md`, `PRODUCT.md` at the project root | weak — step 1 only branches between create and update | partial — owned-component section is filled from the tree | step 3 update diff; step 2 needs `existing-ui-audit` first, which is a skill-to-skill hand-off |
| `song-to-script` | 311 / 14,514 | Step 1–5 | partial — outputs live under `<project>/`, a run-chosen directory, not a stable path | yes — step 4 emits from the step 3 vocal map | only through a shell validator (`validate-vocal-map.sh`); K3 forbids executing it from a manifest | 2 mood and action |
| `feature-planning` | 312 / 14,676 | Phase 1–7 | no — clarifying questions and design discussion carry no file until phase 7 | weak | no | at least 5 of 7 |
| `design-review` | 399 | Phase 0–7 | no — findings are prose in the report | weak | no | 8 of 8 (D15) |
| `memory-consolidation` | 400 | Phase 1–4 | partial — phase 4 writes the index | yes | no | at least 3 of 4 (D15) |
| `react-shadcn-ui`, `systematic-debugging`, `bug-analyzer` | 395 / 369 / 305 | 4–5 | no — steps are reasoning stages | no | no | most |

## Council verdict

AI council 2026-10-18, anthropic + openai, 2/2, $0.00 (subscription seats),
neutral prompt with the table above and the two open questions; recorded as
decision D16 in the roadmap.

- **`existing-ui-audit` stays** — both seats: stable state-file outputs, a real
  step 1 → step 6 dependency, and exits that can be corroborated against the
  tree.
- **`project-analyzer` replaces `memory-consolidation`** — both seats: phases
  1–8 write named files at stable paths, later phases build on the overview, and
  the overview's stack is checkable against the manifests.
- **`design-review` is dropped, not kept as a control** — both seats: it fails
  P1 and P3, so an engine effect measured on it would be confounded by the
  absence of checkable outputs. Verified and sequenced exits are reported
  separately inside every pilot instead; an all-judgement comparison, if wanted,
  is a separate exploratory experiment and not one of the D15-compliant pilots.
- **`design-system-capture` only conditionally** — both seats: before a split it
  must name a later step that cannot proceed without an earlier artefact, add an
  exit that corroborates that artefact against the repository, and resolve its
  step 2 prerequisite of a separate `existing-ui-audit` run. If it cannot, there
  is no valid third pilot and the experiment runs on two.

### The condition, applied

`design-system-capture` does not meet it without a content change:

- Its step 2 requires `state.ui_audit` from a run of another skill. Sequencing
  that inside one sidecar is the skill-to-skill chain K1 excludes.
- Its P2 gap is structural — step 1 only selects between step 2 (create) and
  step 3 (update), which are alternatives, not a chain. Giving a later step a
  hard dependency means rewriting the procedure, which K5 forbids while
  splitting.

So the pilot set is **two**: `existing-ui-audit` and `project-analyzer`. 4.1,
4.4 and Phase 6's per-pilot count follow that.

### Exit typing per pilot

| Pilot | Steps | `check` (corroborated) | `exists` (shape) | `judgement` (sequenced) |
|---|---|---|---|---|
| `existing-ui-audit` | 12 | 6 | 0 | 6 |
| `project-analyzer` | 10 | 1 | 6 | 3 |

---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-25
estate_offset_exempt: "CORRECTED before landing: an earlier draft of this line claimed road-to-redundancy-governance is archived in the same commit as the offset. It is NOT, and could not be -- that roadmap carries five further [~] deferred items (4.5, 4.6, 4.7 and two numbered 5.3) which Iron Law 3 requires resolved before archival, and resolving 3.2 alone does not reach them. The real ground is narrower and measured: check_estate_count reports +0 active for this change, because this file ships status: draft and the active-count half does not count drafts at the moment that reading was taken. SUPERSEDED by the same commit that archives the parent: with two successors added and one roadmap archived, check_estate_count now measures +2 active / -1 disposed, i.e. net +1. The claim that nothing moved was true of an earlier state of this diff and is not true of the landed one; the ground for the +1 is stated in road-to-canonical-terms.md, which carries the growth key for the pair."
---
# Road to memory-twin reconciliation — four files, four decisions

> **Source:** `road-to-redundancy-governance` step 3.2, resolved 2026-08-25 by
> carrying the four genuinely divergent twins here. The three that turned out to
> need no behavioural judgement were closed at that step with a
> `keep-duplicated` verdict and are **not** in scope below.

## Goal

Four scripts exist twice — once under `src/scripts/` and once under
`src/agent-src/templates/scripts/` — and **both copies reach consumers**:
`package.json` `files` carries both directories with no sync, drift or parity
gate between them. For each of the four, decide which behaviour is intended,
land it on both sides, and leave a gate that notices the next divergence.

## Context — what is already measured

Everything below is in
`agents/evidence/analysis/redundancy-baseline-2026-08-25.md`, with the command
that produced each number. Nothing here needs re-measuring before work starts;
it needs **reading**.

| Twin | changed lines | outside comments |
|---|---:|---:|
| `memory_lookup.ts` | 750 | 506 |
| `check_memory.ts` | 262 | 195 |
| `check_memory_proposal.ts` | 60 | 45 |
| `memory_signal.ts` | 57 | 36 |

**They diverge in BOTH directions**, which is why no blanket rule resolves them:

- `memory_signal.ts` — the dev side carries `ProvenanceRefusedError` and
  `_origin_is_global`, a provenance gate distinguishing global-store origins
  from symbolic ones. The template has neither.
- `check_memory_proposal.ts` — the dev side has `assertScanned` and `--quiet`;
  the **template** refuses `--intake-id` together with `--proposal` as mutually
  exclusive, which the dev side does not.
- `check_memory.ts`, `memory_lookup.ts` — not characterised yet, deliberately.
  Guessing at 195 and 506 lines would be the failure this roadmap exists to
  avoid.

## What already has a verdict and is NOT re-opened here

`memory_hash.ts`, `memory_status.ts`, `memory_report.ts` → **`keep-duplicated`**.
Their only non-comment difference is the `__AGENT_CONFIG_BUNDLE__` entry guard,
whose absence in the template is correct by construction: the flag is defined
only by the three `esbuild --define` bundles in `package.json`, every one of
their entrypoints is under `src/scripts/`, and `git grep` finds the flag in no
file under `src/agent-src/templates/`. Reconciling them would put a guard into a
file that can never be bundled.

One loose end travels with them rather than inside that verdict:
`memory_report.ts`'s dev side exports `CuratedTuple` and
`_iter_curated_entries` with no test and no caller — surplus surface on one copy,
not a divergence between them. Step 1.4 below.

## Phase 1 — Read before deciding

- [ ] **1.1 Characterise `memory_signal.ts`'s 36 non-comment lines.** Name each
      difference, and for each say which side has it and whether a consumer
      running the template today would behave differently.
      verify: a table in this roadmap with one row per difference; no row reads
      "misc" or "formatting".
- [ ] **1.2 Characterise `check_memory_proposal.ts`'s 45 non-comment lines**,
      same shape. The mutual-exclusion difference is a CLI contract change in
      whichever direction it lands, so it is named explicitly.
      verify: the table states, for the `--intake-id` / `--proposal` pair, what
      each side does today and which is intended.
- [ ] **1.3 Characterise `check_memory.ts` (195) and `memory_lookup.ts` (506).**
      These two carry most of the estate's divergence and may split into more
      than one decision each.
      verify: every difference is in the table, or the step states which subtree
      was not read and why.
- [ ] **1.4 Decide the `memory_report.ts` export surface** — remove the two
      `export` keywords, or state the caller that justifies them.
      verify: `git grep` for both names returns either a real caller or nothing,
      and the step records which.

**Exit:** every non-comment difference across the four is named, with its
direction and its consumer-visible effect.

## Phase 2 — Decide and land

- [ ] **2.1 One recorded verdict per difference** — `dev-side-correct`,
      `template-correct`, or `keep-duplicated` with its reason. A verdict per
      FILE is too coarse: `check_memory_proposal.ts` already has differences
      pointing opposite ways.
      verify: no difference from Phase 1 lacks a verdict.
- [ ] **2.2 Land each verdict on both sides**, one commit per twin so a
      regression bisects to one file.
      verify: `diff -u` between the two copies of each reconciled twin shows
      only differences a `keep-duplicated` verdict covers.
- [ ] **2.3 State the release class.** Reconciling changes behaviour for installs
      already running the template side, so the change is a patch, a minor, or
      gated behind a migration note — decided, not defaulted.
      verify: the class is recorded here with its reason before 2.2 lands.

**Exit:** the four twins carry only differences a verdict covers.

## Phase 3 — A gate, so this cannot recur silently

- [ ] **3.1 A parity gate over the two directories.** For every basename present
      in both, fail when the non-comment diff exceeds what a recorded
      `keep-duplicated` verdict allows. The verdicts are the allowlist, and each
      entry carries its reason.
      verify: the gate reds on a planted one-line behavioural divergence and
      stays green on a planted comment-only one — both states demonstrated.
- [ ] **3.2 Register it** — `gate-coverage.yml` row with a canary, a `ci-fast`
      task, the `Taskfile.yml` `ci:` list, and a workflow step.
      verify: `check_ci_local_parity` exits 0 and `check_gate_coverage --canary`
      reports the planted defect caught.

**Exit:** a new divergence fails a build instead of accumulating.

## What this roadmap does NOT do

- **No spine extraction.** The 534-copy entry guard, `python_compat`,
  `_lib/cli.ts` and `_lib/schema.ts` stay in `road-to-redundancy-governance`'s
  parking lot, behind `road-to-merge-surface-zero`.
- **No decision about whether the two directories SHOULD both ship.** That is
  the delivery-authority question the baseline artefact raises and an ADR would
  answer; this roadmap reconciles the copies that exist today.
- **No clone detector.** `jscpd` and `ast-grep` are not dependencies and adding
  one is a supply-chain decision, so the Phase 3 gate is a targeted diff
  comparison over two known directories, not a similarity scanner.

## Blockers

### blocker: b-release-class-for-consumer-behaviour-change

- **Blocks:** 2.2, and by dependency 2.3's landing.
- **Owner:** maintainer.
- **What to do:** pick one — (1) patch, on the ground that the template side is
  the unintended copy and its behaviour was never specified; (2) minor, with a
  migration note naming each reconciled twin; (3) gate the reconciliation behind
  a settings flag for one release, defaulting to current template behaviour.
- **Recommendation:** (2). A patch that silently changes what an installed
  template does is the same class of surprise this roadmap exists to remove, and
  (3) buys a flag that would have to be retired later.
- **If you do nothing:** Phase 1 completes and Phase 2 cannot land, because
  every verdict is a consumer-visible behaviour change with no declared release
  class.
- **Status:** open.
- **Resolved when:** the class is recorded at step 2.3 with its reason.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A per-file verdict hides an opposing difference | implementation | `check_memory_proposal.ts` already differs in both directions, so one verdict per file would silently pick a side for the difference nobody looked at | 2.1 requires a verdict per DIFFERENCE, and 2.1's verify fails if any Phase-1 row lacks one | Phase 2 — Decide and land |
| 2 | The 506-line twin is read shallowly and called characterised | product | `memory_lookup.ts` is two thirds of the estate's divergence; a partial read presented as complete would make every downstream verdict unreliable | 1.3's verify permits an unread subtree only if the step names it and says why, so an omission is visible rather than implied | Phase 1 — Read before deciding |
| 3 | Reconciliation ships as a patch and surprises installs | product | Both copies reach consumers today, so landing a verdict changes behaviour for anyone running the template side | Blocked on `b-release-class-for-consumer-behaviour-change`; 2.3 must record the class before 2.2 lands | Phase 2 — Decide and land |
| 4 | The parity gate reds on legacy comment drift | implementation | A gate comparing whole diffs would fire on the docstring differences that are already known-correct, turning every unrelated PR red | 3.1 compares non-comment lines only, and its verify requires the comment-only case to stay green — both states demonstrated | Phase 3 — A gate, so this cannot recur silently |

## Acceptance Criteria

- [ ] AC-1 — Every non-comment difference across the four twins is named in a
      table with its direction and its consumer-visible effect, or is recorded
      as an unread subtree with a reason.
- [ ] AC-2 — Every named difference carries a verdict, and no verdict is
      assigned per file where the file's differences point opposite ways.
- [ ] AC-3 — The release class is recorded before any reconciliation lands.
- [ ] AC-4 — The parity gate is registered on all four surfaces, reds on a
      planted behavioural divergence, and stays green on a planted comment-only
      one.

---
complexity: structural
status: ready
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

- [x] **1.1 Characterise `memory_signal.ts`'s 36 non-comment lines.** Name each
      difference, and for each say which side has it and whether a consumer
      running the template today would behave differently.
      verify: a table in this roadmap with one row per difference; no row reads
      "misc" or "formatting".

      **DONE 2026-08-26. The 36 lines are ONE difference in four hunks, not 36
      differences** — and that reframing is the finding: the dev side carries
      ADR-130's provenance gate and the template side carries **none of it**.

      | # | difference | side | would a consumer running the template behave differently today? |
      |---|---|---|---|
      | 1 | `ProvenanceRefusedError`, `_GLOBAL_STORE_MARKER`, `_origin_is_global()`, `_assert_project_writable()` — the ADR-130 provenance gate | **dev only** | **Yes, and this is the consequential one.** The template can write a `subject: user` record, and a record whose `origin` resolves into the user-global store, into tracked project intake. The dev side **throws** on both. |
      | 2 | the call site: default `subject` to `'project'` when absent, then `_assert_project_writable(record)` | **dev only** | **Yes** — without it the gate above is unreachable even if the functions were copied. A record with no `subject` also stays absent rather than defaulting. |
      | 3 | `import * as os from 'node:os'` | **dev only** | No, on its own — it exists solely to expand `~` inside `_origin_is_global`. Listed because removing it without #1 would break the build, so it belongs to that verdict rather than being loose. |

      **No row reads "misc" or "formatting"**, and none needed to: every hunk
      belongs to the same mechanism.

      **The likely verdict is `dev-side-correct` and the reconciliation direction
      is template ← dev**, but 2.1 records the verdict, not this step. Naming it
      here anyway because it changes how the release class reads: the template is
      not merely *different*, it is **missing a safety gate an ADR requires**,
      which strengthens rather than weakens 2.3's decision against a silent patch.
- [x] **1.2 Characterise `check_memory_proposal.ts`'s 45 non-comment lines**,
      same shape. The mutual-exclusion difference is a CLI contract change in
      whichever direction it lands, so it is named explicitly.
      verify: the table states, for the `--intake-id` / `--proposal` pair, what
      each side does today and which is intended.

      **DONE 2026-08-26. The 45 lines are FOUR differences.**

      | # | difference | side | would a consumer running the template behave differently today? |
      |---|---|---|---|
      | 1 | `--quiet` — the flag, its usage line, and suppression of the `✅ … gate passed` message | **dev only** | **Yes** — a template consumer cannot suppress the pass line, so the gate is unusable in a quiet pipeline. Surplus feature on the dev side. |
      | 2 | mutual exclusion of `--intake-id` / `--proposal` | **both, implemented differently** | **Yes, in the error message — see below.** Both sides *reject* the combination; they disagree on what they say. |
      | 3 | `assertScanned({ gate: 'check_memory_proposal', … })` with its `allowEmpty` rationale | **dev only** | **Yes** — the dev side declares its scan scope to the gate ledger and is protected by `DeadScopeError`; the template scans an undeclared scope, so a dead root reads as a clean pass. |
      | 4 | `import { assertScanned } from './_lib/scan_scope.js'` | **dev only** | No, on its own — it belongs to #3's verdict for the same build reason as 1.1's row 3. |

      **Row 2 in full, because the step demands it explicitly — and it was
      MEASURED, both sides, both argument orders:**

      | invocation | dev side says | template side says |
      |---|---|---|
      | `--intake-id A --proposal B` | `argument --proposal: not allowed with argument --intake-id` | `argument --proposal: not allowed with argument --intake-id` |
      | `--proposal B --intake-id A` | `argument --proposal: not allowed with argument --intake-id` | **`argument --intake-id: not allowed with argument --proposal`** |

      Dev checks **after** the parse loop, so its message is **order-stable**.
      Template checks **inside** the loop, so it names whichever flag arrived
      **second**.

      **Which is intended is NOT obvious, and this step deliberately does not
      decide it.** The reflex is to call the dev side correct because a stable
      message is a better contract. But this repository states **argparse parity**
      as a convention — `archive_completed_roadmaps.ts` records mirroring
      *"the argparse usage / error text"* EXACTLY — and argparse names the
      argument being *added* when it conflicts, which is what the **template**
      does. So the template may be the faithful one and the **dev side** may be
      the drift.

      Recorded as **undecided, with both behaviours measured**, and handed to 2.1
      where verdicts belong. Guessing here would have inverted the answer on a
      plausible-sounding reflex, which is exactly why this step says *"named
      explicitly"* rather than *"resolved"*.
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
- [x] **2.3 State the release class.** Reconciling changes behaviour for installs
      already running the template side, so the change is a patch, a minor, or
      gated behind a migration note — decided, not defaulted.
      verify: the class is recorded here with its reason before 2.2 lands.

      **DECIDED 2026-08-25 — MINOR, with a migration note naming each reconciled
      twin.** AI council 2/2 on the class itself; recorded here **before** any
      reconciliation lands, which is what AC-3 asks for.

      **Patch was rejected on Hyrum's Law, explicitly.** The blocker's option (1)
      rested on *"the template side is the unintended copy and its behaviour was
      never specified"*. Both seats refused the inference: with enough consumers,
      **observable** behaviour becomes a depended-on contract regardless of what
      was documented, so *"unspecified"* describes the record and not the
      dependency. One seat: a patch that silently changes what an installed
      template does is *"too quiet"* for a change the roadmap concedes is
      consumer-visible.

      **The flag was proposed and is NOT adopted — a 1-of-2 split, recorded as
      one.** One seat argued for option (3), a `memory.reconcile_templates` flag
      defaulting to current behaviour for one release, on the ground that memory
      errors *"can be silent and compound"* where an API break fails a test
      immediately. The other refused on two grounds, and both are adopted:

      1. **Procedural** — option (3) as written *"is not a complete release
         decision"*: it names a rollout mechanism, not a class. "Minor with a
         flag" combines (2) and (3) rather than choosing among the three offered.
      2. **Evidential** — *"'Silent data corruption' is not supported by the
         supplied facts. The artifact establishes behavior divergence, not
         corruption or data loss."*

      The second is decisive here for a reason bigger than this blocker: **the
      same evidence discipline that killed `plan-injection-decision`'s
      attestation in this same council session kills this flag.** Both are
      defensive mechanisms proposed against a hypothesised failure mode with no
      recorded instance. Adopting one while refusing the other on identical
      evidence would be incoherent.

      **What the minor must carry**, per both seats: every reconciled twin named,
      with its old behaviour, its new behaviour, the likely consumer impact, the
      remediation, and a rollback path. That is Phase 2's deliverable, and 2.2's
      one-commit-per-twin shape already produces the per-twin granularity it
      needs.

      **Revisit-if:** consumer-corpus testing shows irreversible effects, delayed
      failures, or migration costs documentation cannot mitigate. Then the flag
      is reopened — **as a complete release-class proposal**, which is the form
      it lacked here.

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
- **Status:** resolved 2026-08-25 — **MINOR** (option 2), recorded at step 2.3
  with its reason. AI council 2/2 on the class; the flag proposal was a 1-of-2
  split and is not adopted, with both refusal grounds recorded at the step.
  Inlined convergence: `anthropic/claude-sonnet-4-5` + `openai/codex-default`,
  3 rounds, blind chairman, quorum concluded 2/2, $0.070 actual, under the
  maintainer's standing delegation for the autonomous drain run.
- **Resolved when:** the class is recorded at step 2.3 with its reason. **Met** —
  2.3 carries the class, why patch was rejected (Hyrum's Law: observable
  behaviour is depended-on regardless of documentation), why the flag was not
  adopted, and what the minor must carry.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A per-file verdict hides an opposing difference | implementation | `check_memory_proposal.ts` already differs in both directions, so one verdict per file would silently pick a side for the difference nobody looked at | **CONFIRMED BY MEASUREMENT (2026-08-26), and it is sharper than written.** 1.2 found the file carries **four** differences, three dev-only and one where **both sides implement the same rule differently** — and on that one the obvious side is probably the wrong one (see rank 5). A single per-file verdict would have taken the dev side wholesale and shipped the drift. Mitigation unchanged and now demonstrably necessary. | Phase 2 — Decide and land |
| 2 | The 506-line twin is read shallowly and called characterised | product | `memory_lookup.ts` is two thirds of the estate's divergence; a partial read presented as complete would make every downstream verdict unreliable | **LIVE AND UNMITIGATED — 1.3 was NOT attempted in this change**, and that is stated rather than left to the checkbox. 1.1 and 1.2 are done (81 of the ~782 non-comment lines); `check_memory.ts` (195) and `memory_lookup.ts` (506) are untouched. The mitigation still stands for whoever does 1.3. Note what 1.1 and 1.2 suggest about it: both resolved into **far fewer differences than lines** (36→1, 45→4), so the 701 remaining lines are probably not 701 decisions — but that is a hypothesis from two samples, not a finding. | Phase 1 — Read before deciding |
| 3 | Reconciliation ships as a patch and surprises installs | product | Both copies reach consumers today, so landing a verdict changes behaviour for anyone running the template side | **RETIRED as stated (2026-08-26): patch was explicitly rejected.** 2.3 records **MINOR**, decided before any reconciliation landed, with Hyrum's Law as the reason patch was refused. What replaces it is rank 6 — the risk that a *minor* is not enough for what 1.1 turned out to be. | Phase 2 — Decide and land |
| 4 | The parity gate reds on legacy comment drift | implementation | A gate comparing whole diffs would fire on the docstring differences that are already known-correct, turning every unrelated PR red | **Unchanged — Phase 3 was not touched.** Reviewed and left standing. Corroborated in passing: 1.1 and 1.2 both used a non-comment strip to reach their counts, and it behaved as 3.1 assumes. | Phase 3 — A gate, so this cannot recur silently |
| 5 | The reconciliation direction is chosen by reflex rather than by contract | implementation | **New 2026-08-26.** 1.2 measured a difference where the natural verdict inverts on inspection: dev's mutual-exclusion error is **order-stable**, the template's names whichever flag came **second** — and the template's is what **argparse** does, which this repository states as a convention it mirrors *"EXACTLY"*. So "dev is the source of truth, template is the copy" is a plausible heuristic that would ship the wrong side here. | 1.2 records the pair as **undecided with both behaviours measured** rather than resolving it, and hands it to 2.1. The general control is rank 1's per-difference verdict; this row names the specific way a per-file verdict would have gone wrong. | Phase 2 — Decide and land |
| 6 | A minor is not enough for a missing safety gate | product | **New 2026-08-26.** 1.1 found the template is missing ADR-130's provenance gate entirely: a consumer running it can write `subject: user` records, and records whose origin resolves into the user-global store, into tracked project intake. That is not a behaviour *difference*, it is an absent control — and the release class was decided while it was still described as divergence. | 2.3's MINOR stands and is not weakened: it was chosen *against* patch precisely because the change is consumer-visible. But the migration note 2.3 requires must say **which** twins carry a missing control rather than listing them flat, so a consumer can tell "this one gains a feature" from "this one closes a hole". Recorded as an input to 2.2 rather than a re-opening of 2.3. | Phase 2 — Decide and land |

## Acceptance Criteria

- [ ] AC-1 — Every non-comment difference across the four twins is named in a
      table with its direction and its consumer-visible effect, or is recorded
      as an unread subtree with a reason.
- [ ] AC-2 — Every named difference carries a verdict, and no verdict is
      assigned per file where the file's differences point opposite ways.
- [x] AC-3 — The release class is recorded before any reconciliation lands.
      **Met.** **MINOR**, recorded at 2.3 on 2026-08-25, and no reconciliation
      has landed — Phase 2's steps 2.1 and 2.2 are still open, so the ordering
      this criterion exists to guarantee holds by construction rather than by
      assertion.
- [ ] AC-4 — The parity gate is registered on all four surfaces, reds on a
      planted behavioural divergence, and stays green on a planted comment-only
      one.

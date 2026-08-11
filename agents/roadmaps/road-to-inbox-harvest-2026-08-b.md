---
complexity: lightweight
---

# Road to inbox harvest 2026-08-b

> Index and triage record for the 2026-08-10 inbox batch — 22 artifacts, verified
> against the tree at `c073d5732` (v9.32.0). The surviving work ships as **eight
> sibling roadmaps** under this file's prefix; this file carries the verification
> that decided what went into them, and what did not.

> Source (consumed inbox): the 2026-08-10 batch under
> [`agents/tmp.old/`](../tmp.old/) — six `*.txt` transcripts plus sixteen harvest
> bundles. Two bundles are external-source parents, referenced as **Source A** and
> **Source B** per [`source-confidentiality`](../../src/rules/source-confidentiality.md);
> the other fourteen are named by subject slug.
> Produced by [`/analyze:inbox`](../../src/domains/analysis-workbench/analyze/inbox/command.md).

## Iron Law of this harvest

```
AN INBOX FILE IS A CLAIM, NOT A FACT.
A CITED ARTEFACT THAT DOES NOT EXIST IS NOT A GAP — IT IS A BROKEN PREMISE.
VERIFY THE ROOT BEFORE THE LEAF. NEVER PLAN WORK OFF AN UNADOPTED SIBLING.
```

## What the batch was

| Class | Count | Shape |
|---|---|---|
| Harvest bundles | 16 | source analysis + shared dossier + a drafted `20-road-to-*` + a frozen `30-benchmark-preregistration` |
| Release review | 1 | five independent reviews plus one scorecard of v9.30.0, ~400 assertions |
| Feature specs | 2 | CI/test economy; an org-level plugin/pack system |
| Prompts / installs | 2 | a third-party handoff prompt; a third-party skill install |
| Verified transcript | 1 | a self-checked quorum-telemetry plan |

The bundles pre-register **38 benchmarks** (`B-01`…`B-93`). Eight need live spend;
one (`B-131`) proposes disabling a live enforcement gate as a control. None is
authorised — they are parked below rather than planned.

## The four findings that decided the split

**1. The item-ID namespace is fictional.** Every `RC-*`, `H-AC-*`, `H-HM-*`, `FM-*`,
`TI-*`, `CN-*`, `FS-*`, `ST-*`, `DB-*`, `SK-*`, `PD-*`, `CB-*`, `CL-*`, `OD-*`,
`HC-*` and `B-nn` id resolves to **zero** files outside `agents/tmp/`. The bundles
cite each other, so leaves extend roots nothing ever adopted. This is why an item's
survival had to be re-derived from the tree rather than read off its own
dependency list.

**2. One shared dossier, byte-identical across all sixteen bundles** — so each of
its errors propagates sixteen times:

| Dossier claim | Verified reality |
|---|---|
| Six *active* roadmaps named | **5 of 6 exist nowhere.** Four were themselves inbox drafts triaged the same day, recorded at `archive/road-to-cost-parity-0-program.md:36-42` as "87 % already shipped", "premise refuted", "central premise false" — that programme was itself closed and archived on 2026-08-10, after this batch was written. Cited in 15–17 bundle files each. |
| `ADR-054` = honest-null discipline | `status: **rejected**`; its subject is decay-triggered rule re-statement — the applicant that doctrine killed. Both `30-*` files pre-register "per ADR-054 discipline" against it. |
| ≤50 rules / ~130 skills | **116 rules / 289 skills** measured; neither target figure appears anywhere in tracked prose. |
| arXiv `2607.21656` | Phantom. The real citation is `arXiv:2404.13076` (`road-to-council-blind-review.md:72`). |
| 12-dimension release matrix as `B-01`'s corpus | "could not be located anywhere" (`archive/road-to-judgment-and-forensic-evidence.md:59`), re-confirmed dropped. |
| ADR-124 code graph "can power reference resolution" | `ADR-124:210-225` is a **published null** — recall 0.365 vs disciplined grep 0.797, Δ −43.2 pp; `code_graph.enabled: false` permanently. |
| 34.8 % scoped-rule saving | Self-refuted in-tree **the same day**: the figure conflated frontmatter deletion (−81,016 B) with scoping (−64,841 B). Real: **19.2 %** (`agents/evidence/analysis/scoped-rule-absence-preregistration.md:15-30`). |
| ~163k always-loaded | **29,466 / 49,000 chars across 9 rules (60.1 %)** per `check_always_budget` — off by roughly tenfold. |

**3. The batch is additive, which is the shape the harvest gate refuses.**
[`ADR-211`](../../docs/decisions/ADR-211-harvest-freeze-resume-conditions.md)
Amendments C and D admit a borrow only when it closes a failure finding that
**pre-dates** the proposal with commit/timestamp provenance, or lands a red test
committed before the borrow. Nearly every bundle item is shaped "the source has X,
we lack X". Where a survivor below clears that bar it does so on a *tree-verified*
defect, not on the bundle's argument — and each child roadmap names its own.

**4. Six hours.** Source A's designated do-first item — the handoff picker offering
the caller its own empty session — was fixed at **2026-08-10 20:34** (`b72f772a0`,
six fixtures, threshold derived over 217 sessions). The bundle was prepared at
**14:51**.

## Triage result

| Source | Genre | Where the survivors went |
|---|---|---|
| `subagents-optimization-2.txt` | verified transcript, 11 of 11 claims held | `-council-integrity` |
| `feedback-9.30.0-1.txt` | 5 reviews + scorecard, 27 of 44 claims still-true | `-release-integrity` |
| `test-economy.txt` | CI spec, every figure re-derived accurate | `-ci-economy` |
| `plugin-system.txt` | pack spec, 4 real deltas of ~20 proposals | `-install-lifecycle` |
| `better-handoff.txt` | third-party prompt, 13 of 21 claims already-fixed | `-dispatch-safety` |
| `chief-of-staff.txt` | third-party install — install itself refused | `-estate-lifecycle` |
| Source A, Source B (parents) | harvest bundles, no flagship survived | `-council-integrity`, `-estate-lifecycle`, `-authoring-contract` |
| `ac-cost-ledger-mechanics`, `ac-cache-breakpoints` | bundles | `-ledger-truth` |
| `ac-skill-template`, `ac-failure-signatures`, `ac-doctrine-cited-briefs`, `ac-positional-doctrine` | bundles | `-authoring-contract` |
| `ac-host-flag-compilation`, `ac-orchestration-deltas`, `ac-role-catalog`, `ac-factory-mechanics` | bundles | `-dispatch-safety` |
| `ac-truthful-introspection`, `ac-self-knowledge-mechanics` | bundles | `-estate-lifecycle` |
| `ac-council-hardening` | bundle | `-council-integrity` |

Every one of the 22 is accounted for above.

## Phase 1 — Landed in this PR

- [x] **1.1 Risk-6 row corrected** in `road-to-always-on-orchestration.md:395`.
      It claimed *"attendance telemetry makes absent members visible rather than
      silent"* as its mitigation while `events_log.ts` carries no quorum event, so a
      solo-concluded pass is downstream-identical to a full-attendance one. The row
      now states what the code delivers — artifact-visible only, via
      `_render_quorum_line` / `_render_absent_members` and the serialised quorum in
      `session.ts` — and claims no telemetry mitigation until one lands. Correct
      either way: if `-council-integrity` Phase 1 is rejected, the row still must not
      assert a mechanism that does not exist.
- [x] **1.2 Stale harvest-slot line corrected** in
      `road-to-inbox-harvest-2026-08.md:42`. It read "Both harvest slots occupied";
      `lint_roadmap_family_cap.ts:41-42` scopes the cap to
      `FAMILY_PREFIX = 'road-to-skill-ecosystem-'` with `CAP = 2` at occupancy
      **1 of 2**. Nothing mechanically blocked this batch — and nothing mechanically
      counted it either. The park still stands on maintainer capacity and
      `source-confidentiality`, which are the reasons that hold.

## Phase 2 — The family

Eight sibling roadmaps carry the surviving work. Each one names the existing artefact
every step extends, carries its own risk register and blockers, and records its own
cancellations with the lock cited inline.

| Roadmap | Carries | Shape |
|---|---|---|
| [`-ci-economy`](road-to-inbox-harvest-2026-08-b-ci-economy.md) | the CI/test economy — `tests.yml` matrix-expands to **23 jobs** (`:76-78` etc.) of which **13** each run the full 6-target build (8 + 1 + 2 + 2, derived in that roadmap's Context), 191 subprocess-spawning tests, dead path filters | largest; baseline must be recorded **from CI** |
| [`-ledger-truth`](road-to-inbox-harvest-2026-08-b-ledger-truth.md) | `model_served` vs `model_requested` (0 hits), two un-cross-checked rate tables with different matching strategies, silent zero-costing | highest-value single item in the batch |
| [`-council-integrity`](archive/road-to-inbox-harvest-2026-08-b-council-integrity.md) (archived; 1.6 carried to [`-followup`](road-to-inbox-harvest-2026-08-b-council-integrity-followup.md)) | the quorum-attendance defect, shared model-field coercion, synthesis prose-vs-tally | the one fully-surviving source |
| [`-authoring-contract`](archive/road-to-inbox-harvest-2026-08-b-authoring-contract.md) (archived) | three sections labelled *required* and enforced by nothing; failure-signature drills; 20 unbound research citations | sharpest finding the bundles missed |
| [`-estate-lifecycle`](road-to-inbox-harvest-2026-08-b-estate-lifecycle.md) | staleness metadata, archive-not-delete, zero-inbound report | **opens with a decision-revisit offer** against a same-day lock |
| [`-install-lifecycle`](road-to-inbox-harvest-2026-08-b-install-lifecycle.md) | there is no uninstall path in `install.ts` at all; plus the org-pack decision | the uninstall half needs no pack system |
| [`-dispatch-safety`](road-to-inbox-harvest-2026-08-b-dispatch-safety.md) | scoped-Bash expressibility, a confirmation primitive, checkable handoff fields | a live schema-vs-rule contradiction |
| [`-release-integrity`](road-to-inbox-harvest-2026-08-b-release-integrity.md) | the recurring release-head placeholder, the carrier remainder, four flags over existing data | most survivors of any single source |

- [ ] **2.1 Record the execution order the maintainer picks.** Eight roadmaps opened
      in one pass is a capacity question, not a throughput one — `ADR-216` re-anchors
      restraint to maintainer capacity, and nothing here is urgent. Two are
      independently cheap and unblocked (`-ledger-truth` Phase 1,
      `-release-integrity` Phase 5); two open with a maintainer decision before any
      code (`-estate-lifecycle`, `-install-lifecycle` Phase 2). Write the chosen
      order into this step and strike the rest until they are reached.

### Council convergence on the family's governance — 2026-08-11

Two members (anthropic, openai), quorum 2/2, concluded. Recorded so these four are
not re-argued; the reasoning is theirs, not this file's.

- **The family gets no second control.** Not a cap extension, not a sunset date. The
  existing concurrency cap is prefix-scoped to another family, and copying it here
  would apply a control without establishing that this family shares the problem it
  was calibrated for. A sunset date was rejected on a sharper ground: `ADR-216`
  anchors restraint to **capacity**, which is effort-based, while a date is
  time-based — it can fall due exactly when capacity is absent, forcing either
  rushed work or ceremonial renewal. **2.1 above is the capacity gate**, because it
  surfaces the question at the moment work is considered.
- **Implementation lands outside this pull request.** A verified, green patch is not
  held behind a planning decision — that would let planning gate code rather than
  verification gate code. Code ships in its own change; this family stays
  documentation.
- **A blind security gate is not a planning item.** Where a shipped detector is
  demonstrably not inspecting the artefact class it exists for, the fix goes out
  immediately and separately — separately because widening a detector's scan roots
  can surface unrelated pre-existing findings, and absorbing that risk into a
  documentation diff creates a review dependency outside its scope.
- **A self-declared probabilistic gate does not shift the burden of proof.** Its
  findings are refuted by citation where the tree contradicts them, with the
  disposition written down rather than passed over.

One question did not converge — whether an implementation may persist a new field in
a second location beyond the step that specified it. It belongs to the pull request
that carries that code, not here.

## Phase 3 — Cancelled at batch level

Each child roadmap records the cancellations specific to its own subject. These three
apply to the batch as a whole, and are recorded here because the source files argue
for them persuasively and will outlive this file in `tmp.old/`.

- [-] **The per-turn doctrine-recency cue** — the batch's flagship, blocked three
      independent ways. `ADR-054` is `status: rejected` and *is* this proposal;
      `agents/settings/contexts/reminder-injection-verdict.md` records the pilot at
      **Δ = 0 pp on both hosts**, torn down in the branch that built it per a
      pre-committed threshold; and the premise was searched across **1,158 sessions**
      under a bar registered in its own commit before the data was read, confirming
      **0 of 67** at distances up to 240× the threshold
      (`agents/evidence/analysis/activation-red-baseline.md`). The one carrier that
      does fire per turn on that surface was measured at **24 of 29 misses**
      (`session-canary` § enforcement), whose own conclusion is that the next
      mechanism must be able to **refuse**, not remind.
- [-] **All 38 pre-registered benchmarks, as written.** `B-01`'s corpus does not
      exist; `B-16` pre-registers an interaction against a phantom paper; `B-42`
      needs ignore-data that measured 0 of 67; `B-131` would disable a live gate as
      a control; eight need live spend. Any that is ever run re-homes into
      `docs/CLAIMS.md` with an `exec:` pointer, where the exit code is the verdict.
- [-] **The `97/111` absoluta point estimate**, wherever the bundles cite it.
      Re-derived at HEAD: **116 rules · 84 strict (72.4 %) · 102 case-insensitive
      (87.9 %) · 99 carry an Iron Law (85.3 %)**. `ADR-218` (accepted) states that no
      artefact cites a point estimate for absoluta prevalence — cite the 71–87 % band
      or the structural reading.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Eight roadmaps open at once exceed maintainer capacity | product | The batch's surviving work is real, but opening eight tracks in one pass is exactly the concurrency ADR-216 re-anchored to capacity; the likely failure is eight stalled roadmaps rather than two finished ones | 2.1 makes the execution order an explicit recorded decision rather than an implicit "all of it", and names which two are cheap-and-unblocked versus which two need a decision first | Phase 2 — The family |
| 2 | A cancelled item is re-adopted from the source file | product | Sixteen bundles ship drafted roadmaps and frozen pre-registrations arguing for cancelled items, and they outlive this file in `tmp.old/` | Every cancellation names the lock and its `file:line` inline, here and in each child; the four dossier-level defects are stated once at the top so a re-reader meets the evidence before the argument | Phase 3 — Cancelled at batch level |
| 3 | The family's cross-references rot as children are archived | implementation | Eight siblings plus an index is nine files of mutual links; archiving one on completion breaks the index and the `parent_roadmap` chain | `check_references` and `check_no_roadmap_refs` both gate this and were run green on this change; the index table is the single place a child is named, so an archival edit has one site | Phase 2 — The family |
| 4 | The index is mistaken for the plan | product | A reader who opens only this file sees analysis and two done items, and may conclude the batch produced no work | Phase 2's table is the first thing after the landed work, and every child carries the same `Source:` provenance line back to the batch | Phase 2 — The family |

## Blockers

### blocker: harvest-b-execution-order
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 2.1 only. Every child roadmap is independently readable and
  independently executable; none waits on this.
- **What to do:** decide which of the eight siblings open now and which wait.
  `-ledger-truth` Phase 1 and `-release-integrity` Phase 5 are the two cheapest
  unblocked items in the batch. `-estate-lifecycle` and `-install-lifecycle` Phase 2
  each open with a decision-revisit offer against an accepted or council-parked lock,
  so they need an answer before any code. `-ci-economy` is the largest and its
  Phase 0 spends CI minutes recording a baseline.
- **Resolved when:** the chosen order is written into 2.1 and the unchosen siblings
  are moved to `agents/roadmaps/later/` with a resume condition, per
  `lint_roadmap_later_disposition`.

## Explicitly parked

- **The third-party skill install** (`chief-of-staff.txt`). Downloading and
  installing third-party code into a global skills directory is a safety-floor
  action, and it would be a 290th skill with no retire candidate. Its highest-value
  pattern — staleness metadata — is carried by `-estate-lifecycle` as a revisit
  offer. Note the lock is **not** ADR-088: that record scopes to driving an external
  agent *runtime*, and citing it here would be a lock invoked out of scope.
- **A `SELF.md` / generated self-knowledge doc family.** Its governing problem is
  owned by `road-to-capability-answerability.md` — **`status: ready`, active, 18 of 19
  steps closed** (an earlier draft of this index called it merged in-window; it is
  not) — which ships a family of self-describing probe verbs, a per-capability
  carry-vs-name contract table (`docs/contracts/capability-answerability.md:24-30`),
  and per-field provenance so `false` reads as "nobody answered" rather than "the host
  cannot". Any future proposal must clear that contract's own empirical revisit bar at
  `:40-44` — the same wrong guess observed twice.
- **Programmatic tool calling** (executing model-authored scripts against a tool
  RPC). The largest novel mechanism in the batch and the wrong shape here: `ADR-123`
  holds behavioural enforcement out of scope, and the gate-equivalence precondition
  presumes PreToolUse guards that bind on three of eight hosts.
- **A runtime event bus.** Already recorded as CUT to a maintainer decision
  (`archive/road-to-feedback-9-29.md:77`); the replacement target is already a single
  in-process dispatcher. Re-proposing it is relitigation without new evidence.

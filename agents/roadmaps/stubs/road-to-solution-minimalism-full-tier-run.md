---
complexity: lightweight
---

# Stub: road to the solution-minimalism full-tier run

> **Stub — not active work.** Drain-run transfer, 2026-08-20, from
> [`road-to-solution-minimalism.md`](../road-to-solution-minimalism.md).
> Council disposition **A** on the parent's blocker, outcome state
> **transferred** for the residue, per the framework of record in
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md).
> Three items moved here because the substitute criterion ends in a **paid model
> sweep**, and no repository change supplies metered model calls.

## Why this stub exists

The parent's blocker `phase3-harness-deltas-9-10` was disposed **A — re-scope,
narrowed**: deltas #9 and #10 are ordinary repository implementation, not an
external dependency and not a decision anyone owed the roadmap. The entry had
converted *large* into *unavailable* and held five steps on that conversion.

Delta #9 landed with the disposition, so two of the five steps closed on real
evidence and stay in the parent. The remaining three end in a run, and that is a
different kind of gate — so they are here rather than left as `[ ]` in an open
roadmap, where a prose transfer note is indistinguishable from work nobody has
started.

**Phase 3 has never reported and does not report now.** Nothing in this stub is
achieved. The pre-registered thresholds stay committed and unfittable-to-data,
which is the strongest form of that guarantee and also why nobody is forced to
hurry.

## The substitute criterion — verbatim

The council's replacement for the removed blocker, quoted exactly:

> Implement `repo` and `sha` corpus keys, add approximately 30 hand-written
> capability/discipline oracles, pin at least one task to a repository SHA, run
> the full tier, and publish its report.

**Satisfied in the parent, 2026-08-20** — the `repo` and `sha` corpus keys, and
one task pinned to a repository SHA. `src/scripts/_lib/bench_ab_pinned_repo.ts`
materialises a pin once per SHA and `trapA-pinned-click-01` pins
`pallets/click@150d1071d69c5cdad7de78590013ffe56cf9e3bb`.

**Transferred here** — the ~30 oracles, the full-tier run, and the report.

## Where the line falls, and why it is not "this is large"

Stated first because it is the load-bearing half of the disposition. Authoring
oracles is ordinary work. *Calibrating* one is a claim about model behaviour, and
the run that would test it needs metered model calls — so **thirty un-run oracles
are thirty unverified assertions**, which is the shape findings F2 and F7 of the
parent both warn about. The count therefore travels with the run it needs rather
than being split off as a number nothing checks. The single pinned task in the
parent says `UNCALIBRATED` in as many words for exactly this reason.

Two facts put the run outside repository automation, both **measured on the
transfer date rather than assumed**:

1. **No credential.** `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` and
   `ANTHROPIC_AUTH_TOKEN` are all unset in the environment that closed the rest
   of the roadmap. The contrast matters and is why delta #9 could land at all:
   `git ls-remote` against a public remote **succeeds**, so the network half of
   the pinning work was doable and was done; only the metered half was not.
2. **The Hard Floor needs a this-turn confirmation.** Firing a paid sweep is a
   Hard-Floor action under
   [`non-destructive-by-default`](../../../src/rules/non-destructive-by-default.md).
   The parent's `benchmark-spend-authorization` blocker reads `Status: resolved`
   with a $250 ceiling granted 2026-08-14 and marked pre-authorised — that
   records the **decision**, and a recorded decision is not a live confirmation.
   No autonomy setting, execution contract, or roadmap step lifts the floor.

## What moved here — the complete list

Three items, and no others:

1. Phase 3 **Tasks** — the deliberately mixed ~30-task corpus.
2. Phase 3 **Hygiene** — the escalation ladder through the full tier.
3. The acceptance criterion **"Phase 3 either reports from the full tier …"**.

**Phase 3 Repo and Phase 3 Reproducibility did NOT move.** Both closed in the
parent on real evidence: the corpus can pin an external repo and one task does,
scored in three directions against the real pinned tree; and the reproduction
path's fourth deliverable — a pinned SHA — became deliverable with delta #9. They
are named explicitly because a transfer that quietly widens its own scope is the
failure the complete-list requirement exists to catch.

Also not moved: the parent's **"All quality gates pass"** criterion, which stays
open there on its own terms. It is not gated on this run and this stub does not
carry it.

## Transferred items — verbatim, with producer, probe and baseline

Each item is quoted exactly as it stands in the parent, where it now carries
`[-]` with a one-line pointer here.

### 1. The mixed ~30-task corpus

```
- [ ] **Tasks:** deliberately mixed — over-build-trap tickets **and** irreducible
      CRUD **and** this package's own discipline family — so the report can show
      where the effect lives and where it is honestly zero.
      *Verify:* the per-task table shows both.
```

- **Producer:** the maintainer authoring the remaining pinned tasks against
  `pallets/click@150d1071d` (or a second pinned repo), each with hand-written
  capability and discipline oracles per
  [`SCHEMA-v2.md`](../../../internal/bench/corpora/SCHEMA-v2.md).
- **Probe:** `internal/bench/corpora/ab-trackb-v2.yaml` carries **≥ 30** tasks
  declaring `repo` **and** `sha`.
- **Baseline 2026-08-20:** **1** pinned task (`trapA-pinned-click-01`), out of 34
  tasks total. The other 33 are in-repo fixtures, which is the confound Phase 3
  exists to remove — a size effect measured only on traps written by the same
  hand as the rule cannot separate the rule working from the fixture inviting it.

### 2. The escalation ladder through the full tier

```
- [ ] **Hygiene:** escalation ladder self-test → 10-task smoke → k=3 → full,
      **publishing nothing below full** (F4); paired non-parametric tests;
      errored pairs dropped from both arms.
      *Verify:* the report states which tier it is from.
```

- **Producer:** the maintainer running
  `./scripts-run src/scripts/bench_ab_v2_run --host claude --max-usd 250` in an
  environment carrying a credential, with a this-turn Hard-Floor confirmation.
  The `--max-usd` flag is not optional decoration: it is the `collect_records`
  abort that makes the granted ceiling enforceable rather than advisory.
- **Probe:** `docs/benchmark.md` renders a `Gate verdict:` for the ladder arms
  from a pinned report whose own `sha` field is non-empty. Both halves are
  required — a verdict with an empty `sha` is a run against fixtures, which is
  the thing this phase was re-scoped to stop reporting.
- **Why the probe is worded that strictly:** "a report exists" would already be
  a false green. `docs/benchmark.md` is in the tree and `lint_bench_ab` checks
  its shape today; the ladder-arm verdict from a pinned tree is what does not
  exist.
- **Baseline 2026-08-20:** **no** full-tier run has ever executed. Runs to date
  against a pinned repo: **0**.

### 3. The full-tier acceptance criterion

```
- [ ] Phase 3 either reports from the full tier with every pre-registered
      endpoint — added lines **paired** with cognitive complexity, plus
      search-adherence and the safety tier — or publishes the null; no number
      appears anywhere except rendered from the pinned report.
```

- **Producer:** the same run as item 2. This criterion is item 2's outcome, not
  a separate act — it is listed separately because it is the parent's acceptance
  gate and a reader screening the parent must find it here rather than infer it.
- **Probe:** item 2's probe, plus every pre-registered endpoint present in the
  rendered report: added lines **paired** with cognitive complexity (the
  anti-golfing pair, never lines alone), search-adherence (T5) and the safety
  tier (T4).
- **Baseline 2026-08-20:** all four endpoints are **implemented** — T1/T2 in
  `_lib/bench_ab_complexity.ts` and `bench_ab_v2_stats.size_claim_verdict`, T4 in
  `bench_ab_v2_safety.ts`, T5 in `bench_ab_v2_search.ts`, each with a unit suite.
  Reports rendered from them: **0**. The gap is a run, not an endpoint — and the
  parent carries a correction saying so, because an earlier note claiming T4 and
  T5 were unimplemented had itself gone stale.
- **What a run today would NOT produce:** a pass. With 1 pinned task the corpus
  is a single trial, and the parent's own hygiene rule publishes nothing below
  the full tier (F4). Item 1 is a prerequisite of item 2, not a parallel task.

## Promotion

Item 1 is promoted independently — authoring oracles needs no credential and no
spend, and a reader who can only do that half should do it. Items 2 and 3 promote
together on one run and cannot precede item 1. Promote by moving the satisfied
item back into the parent (or straight to done, with its probe output as the
evidence) and striking it here. When all three are gone, delete the stub.

## Not governed by the shared promotion criteria

The **Promotion criteria (shared)** in [`README.md`](README.md) — a recruited
customer, a funded security audit, and an ADR lifting a Hard-Floor item — govern
the *org-mode* stubs. They do not govern this one, and applying them would be a
category error: nothing here introduces a product surface or an attack surface.
Item 1 is authoring work; items 2 and 3 are one metered run under a ceiling that
was already granted.

The one shared property that does carry over, and the reason the parent records
`transferred` rather than closing: this stub is not active work, and its presence
must never be read as Phase 3 having reported.

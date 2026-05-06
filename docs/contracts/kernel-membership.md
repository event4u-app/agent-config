---
stability: beta
---


# Kernel Membership — Phase 1.3 of road-to-kernel-and-router

> **Status:** active · **Stability:** beta · **Owner:** road-to-kernel-and-router P1.3
> · **Source of truth:** `docs/contracts/rule-classification.md` § 3.1
> · **Pilot artifacts:** `docs/contracts/pilot/`

Locks the kernel set and the empirical compression rate `r` derived
from the P1.3 pilot. Phase 2.2 executes against this contract.

## § 1 — Inclusion criteria (kernel-only)

A rule belongs in the kernel iff it satisfies **all** of:

1. **Iron-Law floor.** Carries an Iron Law fence (```...```) that
   governs every reply or every action — no skill, no command, no
   guideline can override it.
2. **Mode-independent.** Fires under `off`, `auto`, `on`, every
   role mode, every cost profile.
3. **Pre-send OR pre-act gate.** Either (3a) scans the reply draft
   before transmission (prose, tone, language, claim verification),
   or (3b) fires before tool execution / commit / workflow progression
   (safety, permission, scope). Post-hoc remediation does not
   qualify.
4. **Cross-cutting.** Applies across at least two of the categories
   (behaviour, safety, tone, ask-policy) and cannot be scoped to a
   sub-domain (a stack, a workflow, a single artifact type).
5. **Ask-policy floor.** *(included by criterion #1+#4 union, but
   surfaced explicitly: rules governing when/how the agent may ask
   the user a question — wrong ask-behaviour breaks the agent's core
   contract with the user, so `ask-when-uncertain` and
   `no-cheap-questions` are first-class kernel members even though
   they fire during deliberation, not strictly pre-send.)*

All other rules → `compress-and-keep` (auto-tier) or migrate to
skill / guideline per `rule-classification.md`.

> **Council amendment (P1.4).** Criterion #3 originally read "must be
> checked before the agent emits the next token". Sonnet 4.5 noted
> this conflated pre-send (scanning the draft) with pre-act (gating
> tool execution); split per #3a / #3b above. Criterion #5 surfaced
> the ask-policy floor that the original four-gate test left as an
> implicit consequence of #1+#4. Both amendments preserve the
> existing 9-rule kernel set. See
> `agents/council-sessions/20260506T044941Z-phase1-cross-check-r2.json`.

## § 2 — Empirical compression rate (pilot)

Pilot picks (per P1.3 algorithm: shortest / median / longest of the 9
always-rules in `rule-classification.md` § 3.1):

| pilot | original | compressed | r | per-rule cap (2.5k) | Iron-Law SHA |
|---|---:|---:|---:|---|---|
| agent-authority   | 1217 | 1020 | 0.838 | OK        | match (`e3b0c442…`) |
| direct-answers    | 3991 | 2841 | 0.712 | +341 over | match (`ef438530…`) |
| language-and-tone | 5318 | 3602 | 0.677 | +1102 over | match (`c017b26f…`) |

| statistic | value |
|---|---:|
| mean r (outlier-skewed by lean pilot) | 0.742 |
| **median r** (locked for projection) | **0.712** |
| max r (already-lean floor) | 0.838 |
| min r (most compressible) | 0.677 |

Locked `r = 0.712` (median) for P2.2 projection. Council amendment
(P1.4) — the original lock was the **mean** (0.742), but Sonnet 4.5
flagged outlier skew: `agent-authority` at 1217 chars pre-pilot was
already near the compression floor (`r = 0.838`), pulling the mean
above the typical band. Median (0.712) is robust to the lean
outlier and sits inside the roadmap-stated 0.6–0.75 band. Risk
asymmetry confirms the choice: under-estimating compressed size
blows the 25k cap mid-P2.2 (no abort path); over-estimating just
yields headroom. GPT-4o concurred. Source:
`agents/council-sessions/20260506T044941Z-phase1-cross-check-r2.json`.

**Pilot caveat — already-lean floor.** `agent-authority` (1217 chars
pre-pilot) yielded only `r = 0.838`. Pre-compressed rules give less
back; rules > 3k chars give more back. Future kernel additions
≤ 1.5k chars should not assume the median — they may already be at
floor.

**Iron-Law preservation verified.** All three pilot SHAs match the
originals (whitespace-normalised, case-folded, fence content only).

## § 3 — Projection & demotion log

Algorithm (per roadmap P1.3): `projected = current × r`; if sum > 25k,
demote largest projected, re-sum; abort after 3 rounds.

| round | candidates | sum-of-current | sum-of-projected (× 0.712) | budget |
|---:|:--|---:|---:|---|
| 0 | all 9 always-rules | 32403 | **23071** | ≤ 25 000 ✓ |

**Result: 0 demotions fired.** All 9 always-rules stay in the kernel
under median projection. Headroom = 1929 chars (= ~one median rule)
absorbs pilot variance for the 6 untested rules.

## § 4 — Locked kernel set

| id | current | projected (× 0.712) | inclusion criterion |
|---|---:|---:|---|
| agent-authority           | 1217 |  867 | (4) cross-cutting router-of-routers † |
| ask-when-uncertain        | 4096 | 2916 | (1)(5) Iron Law + ask-policy floor |
| commit-policy             | 2972 | 2116 | (1)(2) safety-floor Iron Law |
| direct-answers            | 3991 | 2842 | (1)(3a) three Iron Laws, pre-send gate |
| language-and-tone         | 5318 | 3786 | (1)(3a) language-mirror, pre-send gate |
| no-cheap-questions        | 3875 | 2759 | (1)(2)(5) ask-policy floor |
| non-destructive-by-default| 4222 | 3006 | (1)(2)(3b) safety-floor Hard Floor |
| scope-control             | 4368 | 3110 | (1)(3b) safety-floor permission gate |
| verify-before-complete    | 2344 | 1669 | (1) completion-claim gate (post-act, pre-claim) ‡ |
| **total**                 | **32403** | **23071** | **≤ 25 000** ✓ |

† **agent-authority swap candidate (P1.4 ADR).** Sonnet 4.5 argues
this is a routing index (zero Iron Law fences, dispatches to other
kernel rules) and should be `compress-and-keep` (auto-tier-3),
freeing 867 projected chars. The Council also recommends promoting
`autonomous-execution` (5631 → 4009 projected) into kernel as a
mode-independent Band-4 authority. Net effect: 23071 − 867 + 4009 =
26213, **over the 25k cap by 1213 chars**. Resolution deferred to
P2.1 ADR (`docs/decisions/`); options: (a) accept swap + raise hard
cap to 27k, (b) accept swap + demote `verify-before-complete`,
(c) reject swap, keep current 9-rule set under median r.

‡ **verify-before-complete borderline.** Council split criterion #3
into pre-send (#3a) / pre-act (#3b); this rule fires post-act,
pre-claim. Treated as Iron Law under criterion #1 alone (no #3
flag). Demotion candidate if the swap above forces a third
demotion round.

## § 5 — ADR candidates (P2.1 input)

Two distinct ADR classes land in P2.1 from this contract.

### § 5.1 — Iron-Law-override ADRs (per-rule cap)

**Council amendment (P1.4).** Per-rule cap raised from 1.5k to **2.5k**.
Both Council members concurred — the original 1.5k figure forced 8 of
9 kernel rules into ADR territory (process theatre, not governance).
The 2.5k cap fits 7 of 9 rules without ADR; only the two largest
remain as legitimate Iron-Law-density exceptions.

Rules that land **above the 2.5k per-rule cap** even after compression
and Iron-Law preservation:

| rule | post-compression chars | over-cap (2.5k) | reason cap cannot be hit |
|---|---:|---:|---|
| direct-answers    | 2842 | +342  | Three Iron-Law fences (≈ 470 chars) + severity-tiered claim table required for invented-facts gate |
| language-and-tone | 3786 | +1286 | Iron-Law fence + exhaustive user-visible-prose catalog + pre-send gate are co-load-bearing |
| autonomous-execution* | 4009 | +1509 | (*if swap accepted per § 4 †) trivial-vs-blocking matrix + opt-in detection table |

`*` = conditional on the agent-authority / autonomous-execution swap
ADR (see § 5.2).

Per roadmap § "Iron-Law over budget = ADR exception, not auto-
compress" — these surface as `iron-law-override` exceptions for P2.1
to gate behind ADRs in `docs/decisions/`.

The remaining 6 always-rules project to 1669–2916 chars post-
compression — all under the 2.5k cap with no ADR needed. P2.2
measures the real post-compression sizes; if any breach the cap, an
ADR lands per-rule.

### § 5.2 — Kernel-set swap ADR (agent-authority ↔ autonomous-execution)

Sonnet 4.5 flagged that `agent-authority` carries no Iron-Law fence
(it is a routing index, not a governance rule) and that
`autonomous-execution` does carry a mode-independent Band-4 authority
that fires on every action decision. Swap proposal: `agent-authority`
→ auto-tier-3 (router-loaded), `autonomous-execution` → kernel.

| variant | sum-projected (× 0.712) | bucket budget | per-rule ADRs |
|---|---:|---|---|
| (a) status quo (current § 4)        | 23 071 | ✓ ≤ 25k | 2 (`direct-answers`, `language-and-tone`) |
| (b) swap, raise hard cap to 27k     | 26 213 | ✓ ≤ 27k | 3 (+`autonomous-execution`) |
| (c) swap + demote verify-before-complete | 24 545 | ✓ ≤ 25k | 3 (+`autonomous-execution`) |

Resolution: P2.1 ADR. The swap is architecturally cleaner (Iron-Law
purity), but raises the hard cap or forces a borderline demotion.
Status quo preserves the locked 25k cap and the 9-rule set.

## § 6 — Abort criteria for P2.2

**Council amendment (P1.4).** Sonnet 4.5 flagged that P2.2 compresses
in place with no defined abort path. The following triggers force
revert + re-projection rather than mid-phase scramble:

- **Iron-Law drift.** Any kernel rule loses Iron-Law SHA equivalence
  after compression (whitespace-normalised, case-folded fence-block
  content). Single occurrence aborts the rule's compression.
- **Bucket overflow.** Kernel sum post-compression > 27 500 chars
  (10 % over hard cap). Aborts the entire P2.2 phase.
- **Single-rule runaway.** Any kernel rule post-compression
  > 4 000 chars. Aborts that rule's compression; flag for ADR.
- **Empirical r drift.** Median of measured r across the first 4
  compressed rules deviates > 0.10 from the locked 0.712 (i.e.,
  measured median outside [0.612, 0.812]). P2.2 pauses, re-locks r,
  re-runs § 3 projection.

On abort: revert all P2.2 edits in scope, re-run P1.3 projection
with the trigger-relaxed parameter, lock new value, re-attempt.

## § 7 — Verification

| check | command | acceptance |
|---|---|---|
| Pilot reproducibility | `python3 scripts/_pilot_measure.py` | r-values, sum, SHAs identical across runs |
| Iron-Law preservation | SHA-256 of fence-block content (whitespace-norm, case-fold) | all 3 pilots match originals |
| Bucket projection | `r_median × sum(always)` | ≤ 25 000 chars |
| Per-rule cap (P2.1) | `measure_rule_budget.py --kernel-budget-check` (P2 deliverable) | each ≤ 2 500 chars OR ADR |

## § 8 — What this contract does NOT do

- It does **not** edit any source rule. P2.2 ships compression to
  `.agent-src.uncompressed/rules/`.
- It does **not** lock per-rule `chars` (only the bucket sum). Per-
  rule values are projections; P2.2 measures real post-compression.
- It does **not** decide kernel additions. Adding a rule to the
  kernel requires an ADR per roadmap § "Sequencing-drift time-box"
  and re-runs P1.3 with the new candidate.
- It does **not** specify P3 router state-machine primitives
  (once / every-turn / on-mode-switch). Council flagged this as a
  P3.1 deliverable dependency before any P4 migration ships.
- It does **not** specify P4 migration shapes (replace / merge /
  stub / disappear). Council flagged this as a P4 deliverable spec.

## § 9 — Provenance

| date | source | scope |
|---|---|---|
| 2026-05-06 | `scripts/measure_rule_budget.py` | baseline (32 403 chars across 9 always-rules) |
| 2026-05-06 | `docs/contracts/pilot/*.md` + `scripts/_pilot_measure.py` | empirical r distribution (3 pilots) |
| 2026-05-06 | `agents/council-sessions/20260506T044821Z-phase1-cross-check.json` | Council R1 (truncated at 1024 tokens) |
| 2026-05-06 | `agents/council-sessions/20260506T044941Z-phase1-cross-check-r2.json` | Council R2 (3500 tokens) — locks median r, splits criterion #3, adds criterion #5, raises per-rule cap to 2.5k, defines abort criteria |
| 2026-05-06 | this file | kernel set locked: 9 rules, projected 23 071 chars (median r = 0.712) |

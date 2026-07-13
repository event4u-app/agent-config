---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Pre-Launch Diagnostics

**Trigger:** Ecosystem survey, second sweep (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Source cited source-anonymously (**L** = a production-readiness diagnostic skill
with a deterministic scoring pipeline); full provenance in the index § Provenance.

**Priority: P2.** The consumer-facing sibling of the suite's own claims-ledger:
gives `launch-readiness` an evidence-cited, regression-gated diagnostic so a
"ready" verdict can't be reached by assertion. Split out of
`reliability-measurement` (which measures the *suite itself*) because this
measures the *consumer's launch surface* — a different audience.

## Goal

Add four verified mechanisms to the pre-launch surface: stable semantic finding
IDs, evidence-required epistemics (Pass needs evidence; Unknown ≠ Pass), a
diff-based regression gate, and evidence-backed suppression — plus the fix-loop
discipline around them. The numeric score is treated as an **internal ordering
device only** (see the revisit note), never a published number.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Launch checklist + rollout/rollback contract | Shipped | `launch-readiness` (checklist/decision skill) |
| Install-side self-diagnosis | Shipped (different scope) | the Doctor checks validate the *suite install*, not a consumer's launch surface |
| Evidence-first epistemics for the suite's own claims | Shipped | `docs/proof.md` / claims-ledger discipline |
| Stable finding IDs across runs | **Gap** | review/quality/launch outputs are prose — nothing citable/diffable across runs |
| Pass/Finding/Unknown/N-A epistemics with per-state evidence | **Gap** | the checklist can be "completed" by assertion |
| Findings regression gate (diff old vs new) | **Gap** | nothing compares consumer launch findings across runs |
| Suppression-with-evidence | **Gap** | requires the ID scheme |

- [x] Reality check complete — four mechanisms are genuine gaps; the checklist + reversibility principles already exist.

## Phase 1 — Finding-ID scheme + evidence epistemics + report schema

- [x] Define an immutable finding-ID grammar (`AC-<AREA>-NNN`; area vocabulary fixed in YAML; IDs never re-assigned) and a report JSON schema (findings, coverage, unknowns, questions) under `docs/contracts/` per house pattern. *Source L.*
- [x] `launch-readiness` gains an epistemics block: each coverage area is Pass / Finding / Unknown / Not-applicable — **Pass requires cited evidence; absence of findings is Unknown, never an automatic Pass; N/A requires a reason**. Same epistemics as `docs/proof.md`, applied to a consumer report. *Source L.*
- [x] Coverage backbone pruned to the stacks the suite targets (auth, migrations, secrets, observability, rollback, AI/agent governance) + a "questions that would change the diagnosis" report section. *Source L.*

## Phase 2 — Regression gate + suppression

- [x] A findings diff (old baseline vs current, by ID) with a `--ci` mode that exits non-zero on a new P0/P1 or a Pass→Finding flip in a launch-gate area — the consumer-side sibling of the suite's own claims-ledger CI. *Source L.*
- [x] Project-local suppression file (finding ID + reason + evidence link); suppressed findings render in a collapsible section (mirrors the dropped-false-positives transparency in the review-mechanics roadmap). *Source L.*
- [x] Consumer recipe: commit a launch baseline, gate in CI (opt-in).

## Phase 3 — Fix-loop discipline

- [x] Ranked backlog → **"safest first approval batch"** (explicitly the first safe batch, not the full scope) + a per-finding status vocabulary (fixed / accepted-risk / deferred-with-reason / suppressed-with-evidence / not-applicable); rescore whenever evidence changes. Rides the existing `autonomous-execution` + reversibility rules; read-only first. *Source L.*

## Score — decision-revisit note (NOT adopted unilaterally)

The pass-1 council **dropped a 0–100 readiness score** as gameable false
precision / a negotiation target. The source (and a parallel local exploration)
proposes a materially different framing: a severity-**capped** score (open P0
caps at 49, P1 at 74, missing critical evidence at 84; caps apply even to
estimates) used as an **internal ordering device only, never published** until
calibrated against ≥5 real runs with maintainer sign-off. That never-published +
capped-by-construction shape directly addresses the council's stated objection
(a green number cannot coexist with an open blocker; it is never an external
negotiation target). Per [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)
this is **surfaced for council re-evaluation, not adopted here** — the ID scheme,
epistemics, diff gate, and suppression above stand on their own without any score.

## Council convergence (2026-07-11)

Vetted under the index direction. Lock held on the *published* score; the
internal-capped-unpublished variant is flagged for re-evaluation rather than
silently adopted or silently rejected.

## Acceptance criteria (anti-dump)

- [x] Finding IDs are immutable + diff-stable (a test renames a finding's title, asserts the ID survives). <!-- prelaunch_diagnostics.test.ts: retitled finding -> empty diff -->
- [x] Every schema'd artifact has a fixture + validation test; a fixture with an open P0 refuses a "ready" verdict regardless of other areas. <!-- 18 tests green; live CLI fixture: open P0 -> NOT ready + ci-exit 1 -->
- [x] Nothing mutates a consumer project; the diagnostic is read-only, the fix loop approval-gated (existing rules referenced, not restated). <!-- tool reads reports only; contract §7-8 reference autonomous-execution/reversibility -->
- [x] No numeric score published anywhere until the revisit note is resolved. <!-- schema $comment forbids a score field; no score in tool output; revisit note stands for council re-evaluation -->
- [x] Dashboard regenerated.

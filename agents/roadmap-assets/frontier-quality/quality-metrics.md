# Frontier-quality — metrics, provenance, execution contract, pilot

> **Phase 0 deliverable of `road-to-frontier-quality-operating-system`.** This
> is the maintainer-checkpoint artifact: it defines what "frontier-quality"
> means as *observable package behavior* (never a vendor comparison), the
> baseline/threshold/rollback discipline every later phase measures against, the
> source-anonymous provenance method, the execution contract, and the first
> pilot slice.
>
> **Status: PROPOSAL, pending the Phase-0 checkpoint.** Phases 1–8 do NOT start
> until the maintainer accepts the four decisions below (metrics, provenance
> method, execution mode, pilot). Nothing here flips a default or changes
> behavior — it is the measurement + governance frame the harvest runs inside.

## 1. What "frontier-quality" means here (observable, not comparative)

Frontier-quality is **not** "as good as vendor X". It is a set of *observable,
reproducible package behaviors* a skeptic can measure on a fresh checkout. Six
dimensions, each mapped to how it is measured with the harness the repo already
ships:

| # | Dimension | Observable behavior | Measured with (existing infra) |
|---|---|---|---|
| M1 | **Currentness recall** | On a fast-changing / version / office-holder / URL question, the agent does the lookup instead of answering from stale knowledge or a cutoff apology. | trigger-eval fixtures (`skill_trigger_eval.ts` / `check_trigger_evals.ts`) — does the currentness/research path fire. |
| M2 | **Correct carrier selection** | Inline vs tracked file vs visual vs MCP/app tool vs document — the right carrier for the ask, no over-filing, no fake tool output. | behavioural evals (`run_skill_evals.ts`) with golden tasks that force different carriers on look-alike prompts. |
| M3 | **Source-quality compliance** | Cites materially-supporting primary sources, paraphrases by default, respects the quote floor, flags conflicts. | behavioural evals + the existing `content-quoting-floor` gate. |
| M4 | **Memory non-application precision** | Applies a stored preference/memory ONLY when relevant; never surfaces sensitive memory unprompted; never lets a preference weaken criticism/safety. | paired positive/negative trigger fixtures (fires when relevant, silent when not) — the false-positive arm is the load-bearing one. |
| M5 | **Verification honesty** | No "done/verified" claim without fresh evidence; no simulated tool output. | behavioural evals + the always-on `verify-before-complete` rule; negative fixtures that must FAIL a hollow claim. |
| M6 | **No regression** | The existing coding/roadmap workflows do not degrade while M1–M5 are added. | the discipline-axis benchmark (`bench_ab_v2_*`) + `check_token_quality_golden.ts` on the current corpus. |

**Non-goals (stated up front):** no vendor score, no "N% better", no headline
number. Every public number that ever comes out of this program binds to
`docs/CLAIMS.md` or it does not ship (house rule; `check-claims` enforces it).

## 2. Baseline, thresholds, allowed regressions, rollback, cadence

**Baseline first, always.** Before any mechanism flips from `advisory`, its
dimension gets a pinned baseline snapshot on a fixed host, so adoption shows a
*delta*, not just a new green check (mirrors the `bench_ab_v2` +
second-brain-delta discipline: measure on vs off, paired).

| Gate | Threshold to flip `advisory → routed → default-on` |
|---|---|
| Trigger recall (M1, M4-positive) | ≥ 0.9 recall on the should-fire fixtures, per the trigger-eval convention. |
| Negative precision (M4-negative, M5) | Zero should-NOT-fire fixtures firing; a hollow-claim fixture must FAIL. |
| Behavioural pass (M2, M3, M5) | Priority-tier golden tasks pass; no LLM-judge where a deterministic check exists (pin + witness any judge). |
| No regression (M6) | Paired benchmark shows **no significant drop** on the existing corpus at held cost; a cost blow-up (> 1.5× loaded-context on the pilot) is itself a fail. |

**Allowed regression:** none silent. A measured, documented trade-off (e.g. +X%
tokens for a currentness lift) may ship *only* with the number in CLAIMS and a
maintainer sign-off. A regression with no number is a hard stop.

**Rollback triggers (per default-on mechanism):** a negative-precision fixture
starts firing; the no-regression benchmark goes red; a cost blow-up; or a
user-visible uncanny-personalization report (M4). Each mechanism ships behind a
flag or a documented single-PR revert path, with the exact files/flags named
before it goes default-on (Phase 8 owns the runbook; this is the contract).

**Re-harvest cadence:** re-run the source-anonymous mechanism review after a
major host/tool change or a new external prompt family — but the mechanism
matrix (Phase 1) is required before any new adoption, so re-harvest is
disciplined, not ad-hoc.

## 3. Source-anonymous provenance method (decision: checksums + local notes)

**Chosen method (conservative default, no maintainer secret required):** tracked
provenance is **file checksums + local-only source notes**, never raw external
links or named sources in tracked files. Concretely:

- The Phase-1 mechanism matrix records each transferable mechanism by its
  *behavior*, with a **SHA-256 of the local source-note file** as the provenance
  anchor — not the source's name or URL.
- Raw links / full extracted notes stay **local-only** (gitignored
  `agents/.harvest-local/` per `source-confidentiality`), never committed.
- If the maintainer later wants recoverable links in-tree, the alternative is
  `ENC1:` encrypted-link retention (`link_crypto.ts`) — a maintainer-key
  decision, explicitly **out of scope** for this autonomous Phase-0 proposal.

This satisfies `source-confidentiality` (no derivation-attribution, no named
source in the tree) by construction and needs no secret to adopt.

## 4. Execution contract

- **Phases −1, 0, 0.5 are maintainer-checkpoint-gated.** They set the frame
  (metrics, provenance, matrix, eval harness). This document is the Phase-0
  artifact; it is a **proposal** until the maintainer accepts §§ 1, 2, 3, 5.
- **Phases 1–8 run autonomously ONLY within the accepted matrix + eval gates.**
  No mechanism flips past `advisory` without its dimension's gate (§ 2) green on
  a pinned baseline. Evidence precedes every default flip.
- **Phase 1 needs the local external corpus** (the harvest source), which is
  local-only maintainer material — so Phase 1 is maintainer-run or
  maintainer-supplied, not autonomously fabricable.
- **No generated projection is hand-edited**; all implementation lands in `src/`
  during the later phases (per the roadmap's own acceptance criterion).

## 5. First pilot slice (decision: currentness / research routing)

**Chosen pilot: currentness + research-routing (M1 + the source-quality half of
M3).** Rationale (matches the roadmap's recommendation): high-value, cleanly
measurable with trigger-evals, and *least entangled* with memory (M4) or
artifact creation (M2) — so a first end-to-end pass (baseline → advisory →
routed → default-on, all gated) exercises the whole contract on the lowest-risk
dimension before touching memory-safety or carrier-routing.

**What the pilot does NOT do:** flip any default before its gate is green on a
pinned baseline; touch memory/personalization; or introduce any public number
without a CLAIMS pointer.

## Checkpoint — what the maintainer is accepting

1. **Metrics (§ 1):** the six observable dimensions + their existing-infra
   measurement mapping, and the no-vendor-comparison / no-unbacked-number frame.
2. **Discipline (§ 2):** baseline-first, the flip thresholds, no-silent-regression,
   the rollback triggers, the re-harvest cadence.
3. **Provenance (§ 3):** checksums + local-only notes (not encrypted links).
4. **Pilot (§ 5):** currentness/research routing first.

On acceptance, Phase 1 (the source-anonymous mechanism matrix) begins — and
that phase requires the local external corpus, which only the maintainer holds.

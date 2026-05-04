---
complexity: lightweight
---

# Always-Budget v2 — Decision Matrix

> Output of Phase 4.1 of `road-to-context-layer-maturity.md`. One row
> per `type: always` rule. Pick the **two** highest-leverage paths;
> safety-floor rules are untouchable; outcome-untested rules are
> 4d-only per the Phase 4.0 inputs gate.

## Baseline (run 2026-05-04)

`scripts/check_always_budget.py` — total **45,363 / 49,000** chars
(92.6 %, **3,637 chars headroom**). Top-3 sum 22,197 (cap 24,500).

| # | Rule | Raw | Ext | Outcome-tested | Safety-floor | Allowlisted |
|---|---|---:|---:|---|---|---|
| 1 | `scope-control` | 4,636 | 8,529 | — | ✅ | ✅ ≤ 8,529 |
| 2 | `non-destructive-by-default` | 4,607 | 7,887 | — | ✅ | ✅ ≤ 7,887 |
| 3 | `commit-policy` | 3,309 | 5,781 | — | ✅ | — |
| 4 | `verify-before-complete` | 2,196 | 5,481 | ✅ | — | — |
| 5 | `no-cheap-questions` | 4,257 | 4,257 | — | — | — |
| 6 | `direct-answers` | 4,098 | 4,098 | ✅ | — | — |
| 7 | `language-and-tone` | 3,969 | 3,969 | — | — | — |
| 8 | `ask-when-uncertain` | 3,893 | 3,893 | ✅ | — | — |
| 9 | `agent-authority` | 1,468 | 1,468 | — | ✅ (Index) | — |

Goal: **≥ 4,000 chars headroom** (gap to current: 363 chars).

## Path evaluation per touchable rule

Untouchable: rows 1, 2, 3, 9 (safety-floor). Outcome-untested touchable
rules (rows 5, 7) restricted to **4d only** per the inputs gate.

| Rule | 4a Demote→auto | 4b Merge | 4c Shared-context | 4d Compress | Verdict |
|---|---|---|---|---|---|
| `verify-before-complete` | high-risk: rule's whole point is the agent does NOT self-trigger reliably; demotion to auto trusts the trigger detection it was created to backstop. **Reject without council.** | no sibling with overlapping Iron Law | no-op (Q3=3a) | tight prose, ~150–250 chars achievable | **4d candidate (low yield)** |
| `direct-answers` | three Iron Laws apply every turn (no flattery / no invented facts / brevity). Demote breaks brevity-by-default which is per-reply, not per-trigger. **Reject.** | no sibling | no-op | severity-tier table prose dense; ~250–400 chars achievable via emoji-scope + failure-mode trims | **4d candidate (medium yield)** |
| `ask-when-uncertain` | universal escape hatch — needed every turn the agent is uncertain. **Reject.** | overlap with `no-cheap-questions` (both gate "about to ask"), but their Iron Laws differ (one-question-per-turn vs no-cheap). Merge would lose precision. **Reject.** | no-op | already tight after Block F prose-delta; ~50–150 chars achievable | **skip** |
| `no-cheap-questions` | only fires before asking, but precision relies on it being part of the "every turn" pre-send self-check. Demote risks the cheap-question sneaking past. **Reject without council.** | merge with `ask-when-uncertain` rejected above | no-op | example catalog already in demos; ~200–400 chars achievable in pre-send checklist + failure list | **4d candidate (medium yield)** |
| `language-and-tone` | mirroring runs every turn — by construction. **Reject.** | no sibling | no-op | the `.md`-always-English subsection has the most prose density; ~200–350 chars achievable | **4d candidate (medium yield)** |

## Selected paths (Phase 4.2)

Two paths, both 4d. Rejecting all 4a and 4b moves on this round per
the analysis above; logging them as **deferred-with-reason** so a
future roadmap inherits the audit trail rather than re-deriving it.

1. **4d on `direct-answers`** — primary target. Trim emoji-scope
   subsection to one paragraph + whitelist; collapse failure-mode
   table to a one-line pointer to `direct-answers-demos.md`. Target
   savings: 250–400 chars.
2. **4d on `no-cheap-questions`** — secondary target. Collapse
   "What counts as cheap" subsection (already mirrored in
   `no-cheap-questions-demos` once Phase 3 ships its third demo —
   today the cheap-question class catalog already lives in
   `asking-and-brevity-examples.md`). Replace inline examples with
   pointer to that anchor. Target savings: 200–400 chars.

**Combined target:** 450–800 chars saved. Headroom forecast: 4,087 –
4,437 chars (≥ 4,000 goal hit on either bound).

## Deferred-with-reason (Feedback #2: decline = silence)

| Rule | Path | Reason | Re-open trigger |
|---|---|---|---|
| `verify-before-complete` | 4a demote | Self-triggering distrust is the rule's purpose; demotion contradicts that purpose | New evidence that the auto-trigger description fires reliably ≥ 95 % across ≥ 50 sessions |
| `no-cheap-questions` ↔ `ask-when-uncertain` | 4b merge | Iron Laws differ; merge loses precision | A future rule consolidation that re-unifies "asking discipline" |
| All rules | 4c shared-context | Q3 locked at 3a (Model (b) literal, no sharing discount) | Q3 reopened in a later roadmap |

## Exit-gate forecast

If both 4d paths land at the lower bound (450 chars total):
total 44,913 / 49,000 (91.7 %, **4,087 chars headroom**) → goal hit.
Top-3 sum unchanged (the trims target rows 5–6, not the top-3).

## Exit-gate actuals (Phase 4.4, run 2026-05-04)

| Metric | Pre-trim | Post-trim | Δ |
|---|---:|---:|---:|
| Total extended budget | 45,363 | **44,928** | −435 |
| Headroom | 3,637 | **4,072** | +435 |
| `direct-answers` ext | 4,098 | 3,987 | −111 |
| `no-cheap-questions` ext | 4,257 | 3,933 | −324 |
| Top-3 sum | 22,197 | 22,197 | 0 |

**Outcome:** ≥ 4,000-chars headroom goal hit (4,072). Both 4d paths
landed inside forecast band. Top-3 untouched. Safety-floor rules
(scope-control, non-destructive-by-default, commit-policy,
agent-authority) not modified — verified via `git diff --stat`.

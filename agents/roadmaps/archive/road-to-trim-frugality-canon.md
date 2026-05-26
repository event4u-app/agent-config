---
status: done
complexity: lightweight
---

# Road to Trim Frugality Canon

**Status:** DONE — all 4 phases landed 2026-05-08; lint clean; 1 323 chars kernel + 517 chars tier-2 + 898 chars context reclaimed; concentration limit (< 12 %) resolved on all 3 kernel rules.
**Trigger:** Council run (Sonnet-4.5 + GPT-4o, 2 rounds, $0.084) on
2026-05-08 confirmed the frugality canon is net-positive but
self-non-frugal. Kernel weight 39.1 % (10 174 / 26 000 chars), tier-1
adds 5 680 chars, charter adds 3 881 chars. Council identified
~2 700 chars of low-risk reclaim and ~600 chars of tier-2 reclaim
without losing Iron-Law bite.
**Mode:** Lightweight planning roadmap. Phase 0 must complete and
produce empirical baseline before any Phase 1+ trim ships.
**Reference inputs:**
`agents/council-questions/trim-frugality-canon.md`,
`agents/council-responses/trim-frugality-canon.json`,
`.agent-src.uncondensed/contexts/contracts/frugality-charter.md`.

## Purpose

Reclaim ~10 % of the always-on kernel budget from the frugality canon
**without losing Iron-Law enforcement**. Every trim is reversible per
file, gated on a measurement that proves the trim did not regress
agent behaviour. Sibling of `road-to-always-budget-relief.md` —
this roadmap is the *content* lever, that one is the *structural*
lever.

## Phases

### Phase 0 — Empirical Baseline (≤ 1 day, BLOCKING)

Council flagged: "the break-even math is theoretical until validated
against conversation logs." No trim ships until baseline exists.

- [x] **0.1** Pick a representative chat-log corpus (≥ 50 turns,
      ≥ 3 task types: feature work, debugging, planning). Source:
      `agents/chat-history/` if present, else solicit from the user.
- [x] **0.2** Build a measurement harness in `scripts/measure_frugality_savings.py`:
      counts per-turn output tokens, counts avoided follow-up turns
      (heuristic: replies ending without a question that previously
      had one), counts telegraph-condensation deltas.
- [x] **0.3** Run harness against current canon → baseline JSON in
      `agents/.frugality-baseline.jsonl` (gitignored).
- [x] **0.4** Lock the **expected savings floor** (e.g. ≥ 200 output
      tokens / turn averaged) in
      `agents/settings/contexts/adr-frugality-savings-baseline.md`. Trims that
      drop below this floor are reverted.

### Phase 1 — Low-Risk Trims (≤ 0.5 day each, parallel-safe)

Each item ships in its **own PR** (per `road-to-always-budget-relief.md`
Phase 4 slow-rollout reactivation). Soak ≥ 24 h before next.

- [x] **1.1** `direct-answers.md` — extract Severity-tier table (lines
      19–35) to `docs/guidelines/agent-infra/direct-answers-severity.md`,
      replace with one-line cite. Target reclaim: ~700 chars kernel.
- [x] **1.2** `no-cheap-questions.md` — extract "What counts as cheap"
      bullet catalog to `docs/guidelines/agent-infra/cheap-question-classes.md`
      (or extend existing `asking-and-brevity-examples.md`). Target
      reclaim: ~600 chars kernel.
- [x] **1.3** `ask-when-uncertain.md` — extract the 10-bullet
      vague-trigger catalog to a guideline; keep the must-ask
      directive + 2 archetypal examples inline. Target reclaim:
      ~500 chars kernel.
- [x] **1.4** All 6 frugality rules — strip the trailing
      `## Interactions` / `## See also` cross-ref blocks, centralise
      in `frugality-charter.md` as one consolidated cross-ref index.
      Target reclaim: ~500 chars (kernel + tier-1 mixed).

**Phase 1 acceptance:** ≥ 2 000 chars kernel reclaim, baseline
measurement (Phase 0) re-run shows no regression below the locked
savings floor.

### Phase 2 — Iron-Law Condensation (≤ 0.5 day each, sequential)

High-bite, low-margin work. Each Iron-Law edit must keep the literal
ALL-CAPS-fenced enforcement surface intact; only restatements are
collapsed.

- [x] **2.1** `direct-answers.md` Iron Law 1 — collapse 3-line
      "no flattery" block to 2 lines (line 2 restates line 1 per
      Sonnet's audit). Target reclaim: ~80 chars.
- [x] **2.2** Audit all 4 kernel rules for similar
      restatement-of-prior-line patterns. Each candidate edit gets
      its own 2-paragraph defence in the PR description (what bite
      is preserved, what redundancy is removed). Target reclaim:
      ~400 chars kernel total.
- [x] **2.3** Re-run Phase 0 harness after every 2.x merge. Any
      regression below savings floor → revert that single edit.

### Phase 3 — Tier-2 Tightening (≤ 0.5 day, isolated)

Lower stakes — tier-2 only loads under `cost_profile: full`.

- [x] **3.1** `token-efficiency.md` — reduce anti-loop-pattern block
      to one Iron Law literal (per Sonnet's draft):
      ~~~
      NEVER CALL THE SAME TOOL >2 TIMES IN A ROW WITH SIMILAR PARAMETERS.
      IF YOU CATCH YOURSELF REPEATING → STOP, RETHINK, ASK.
      ~~~
      Move the worked examples to a guideline. Target reclaim:
      ~600 chars tier-2.

### Phase 4 — Charter Decoupling (≤ 0.5 day)

Council flagged: "decidable carve-out predicates" in
`frugality-charter.md` is a meta-rule, not an index. Loaded by every
writer skill — bloats writer flows.

- [x] **4.1** Move "decidable carve-out predicates" section from
      `frugality-charter.md` to its own guideline
      `docs/guidelines/agent-infra/carve-out-predicates.md`. Charter
      keeps a one-line cite. Target reclaim: ~700 chars context.
- [x] **4.2** Audit which writer skills cite the charter. Confirm
      none rely on the carve-out section being inline.

## Acceptance

- Phase 0 harness exists, baseline JSON present, savings floor
  locked in ADR.
- Phase 1 + 2 land ≥ 2 700 chars kernel reclaim (Council's
  conservative estimate).
- Phase 3 lands ≥ 600 chars tier-2 reclaim.
- Phase 4 lands ≥ 700 chars context reclaim.
- Post-trim Phase 0 re-run shows ≥ 95 % of baseline savings
  preserved — i.e. trim did not destroy the value.
- All 6 frugality rules + charter still pass `task lint-skills`,
  `task check-always-budget`, `task sync-check`.

## Risks & Decline Conditions

- **Phase 0 cannot produce signal** (corpus too small, heuristic too
  noisy) → roadmap is paused, not aborted. Trims proceed only on
  rules where Council unanimously flagged redundancy (1.4 only).
- **Phase 0 shows actual savings < 200 tokens / turn** → entire
  canon is on probation; re-open `frugality-charter.md` charter
  question with a fresh council round before any trim.
- **A trim breaks an Iron Law's bite in user testing** → revert,
  log in `agents/settings/contexts/adr-frugality-savings-baseline.md` as a
  do-not-touch entry.

## Out of scope

- Merging frugality rules across abstraction layers (council
  rejected: `direct-answers` ≠ `telegraph-speak` ≠ `token-efficiency`).
- New frugality rules. This roadmap shrinks the existing surface only.
- Cross-host parity beyond Augment + Claude Code (sibling roadmap
  scope).

## Reference

- Council inputs: `agents/council-questions/trim-frugality-canon.md`.
- Council outputs: `agents/council-responses/trim-frugality-canon.json`.
- Sibling: `road-to-always-budget-relief.md` (structural lever).
- Sibling: `road-to-rule-hardening.md` (obligation surface).

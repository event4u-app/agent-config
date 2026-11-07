<!-- evidence-type: analysis -->

# Slim vs full end-reviewer — verdict comparison (2026-11-06)

**Roadmap step:** `road-to-token-economy-dispatch-followup` 3.2a.
**Pre-registration:** `agents/evidence/preregistration/slim-reviewer-verdict-comparison-20261106.md`
(original text plus three amendments, each committed before the calls it governs).
**Runner:** `src/scripts/bench_slim_reviewer.ts`; scoring `src/scripts/_lib/slim_reviewer_score.ts`.
**Raw calls, ledger, scored rows:** `agents/evidence/analysis/slim-reviewer-2026-11-06/`
(`raw/`, `ledger.jsonl`, `results.json`).
**Prompts:** `agents/evidence/analysis/slim-reviewer-2026-11-06/prompts/` —
`agent-full.md` and `agent-slim.md` (the two reviewer definitions), one
`<fixture>.md` per fixture (the user prompt, identical for both arms). The parent
relay wrapper is `parentPrompt()` in the runner.

## Verdict — FAIL against the bar, on partial coverage

| Bar component | Required | Measured | |
|---|---|---|---|
| Verdict agreement | ≥ 90 % | **10 / 11 = 90.9 %** | pass |
| Slim false positives on the contested controls | ≤ full | **slim 2 / 3, full 1 / 3** | **fail** |
| **Bar** | both | | **FAIL** |

**Coverage: 11 of 17 fixtures.** The $20 cap ended the run before
`df-logic-02, df-offbyone-02, df-race-02, df-empty-02, df-secsmell-02, df-ctl-02`
(Amendment 3 fixed this order in advance, before any verdict was read). Agreement
is measured on 11. With the six missing fixtures, the full-set agreement
would be anywhere from 10/17 to 16/17. The false-positive half of the bar does
not depend on them, because all three contested controls ran, and that half
fails on its own.

## Per-fixture verdicts

| Fixture | Kind | Slim verdict (findings) | Full verdict (findings) | Agree |
|---|---|---|---|---|
| pv-01-hollow | planted | NOT READY (charge.ts ×2, charge.test.ts) | NOT READY (charge.ts ×2, charge.test.ts) | ✅ |
| pv-02-control | control | READY | READY | ✅ |
| df-logic-01 | planted | NOT READY (canView.ts) | NOT READY (canView.ts) | ✅ |
| df-offbyone-01 | planted | NOT READY (lastN.ts) | NOT READY (lastN.ts) | ✅ |
| df-race-01 | planted | NOT READY (increment.ts ×2) | NOT READY (increment.ts ×2) | ✅ |
| df-empty-01 | planted | NOT READY (Avg.tsx) | NOT READY (Avg.tsx) | ✅ |
| df-secsmell-01 | planted | NOT READY (find.ts) | NOT READY (find.ts) | ✅ |
| df-ctl-01 | control | READY (clamp.ts note) | READY | ✅ |
| ac-clean-01 | contested control | **NOT READY** (resolve-config.ts high: `NaN`/`Infinity` pass `== null`) | READY | ❌ |
| ac-clean-02 | contested control | READY (ring-buffer.ts low) | READY (ring-buffer.ts note) | ✅ |
| ac-clean-03 | contested control | **NOT READY** (workspace.ts high ×2: bare `catch {}`, traversal) | **NOT READY** (workspace.ts must-fix ×2, same two) | ✅ |

## The four endpoints

| Endpoint | Slim | Full |
|---|---|---|
| 1. Verdict agreement | 10 / 11 (90.9 %); the one disagreement is `ac-clean-01` | |
| 2. Missed planted defects (of 6 scored) | 0 | 0 |
| 3. False positives, contested controls (of 3) | 2 (`ac-clean-01`, `ac-clean-03`) | 1 (`ac-clean-03`) |
| 3b. False positives, all controls (of 5 scored) | 2 | 1 |
| 4. Priced cost, 11 scored fixtures (whole call, parent included) | **$4.47** | **$8.93** |
| Reviewer subagent tokens per fixture (host footer, mean) | **14,819** | **104,013** |

**Reading the cost.** Every call runs a relay-only parent session that loads
the ~100k-token hierarchy, in both arms. Its cold cache write lands on
whichever arm runs first for a fixture, and the order alternated. Taking the
second call of each pair, the reviewer's own cost is about $0.23 (slim) against
$0.51 (full). Taking the first call, it is $0.62 against $1.06. The subagent
token count, 7× smaller for slim, is the cleaner measure. The parent is
harness overhead that a real end review, dispatched from the session already
running, does not pay a second time.

## What the failure is, read narrowly

- On the planted defects the arms are indistinguishable: both caught 6 of 6 and
  cited the same files.
- The bar fails on a single fixture, `ac-clean-01`. There the slim reviewer
  reasoned from the requirement line "behaves correctly for every input its
  signature admits" to `NaN`/`Infinity` passing a `value == null` guard, and
  called that `high`. The full reviewer read the same prompt and said READY.
  The slim digest carries the R2 packet's severity grid ("wrong behaviour … a
  stated requirement not met" is `high`), which the full arm does not. That is
  a plausible mechanism. It is not established: N = 1 per fixture.
- `ac-clean-03` was flagged NOT READY by **both** arms, for the same two
  findings. So contested-control false positives are not a slim-only property.
  The generic requirement line probably invites them in either arm.
- Per the pre-registration, the result is not tuned: no rerun, no prompt or
  digest change.

## Deviations from the original pre-registration (all recorded before the calls they govern)

1. **Harness (Amendment 1).** Run as the session agent (`--agent`), the host
   ignores `omitClaudeMd`: probe v1 showed the user-`CLAUDE.md` marker in both
   arms. The reviewer is therefore dispatched as a subagent of a relay-only
   parent, and scored from its own `tool_result`. Fixtures moved under
   `~/.cache/slim-reviewer-runs/`, so the user-level rules hierarchy loads, as it
   does in a real review in this account.
2. **Per-call cap $1 → $2 and context measure (Amendment 2).** The full arm's
   cold call exceeds $1. `stream-json` carries no subagent request events, so the
   context measure is the host's `subagent_tokens` footer. Probe v3 passed the
   check: full 100,716 tokens with the marker, slim 10,675 without it.
3. **Order and partial coverage (Amendment 3).** See above.

## Spend

**$18.13 of the $20 cap** (`ledger.jsonl`): probes $2.92 (v1 $0.10, v2 $1.11,
v3 $1.71), scored run calls $13.40, and two unpaired calls that
are booked but not scored, $1.81 (`df-logic-01` full from the stopped first
invocation, `df-ctl-02` slim, cut off by the guard before its pair). The guard
never let a call start once ledger + $2 would exceed $20. The total never went
above $20.

Model: `claude-sonnet-4-6` was accepted by the CLI; every call billed only
that model (`models` in each raw file).

## Limits

- 11 of 17 fixtures, N = 1 each. One disagreement moves agreement by 9 points.
- `production-validator`'s own remit is hollow implementations. The digest's R2
  review grid widens the slim reviewer's remit beyond the body both arms share.
  That widening is part of the arm the step defines, so it is measured here, not
  controlled away.
- The full arm ran outside any repository: user-level hierarchy, no project
  `CLAUDE.md`. A real review inside a consumer repo loads more.
- The `pv-hollow` fixture's source comments name the planted stub. Both arms saw
  the same text.

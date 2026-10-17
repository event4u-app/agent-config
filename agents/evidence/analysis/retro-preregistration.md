<!-- evidence-type: analysis -->

# Retro — pre-registration before any triage code

**Date:** 2026-10-17 · **Step:** `road-to-a-retro-the-merge-runs` 0.5 · **Pin:** `origin/main` at `debb26d18`
**Status:** hypothesis. Nothing below has been run against the gold set, and nothing
below may be tuned silently. Step 5.3 resets these values as a documented revision of
`docs/contracts/retro-v1.md`, citing the 30-day dogfood (5.2).

This file fixes four things before the first line of triage code exists: the start
values of the triage score, the daily model-retro budget, the catch-up window, and a
labelled gold set for false-negative recall. It also names what Phase 5 will measure,
so the dogfood cannot pick its own yardstick after the fact.

## Order of work, and why it matters

The gold set was labelled **before** the scoring table was written, and the scores
were **not** computed over it. A table fitted to the gold set would turn recall into a
self-fulfilling number. The two sections are kept in that order below.

## 1. Gold set — 30 merged PRs

The last 30 merged PRs on `main` at the pin (#2399-#2433, numbers that never merged
skipped). Facts per row: CI heads = distinct head SHAs with a workflow run on the PR
branch; red heads = those with at least one failing run. Read with `gh run list
--branch <head-ref>` on 2026-10-17. No PR had a review thread; no merge SHA was
reverted on `main` afterwards (`git log --grep "This reverts commit"` since
2026-10-14 matched only in-PR reverts).

| PR | heads | red | label | reason class |
|---|---|---|---|---|
| 2433 | 3 | 2 | worth | two red heads before green |
| 2430 | 2 | 0 | not | smooth |
| 2429 | 3 | 2 | worth | two red heads before green |
| 2428 | 1 | 0 | not | smooth; itself a record of refused reviews |
| 2427 | 1 | 0 | not | smooth |
| 2426 | 1 | 0 | not | smooth follow-up test |
| 2424 | 2 | 0 | worth | two of its own commits reverted inside the PR on a ratification gate |
| 2423 | 1 | 0 | not | smooth |
| 2420 | 2 | 1 | not | one red head, fixed in one iteration |
| 2419 | 2 | 1 | not | one red head, fixed in one iteration |
| 2418 | 3 | 2 | worth | two red heads before green |
| 2417 | 1 | 0 | worth | a fix PR: repairs a defect an earlier merge shipped |
| 2416 | 4 | 2 | worth | two red heads before green |
| 2415 | 1 | 0 | not | smooth |
| 2414 | 2 | 1 | not | one red head, fixed in one iteration |
| 2413 | 1 | 0 | not | smooth docs |
| 2412 | 2 | 1 | not | one red head; consolidation, not a defect |
| 2411 | 3 | 2 | worth | two red heads before green |
| 2410 | 3 | 0 | not | three heads, no red |
| 2409 | 3 | 2 | worth | two red heads before green |
| 2408 | 2 | 0 | worth | a baseline had to be lowered right after the previous drain batch |
| 2407 | 2 | 1 | not | one red head, fixed in one iteration |
| 2406 | 2 | 0 | worth | its merge needed the follow-up #2408 |
| 2405 | 1 | 0 | not | smooth ADR |
| 2404 | 3 | 1 | not | one red head |
| 2403 | 1 | 0 | not | smooth |
| 2402 | 1 | 0 | not | smooth docs |
| 2401 | 1 | 0 | worth | fixes what an end-to-end run found after #2399 |
| 2400 | 2 | 0 | not | smooth |
| 2399 | 1 | 0 | worth | its merge needed the follow-up #2401 |

**12 worth, 18 not.** Four of the twelve (#2424, #2408, #2406, #2399) show no red head
at all; they are the false-negative test for any score that reads CI alone, and two of
them (#2406, #2399) are only recognisable from a **later** PR — a signal a merge-time
retro cannot have and the daily sweep can.

## 2. Gold set — 30 sessions

The 30 most recently updated session end-of-life files in the main checkout
(`agents/runtime/state/session-eol/`), by hashed file key (12-hex prefix — the key is
already a hash, never a session id). Counters are as stored; `asst` = assistant
records, `ctx` = final context tokens. Labels were read from the session's own user
prompts, locally; **no prompt text is recorded here**, only a reason class.

| key | turns | asst | tools | ctx | compactions | label | reason class |
|---|---|---|---|---|---|---|---|
| ec42165a7602 | 105 | 1955 | 1122 | 437032 | 3 | worth | user correction about who answers questions |
| b52d31e7445d | 8 | 946 | 582 | 548953 | 1 | worth | user correction about closing work |
| 65c31692c757 | 2 | 56 | 25 | 240763 | 0 | not | task outside this repository |
| 9cf99720e301 | 157 | 1728 | 890 | 770085 | 1 | worth | user correction about cheap questions |
| 212b70adcb34 | 44 | 1067 | 584 | 760907 | 0 | not | approvals and continuations only |
| 8bbd4093a899 | 11 | 158 | 78 | 347113 | 0 | not | approvals only |
| f0b4f91950dd | 5 | 199 | 109 | 462616 | 0 | not | analysis task, no friction |
| 7eec1ef8d12d | 1 | 161 | 90 | 322459 | 0 | not | single analysis prompt |
| f2d078d80a37 | 15 | 289 | 139 | 500708 | 0 | worth | user correction about question count |
| c3c312166f11 | 3 | 943 | 701 | 921664 | 0 | not | single continuation |
| cd57bc5fac3a | 6 | 277 | 137 | 490348 | 0 | not | approvals only |
| dbee276c843e | 10 | 143 | 71 | 349715 | 0 | not | single approval |
| 1baaff1697cf | 21 | 643 | 336 | 559407 | 0 | worth | a release that had to be repaired |
| 72588f3040fb | 8 | 1628 | 1060 | 742832 | 1 | worth | CI failure repair |
| 89096d67d141 | 27 | 570 | 310 | 618636 | 0 | worth | external review findings; blocked base sync |
| 209ded955c33 | 12 | 170 | 103 | 429516 | 0 | worth | strong user correction on output |
| 6b7a719e8516 | 14 | 1147 | 692 | 371165 | 1 | worth | CI still red after a claimed fix |
| a99aa1b4a677 | 4 | 156 | 81 | 413799 | 0 | not | iterative design, no correction |
| 7a2d63767b4e | 5 | 334 | 169 | 524642 | 0 | worth | repeated "not good enough" iterations |
| 7eedd5a1ff0f | 2 | 32 | 20 | 230520 | 0 | worth | user reports a package defect |
| 163b53af6b16 | 40 | 2131 | 1271 | 315220 | 2 | not | continuations and a release watch |
| f838b470a29d | 37 | 868 | 464 | 846824 | 0 | worth | user correction: work in a worktree |
| 0adefd998d98 | 72 | 1254 | 692 | 663294 | 1 | not | continuations only |
| 36cf345d9c19 | 37 | 1097 | 503 | 350402 | 1 | worth | user: the PR is not finished; external review |
| ab84d45acdf5 | 2 | 5 | 3 | 215198 | 0 | not | continuation prompt, near-empty |
| f1973266a7c4 | 7 | 413 | 244 | 366072 | 1 | worth | permission friction the user had to clear |
| 139299b57df5 | 89 | 356 | 111 | 535708 | 0 | worth | strong user correction about permissions |
| 030a506df1bd | 0 | 0 | 0 | — | 0 | not | empty session, no transcript |
| 89032c583487 | 9 | 278 | 139 | 542886 | 0 | not | approvals only |
| 10a3804e0472 | 24 | 441 | 209 | 588311 | 0 | not | feature build, approvals only |

**15 worth, 15 not.** Eleven of the fifteen are worth a retro **because of a user
correction or a user-reported defect** — a signal the session facts do not carry under
D12 (no transcript by default). The facts carry it only when the correction became a
self-repair record or an interruption-ledger line. That gap is the main thing the
recall measurement in 5.2 is expected to expose, and it is named here so a low recall
reads as the predicted gap rather than as a surprise.

### Who labelled, and the independence limit

Both gold sets were labelled by the agent session that also writes the scoring table
below (claude/host). That is the evaluator-independence weakness the package's own
rule names: the author of a measure labelling its own yardstick. The mitigations are
the order of work above (labels first, table second, no scores computed over the
labels) and the reason class on every row, which makes each label checkable. **A
second labelling by the owner or an independent session before 5.2 is recommended;**
where the two disagree, 5.2 reports recall against both rather than choosing one.

## 3. Triage score — start values (hypothesis)

`missing` never scores and never subtracts (contract: a missing field never lowers a
score). PR size alone never scores: a large PR is not a friction signal.

**PR units** — `analyse` at **score ≥ 3**, else `skip:low-signal`:

| Signal | Points |
|---|---|
| each red head (the first push included), capped at 3 | +2 |
| three or more CI heads | +1 |
| a commit inside the PR that reverts another commit of the PR | +3 |
| a later revert of the merge commit on the base | +5 |
| a later PR naming this one as the defect it fixes (sweep only) | +4 |
| each review thread, capped at 3 | +1 |
| a drain-summary row with a conflict class | +1 |
| a drain-summary disposition `twice-exhausted` | +3 |

**Session units** — `analyse` at **score ≥ 3**, else `skip:low-signal`:

| Signal | Points |
|---|---|
| a self-repair record in the session's time window | +4 |
| each compaction, capped at 2 | +1 |
| two or more `ask` or `handback` interruption lines | +1 |
| 20 turns or more | +1 |
| zero assistant records | forces `skip:low-signal` |

A session whose PR already has a retro is `covered`; a retro session is `covered`
(K5). Ties at the budget line break by recency, newest first.

## 4. Budget and window

- **Daily model-retro budget (D7):** 3 units per local day, highest score first; the
  rest `deferred`. No money ceiling by default.
- **Catch-up window (D8):** 5 local days; older units are `expired`. The window stays
  below the 7-day session-state TTL (`src/scripts/janitor.ts`, `ttlDays: 7`).
- **Backlog stop (5.4):** more than **15** `deferred` units pauses the sweep and keeps
  `/retro` working. 15 is five days of the start budget.
- **Triage latency (5.4):** p50 above **2 s** in the probe is reported by `/retro status`.

## 5. What Phase 5 measures

Per path (merge, forge merge, sweep) and over 30 days: units seen; analysed; skipped
by reason; `covered`; `deferred`; `expired`; the share of analysed units yielding
`none`; landed learnings; recurrence after landing per comparable exposure, read from
the per-target counts that already exist; time and token cost per analysed unit;
discovery latency (merge or session end → queue entry); **recall** of the triage
against both gold sets above; and a counterfactual line comparing merge-only,
sweep-only and both. An honest null is an allowed outcome. A recurrence count is not
read as causation.

## Revisit if

The owner or an independent session relabels either gold set and disagrees on more
than 5 of 30 rows — then the labels, not the scores, are the first thing 5.3 revises.

---
title: Drain run summary — 2026-09-11
date: 2026-09-11
---
<!-- evidence-type: analysis -->

# Drain run summary — 2026-09-11

One roadmap in scope: `road-to-delivery-on-hook-hosts`, the file carrying the
only open blocker in the live inventory. It reached **13/16 and parked**, not
16/16, and the reason is a finding rather than unfinished work.

## PRs

| PR | Branch | State |
|---|---|---|
| [2004](https://github.com/event4u-app/agent-config/pull/2004) | `drain/delivery-on-hook-hosts-park` | open · 31 of 32 checks green · 1 red, owner-reserved (below) |

## Council decisions

Four rounds, 2/2 present each, blind peer review, subscription transport,
$0.0000 billed. Quota after the run: anthropic 9/50, openai 9/50.

| # | Question | Verdict |
|---|---|---|
| 1 | Disposition of `no-host-observed-true-injection` after the first round that tested the substantive E3 bar | **2/2 — amend E3 prospectively** to a predeclared externally observable obligation class; keep all four conditions; scope any admission to that class; escalate to descope at a stated boundary |
| 2 | How should the roadmap terminate, given one mis-stated acceptance criterion | **2/2 — 1a + 2b**: tick the AC with a full in-place correction accounting for every rule; park in `later/` **only** behind an enforceable wake |
| 3 | The confound, put as a premise change | **split label, converged terms** — anthropic `E3opt` (not measurable as specified), openai `E2` (clean environment only, auto-escalating). Both rejected "no change"; both held narrowing the witness class cannot cure an environment-level confound |
| 4 | A lapsed beta contract blocking every PR | **2/2 — split the contract**, promote only the enforced half. **Recorded as advice and not executed** — see Reversals |

## The finding

`road-to-delivery-on-hook-hosts` waits on one transcript in which a rule body
**delivered by the `rule-inject` hook concern** is visibly acted on. Four
ordinary-work turns were judged by fresh independent readers on a neutral
four-question prompt: one clean NONE, two UNCLEAR, one NONE on a defective
packet. Condition 1 passed twice; condition 2 failed 4/4.

Then the enumeration that round 1's disposition called for found why:
**106 of 106 `type: auto` rules already carry a byte-equivalent obligation body
in the same session unconditionally** — 89 body-identical in `~/.claude/rules/`,
3 differing by one blank line, 14 inline in the system prompt. The injected copy
adds no text, so removing the injection does not remove the body, and the
intervention varies *one copy versus two* rather than *absent versus present*.

The four results are therefore **non-identifying observations, not negative
evidence** about the corpus or the mechanism. Detail:
`agents/evidence/analysis/e3-candidate-round-2026-09-11.md`.

## Closed

- **AC-4** — ticked on re-measurement; it was held open by a rationale that went
  stale when the predecessor merged on 2026-09-08.
- **AC-3** — ticked with a full correction. `102/102` was a miscounted
  denominator, wrong before any result existed. Re-measured: **106 = 97
  lowerable + 9 with nothing to lower**, one more on each side than step 3.1
  recorded (`telegraph-speak` carries no `triggers:` key and was missed).
- **The census pin** — was dangling on a commit that is not an ancestor of HEAD;
  now pins to the commit carrying the record it renders.

## Parked

`road-to-delivery-on-hook-hosts` → `agents/roadmaps/later/`, at 13/16. The three
remaining items are not actionable and not abandonable, and K6 authorises
descope only at the boundary reached without a witness. The wake is
machine-readable, which is what round 2 conditioned the park on: `entry_condition`
(what/when/who) and `review_by: 2026-12-08`, both gated by
`lint_roadmap_later_disposition`, with `agent-config gates --all` evaluating the
condition on every run. Counter starts at 0.

## Reversals

**One, and it is the honest part of this run.** The lapsed beta contract
blocking CI was first disposed of as the council advised — the enforced half
promoted to `stable`, the declaration half split into a new beta contract with a
falsifier. Both edits were **reverted** on finding
`agents/roadmaps/stubs/road-to-fresh-beta-lapses-2026-09.md`, which records that
all four legal actions on a beta marker are public statements about what
consumers may rely on, and that `decision-revisit-gate`'s reserved set puts them
out of agent reach in either direction — a class on which a council had already
declined twice on 2026-09-06. Council agreement does not convert an
owner-reserved transition into a decidable one.

What survived is the part that was in reach: the measurement. The
`Primary-Goal:` line the contract asks of every minor release appears in **0 of
the last 6 release PRs**, while the same contract's `Rollback:` obligation is
mechanically enforced and exits 0. One document, two obligations, opposite
records — an asymmetry the 2026-09-06 rounds did not have. Recorded at
`agents/roadmaps/stubs/road-to-a-primary-goal-that-is-asked-for.md`.

## Descopes

None. K6 stands; no roadmap step was descoped this run.

## Open, and blocking

`docs/contracts/release-sizing.md` lapsed its `keep-beta-until` on 2026-09-10.
The lapse is FRESH, the frozen baseline may not grow to absorb it, and the check
is **required** — so it reds every PR in the repository, including this run's,
until the owner picks one of promote / extend / supersede / accept-the-lapse.
That is the one red on PR 2004 and the only thing standing between it and green.

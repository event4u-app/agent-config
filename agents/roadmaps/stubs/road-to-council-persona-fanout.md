---
complexity: lightweight
---

# Stub: road to council persona fan-out

> **Stub — not active work.** Authored by the inbox drain of 2026-08-22 from a
> dropped analysis artefact. It records a **verified structural gap** and a
> **proposal for it** — the gap is measured against this tree, the proposal is
> not a decision and nothing here is half-shipped.
>
> **Promotion note.** The three shared promotion criteria in
> [`README.md`](README.md) — recruited customer, funded security audit,
> maintainer ADR lifting a Hard-Floor item — govern the six org-mode stubs and
> **do not** govern this one: it introduces no org surface, needs no customer,
> and crosses no Hard Floor. Its gate is the pre-registered bench in § 4 and the
> blocker below, and nothing else.

## 1. The verified gap — five personas, at most two seats

Replace-mode enforces **one advisor per provider**. `plan_advisor_swap`
(`src/scripts/ai_council/advisors.ts:140`) walks the enabled advisors and throws
`CouncilConfigError` when two bind the same member (`:151-155`), with the
invariant stated in its own docstring at `:137-139`: *"replace-mode runs one
advisor per provider so the call plan never doubles up by accident."*

`src/agent-src/personas/advisors/` holds **five** advisor personas —
`contrarian`, `executor`, `expansionist`, `first-principles`, `outsider`. With a
typical two-provider configuration, at most **two of the five** can seat in a
run, and which two is a config-order accident rather than a choice about the
question being asked.

**The consequence is not only a lost lens.** `select_chairman`
(`src/scripts/ai_council/chairman.ts:42`) filters `auto`-mode candidates to
members that did **not** deliberate (`:70`) and falls back to host when the pool
is empty (`:71-76`). So a seated-but-non-deliberating member re-enables
`chairman: auto` **by construction** — the chair is a by-product of who was
left out, which is a property worth naming before any fan-out changes who is
left out.

**The cost invariant that bounds any answer.**
`src/skills/ai-council/references/advanced-modes.md:206` promises replace-mode
*"never adds calls"* — only a wider per-call input estimate — and `:217` restates
the one-per-provider invariant as a config error. Any fan-out therefore
**breaks a documented guarantee**, which is why it must be default-OFF and must
surface every added call in the cost estimate rather than in a footnote.

## 2. The proposal — marked as proposal, not as a decision

An `advisors.fanout` flag, **default `false`**. When set, the call plan becomes
plain members **+ (advisors − 1)**: each additional advisor is its own call
against its own provider seat, so the per-call cost model is unchanged and only
the call *count* moves — visibly, in the estimate, before the run.

Default-off is not caution theatre. It is the only shape compatible with
`advanced-modes.md:206`: a flag that is off preserves the documented guarantee
for everyone who does not set it, and a flag that is on states its own cost.

## 3. The rejected alternative, and the reason it is rejected

**One call carrying five personas**, where persona *k* is conditioned on the
outputs of personas 1..k−1 in the same completion. Cheaper by four calls, and
rejected: the anti-conformity directive
(`src/scripts/ai_council/prompts.ts:178`, `ANTI_CONFORMITY_DIRECTIVE`) instructs
a seat to *"defend a position you still believe is correct"* and to change only
against a **named** flaw. Inside one completion there is no seat boundary to
enforce that across — persona *k* reads 1..k−1 as its own prior text, so the
directive cannot be applied between them and the conformity drift it exists to
counter is exactly what sequential conditioning invites. Kept here so the option
is not rediscovered as new.

## 4. Pre-registered bench — three arms, decided before the numbers

The substrate exists: `internal/bench/adversarial-council` (`corpus.json`,
`runs/`, `subtlety-distribution.md`).

| Arm | What it runs |
|---|---|
| **A** | Today — replace-mode, one advisor per provider, `fanout: false` |
| **B** | Fan-out — plain members + (advisors − 1) |
| **C** | Plain-calls control — the same *call count* as B on **one** provider, no persona differentiation |

**Primary metric: unique load-bearing findings**, deduped by the helper this
tree already has — `is_near_duplicate` (`src/scripts/ai_council/debate_gates.ts:32`),
backed by `jaccardSimilarity` (`src/scripts/_lib/text_similarity.ts`). **No
LLM-as-judge**, deliberately: an LLM grading arms whose outputs it also produced
is the self-preference shape a bench is supposed to exclude.

**Decision rule, written before the run:**

- Promote **only** if **B > A** *and* **B > C**.
- **B ≤ C** → publish an honest null and close this stub `rejected`. Arm C is
  the load-bearing control: if the same number of undifferentiated calls finds
  as much, the personas bought nothing and the finding is about call count.
- **B > C but B ≤ A** → close `rejected`, with a `revisit-if` on a **third
  configured provider**. Two providers give arm B no independent chair (§ 1), so
  a null under two providers does not settle three.

An honest null closes this stub exactly as cleanly as a promotion does. A
deferral is the only outcome the rule refuses.

## Blockers

### blocker: b-fanout-bench-spend

- **Status:** open
- **Owner:** maintainer
- **Blocks:** promotion only. §§ 1-3 are complete and need nothing external —
  the gap is read out of this tree and the proposal and the rejected alternative
  are written. What is blocked is the § 4 bench, and therefore any decision to
  ship the flag.
- **What to do:** pick exactly one —
  (a) authorise the three-arm bench spend over `internal/bench/adversarial-council`
  and run A / B / C on the same corpus in one sitting, recording the deduped
  unique-finding count per arm; or
  (b) decline the spend and close this stub `rejected` on the recorded gap
  alone, keeping §§ 1-3 as the standing record of why the one-per-provider
  invariant is a real ceiling and not an oversight.
  Option (b) is a complete outcome, not a deferral — it closes on evidence about
  cost rather than on evidence about value, and it says so.
- **Why it is not an agent step:** arm B multiplies paid provider calls by the
  advisor count, and the decision to spend that is a cost decision, not a build
  step. Running arms one at a time across days would also break the same-corpus
  same-sitting condition the comparison rests on.
- **Recommendation:** (b) for now, and keep the flag permanently opt-in even if
  (a) later runs. With **two** configured providers, arm B has no independent
  chair — every seat deliberates, so `select_chairman` falls back to host
  (`chairman.ts:71-76`) — and an independent chair is the benefit the proposal
  leans on. Buying the bench before a third provider exists measures the arm
  without the property that motivates it.
- **If you do nothing:** the gap stays recorded and unfixed. Three of five
  advisor personas remain unseatable on a two-provider council, which two seat
  stays a config-order accident, and `advanced-modes.md:206`'s never-adds-calls
  guarantee stays true — the status quo is coherent, which is why this can sit
  here indefinitely without breaking anything.
- **Resolved when:** either a dated record under `agents/evidence/` carries the
  per-arm deduped unique-finding counts for A, B and C from one sitting over one
  corpus, with the § 4 decision rule applied to them verbatim; or this stub
  carries an explicit `rejected` close naming option (b) and the spend decline.

## Seed content on promotion

- Write the corpus slice and the dedup threshold **before** the first arm runs.
  The primary metric is a count over a similarity threshold, and choosing the
  threshold after seeing arm B is how a null becomes a promotion.
- Arm C first, not last. It is the arm most likely to end the question, and
  running it first means arms A and B are only paid for if C leaves something to
  measure.
- Default-off is not negotiable on promotion. `advanced-modes.md:206` is a
  published guarantee; a fan-out that fires without the flag breaks it for
  configurations that never asked.
- Surface the added calls in `council:estimate` output, in the same line shape
  the advisor swap already uses (`advanced-modes.md:200-204`) — an added call
  that appears only in the invoice is the failure this bullet exists to prevent.
- Do **not** touch the one-per-provider throw (`advisors.ts:151-155`) as a
  shortcut to the flag. It is the invariant replace-mode's cost guarantee rests
  on; the flag adds a second plan shape beside it rather than weakening it.

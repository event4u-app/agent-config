---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to the batch-elicitation kernel delta

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated
> stub. Created 2026-08-20 when
> [`road-to-user-out-of-the-loop.md`](../archive/road-to-user-out-of-the-loop.md) was
> drained. One item in that roadmap edits a **locked kernel rule**, which
> carries an own-PR plus soak guarantee no autonomous run can self-authorize,
> and which the `block-kernel-rule-writes` PreToolUse guard refuses at
> tool-call time. Framework of record:
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md).
> Outcome state recorded on the parent: **transferred** — chosen so that
> "archived" can never read as "achieved".

## The criterion, verbatim from the parent

Phase 1, Step 3:

> Draft the `ask-when-uncertain` carve-out "contract-time batch elicitation":
> one structured decision sheet per contract display counts as one question
> under the Iron Law; outside contract time the one-question-per-turn law
> holds verbatim. Kernel-adjacent — ships as its own PR with the required
> soak window.

And, from the parent's `kernel-soak-window` blocker, the criterion its
transferred arm closes on:

> the user authorizes or declines the `ask-when-uncertain` delta.

## What moves here — the complete list

| Item | Parent location | Why it moves |
|---|---|---|
| The `ask-when-uncertain` batch-elicitation carve-out | Phase 1 Step 3 | `ask-when-uncertain` is row 2 of the locked nine in [`kernel-membership § 4`](../../../docs/contracts/kernel-membership.md); a kernel-rule edit needs its own PR and a ≥ 24 h soak that no run may shorten or self-authorize. |
| Its own-PR soak window | Phase 1 Step 3 | Same act, and the guarantee is the reason the step could not ship inside a multi-concern drain commit. |

**Nothing else moves, and that is the correction this stub carries forward.**
The parent's blocker originally claimed four deltas were kernel-adjacent. Three
were not, verified against the tree on 2026-08-20 and again in this change:

- `autonomy-mechanics` is **not a rule** — it is a context at
  `src/agent-src/contexts/execution/autonomy-mechanics.md`, so the rules-tree
  path a kernel check would test does not exist. Its set-scoped delta landed
  in the drain run.
- `artifact-drafting-protocol` and `roadmap-progress-sync` **are** rules and
  are **absent from the locked nine**. Both deltas landed in the drain run.

A 4:1 scope overstatement in a blocker is the failure worth naming here: it
held three ordinary rule edits behind a soak window they never needed.

## Probe and producer — named, not wished

- **Producer:** the **kernel-rule maintainer**, in a session where a human
  authorizes the delta. Not "when someone gets to it": the write is denied by
  a `fail_closed: true` PreToolUse guard
  (`src/scripts/hooks/block_kernel_rule_writes.ts`) whose deny message names
  the human-owned exception registry as the only legitimate bypass, so no
  agent path exists at all.
- **Probe, two conjuncts, both required:**
  1. An authorization for the `ask-when-uncertain` batch-elicitation delta is
     **recorded** — in the delta's own PR or an ADR, not in a session
     transcript.
  2. The full interval required by
     [`kernel-rule-edits`](../../../src/agent-src/contexts/authority/kernel-rule-edits.md)
     has completed **without** the rollback criteria firing. That interval is
     **≥ 24 h between kernel-rule merges**, stated there as a behaviour-soak
     guarantee rather than a governance preference.
- **Measured reading, 2026-08-20, so a later reader can tell real movement
  from noise:**
  - Authorization records for this delta: **zero**. No PR, no ADR, no entry.
  - `ask-when-uncertain` in the locked set: **yes** — `kernel-membership § 4`,
    the second row of the nine-row table.
  - `block-kernel-rule-writes` bound on `pre_tool_use`: **yes**, at
    `hook_manifest.yaml:924`, `severity: blocking`, `fail_closed: true`.
  - Soak interval in force: **≥ 24 h**, `kernel-rule-edits.md:11`.

## What this stub is NOT gated on

The shared promotion criteria for the demand-gated stubs in
[`README.md § Promotion criteria`](README.md) — recruited customer, funded
security audit, ADR sign-off — do **not** govern this transfer. There is no
customer to recruit for a one-rule carve-out and no audit that clears a missing
authorization. The gate is the authority itself, exercised by a named human,
plus a clock. Promote when the probe's two conjuncts are both true, and delete
this stub when its single item is gone.

## Ruling of 2026-09-07 — DECLINED for this round

`road-to-asked-not-parked` reached this stub through its own
`kernel-ask-form-authority` blocker, which asked the same authority question one
step wider: whether ask-FORM authority may move out of
[`user-interaction`](../../../src/rules/user-interaction.md) and
[`ask-when-uncertain`](../../../src/rules/ask-when-uncertain.md) at all.

**Ruling: declined. Not authorized in this round; current behaviour unchanged;
no future ruling is prejudged.** Recorded 2026-09-07 by the AI council under the
standing drain delegation (2 seats, anthropic + openai; framework of record
[`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)).
A refusal preserves the status quo and is council-decidable on that framework;
an authorization would lower a locked-kernel floor and is categorically outside
it. The stub therefore stays open on its original criterion — nothing here
promotes or deletes it.

What the ruling covers, precisely:

1. **The `ask-when-uncertain` batch-elicitation carve-out** this stub already
   holds — unchanged, still parked, still gated on the same two conjuncts.
2. **The wider ask-form-authority delta** — moving the form prescription out of
   either kernel rule, into a contract, a host capability, or anywhere else.
   Declined for this round. Both files are retained verbatim; no file under
   `src/rules/` was modified by that roadmap.
3. **Five proposed new Iron Laws** from the source drafts. Refused with it:
   adding an Iron Law to a kernel rule is the same class of edit, and one of the
   five duplicates obligations
   [`no-cheap-questions`](../../../src/rules/no-cheap-questions.md) already
   carries — so at least one of the five is redundant on its own terms, before
   the authority question is reached.

**The option-`B` contradiction is resolved, on the sheet's side.**
[`contract-decision-sheet`](../../../src/agent-src/contexts/execution/contract-decision-sheet.md)
option `B` asked for the answer shape `"1=x, 2=y"`, which `user-interaction`'s
Pre-Send Self-Check names as a violation. `B` now takes a single row NUMBER, so
the sheet's answer domain is one token in every branch. That is the repair the
blocker named for the declined case, and it needed no kernel edit.

**Authorization records for this delta remain zero** — this ruling is a
refusal, not an authorization, and must not be read as one when the probe above
is next evaluated.

## The residual, stated rather than papered over

Everything the carve-out would authorize **already works** without it, and that
is why the transfer costs so little: the decision sheet ships
([`contract-decision-sheet`](../../../src/agent-src/contexts/execution/contract-decision-sheet.md)),
it is rendered inside the contract screen, and accepting it with `A` is one
keystroke. What is missing is the *rule text* saying that one sheet counts as
one question under `ask-when-uncertain`'s Iron Law. So the sheet is legal today
by the Iron Law's own reading — one decision point answered by one number —
and the carve-out would make that reading explicit rather than inferred.

The honest consequence: a reader who takes the Iron Law literally and the sheet
as N questions can conclude the sheet violates it. That ambiguity is the whole
cost of this transfer, and it is an ambiguity in prose rather than a gap in
behaviour.

---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to a gate pre-authorisation the agent cannot sign

> **Stub — not active work.** Drain-run transfer, 2026-08-20, from
> [`road-to-gate-autonomy.md`](../road-to-gate-autonomy.md) step 2.3.
> Council disposition **B**, outcome state **transferred**, per the framework of
> record in [`agents/evidence/council/drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md).
> One item moved here because it needs a write path the agent can neither
> perform nor verify: an authorisation signed by a human.

## Why this stub exists

Step 2.3 was blocked on `b-gate-budget-preauth`, and that blocker is now
**resolved** — option (a), a per-run cap and a rolling-7-day cap with an
append-only receipt ledger, shipped in the parent. So the obvious reading is
that 2.3 is unblocked. It is not, and the reason is the part the budget decision
does not cover.

2.3 asks the live-trigger-eval terminal abort to accept a **preauthorised
budget** in place of the `/dev/tty` keypress: *"consent moves from a keystroke to
a signed budget line, it is not removed."* The load-bearing word is **signed**.
The abort's threat model is *unconsented billable automation*, so the
authorisation it accepts must come from someone other than the process that is
about to spend. This tree has exactly one human-only write fence — the class-C
settings route, where `settings:set` and every agent write path refuse and only
the GUI's `PUT` or a hand-edit succeeds (`docs/contracts/settings-classes.md`).
The receipt ledger is **not** that fence: `agents/runtime/state/` is ordinary
agent-writable runtime state, so a flag that read an "authorisation" out of it
would let the agent consent on the user's behalf — which is the thing the abort
exists to prevent, reimplemented as a feature.

That is why the parent shipped the caps and stopped. The caps bound the **size**
of an authorised spend, and `gates --execute` still requires `--confirm` on every
class-1 run, so nothing in the parent removes a consent. Closing 2.3 needs a
decision nobody has taken — *where does a signed authorisation live* — and then a
human to sign one.

**No bypass has been built.** The abort is byte-for-byte the abort it was before
this run.

## What moved here — the complete list

1. Step 2.3 of the parent, in full. Nothing else.

The parent keeps the whole budget mechanism: the two class-C caps
(`roadmap.gate_budget.max_cost_per_run_usd`,
`roadmap.gate_budget.max_cost_per_rolling_7d_usd`), the ledger and its
append-only reader/writer in `src/agent-src/scripts/gate_budget.ts`, and the
class-1 execution path in `gate_execute.ts` that runs under the caps and
receipts what it spends.

## Probe, producer and baseline — transferred item, verbatim

Quoted exactly as it stands in the parent (where it carries `[-]`).

```
- [-] **2.3** The live-trigger-eval hard-abort gains a preauthorised-budget flag
      that refuses without a valid unspent ledger entry and spends it on run.
      The abort's threat model — unconsented billable automation — is
      **preserved**: consent moves from a keystroke to a signed budget line, it
      is not removed.
```

- **Producer:** the gate-autonomy maintainer, performing two acts in order.
  First a **decision**: where an authorisation lives so that the agent cannot
  write it — the class-C settings route is the only fence that exists today, so
  the default answer is a third `roadmap.gate_budget.*` key holding authorised
  blocker ids, but that is a choice the council did not make and this stub does
  not make for it. Then the **act**: signing one authorisation through that
  route, by hand-edit or the GUI `PUT`.
- **Probe**, both halves required:
  1. An authorisation artefact exists whose write path refuses the agent —
     concretely, `./scripts-run src/scripts/lint_settings_classes` lists it as
     class **C**, and it names a blocker id.
  2. The abort was not weakened while the flag was added:
     `grep -c 'Refusing to run under automation' src/scripts/skill_trigger_eval.ts`
     still returns `1`.
- **Why the probe is worded that strictly:** "a preauth flag exists" would go
  green on a flag reading the agent-writable ledger, which is the failure this
  stub is about. Only a class-C-fenced authorisation distinguishes a consent
  from a self-consent. And half 2 exists because the cheapest way to make half 1
  pass is to delete the abort.
- **Baseline 2026-08-20:** no authorisation artefact — `lint_settings_classes`
  reports `A=26 B=3 C=107` and none of the 107 is an authorisation key;
  `grep -rci preauthoriz src/scripts/skill_trigger_eval.ts src/scripts/rule_trigger_eval.ts`
  returns `0` for both files; the abort string count is `1`; the receipt ledger
  `agents/runtime/state/gate-budget-ledger.jsonl` does not exist, so zero
  class-1 spends have been receipted.

## Open ADR question — where the plan hash lives (added 2026-08-23)

Routed here by
[`road-to-deterministic-time-in-gates.md`](../road-to-deterministic-time-in-gates.md)
§ Routed elsewhere rather than becoming a phase there, because this stub already
owns the mechanism and a duplicate entry would red the estate ratchet for a
decision the routing roadmap does not own.

**The question.** Should a gate pre-authorisation be bound to its target by a
`plan_sha256` + `plan_path` pair in the ledger entry, and if so, where does that
pair live so the agent cannot write it?

**Why it is a precondition and not a relitigation.** `docs/decisions/ADR-239`
(~:79–90) records the council verdict as *mergeability-only until authorization
is target-bound and tamper-resistant*. "Target-bound" is exactly what a plan
hash supplies, so asking this addresses a **named** precondition of that verdict
rather than reopening it.

**Why it cannot simply be added to the ledger.** A `plan_sha256` in the ledger
IS the failure this stub is about: `agents/runtime/state/` is agent-writable, so
the plan file the hash covers sits on a path the agent controls, and the agent
would be hashing its own consent. The only human-only write fence in the tree is
the class-C settings route, which is the same fence § Transferred item already
names for the authorisation itself.

**What was checked, and one correction to the routing roadmap's premise.** That
roadmap asserts the six-hour `LEDGER_MAX_AGE_MS` widening "exists only as an
*uncommitted* edit in the maintainer's working tree". Reproduced 2026-08-23:
`git show HEAD:src/scripts/hooks/block_unauthorized_git.ts` reads
`30 * 60 * 1000` at `:527`, so the constant is at its correct value on the trunk
— but the guard's own docstring at `:506-525` records that the widening *was*
committed and left there before being restored. The value is right; the "never
committed" reading is wrong, and the difference matters because a
committed-then-reverted widening is a precedent this question has to price in.

**Producer:** the same maintainer act § Transferred item names — a decision
first, then a signed authorisation through the class-C route. No new probe: half
1 of the existing probe already requires the authorisation artefact to be
class-C, which a plan-hash binding would extend rather than replace.

## What this stub does NOT claim

It does not claim the flag is nearly done. It does not claim the caps make the
abort safe to bypass — they do the opposite, by making the size of a *consented*
spend bounded while leaving the consent where it was. And it records the honest
consequence: while this stub is open, every billable gate still needs a
keystroke, which is the § 0 defect the parent set out to remove and removed only
for the free half.

## See also

- [`road-to-gate-autonomy.md`](../road-to-gate-autonomy.md) — the parent; its
  `## Outcome` names this transfer.
- [`docs/contracts/settings-classes.md`](../../../docs/contracts/settings-classes.md)
  — the class-C fence that is the only human-only write path in the tree.
- [`agents/roadmaps/stubs/README.md`](README.md) — the class of stub this belongs
  to (§ The two classes) and the per-item promotion rule (§ Closing a drain-run
  transfer). The per-stub index table it used to point at was deleted 2026-08-21:
  it was an authored append surface that conflicted in every open CONFLICTING PR
  while duplicating what each stub already states.

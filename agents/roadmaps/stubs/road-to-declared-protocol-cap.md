---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to setting the declared-protocol read cap from data

> **Stub — not active work.** Holds one transfer made out of
> [`road-to-rule-coherence-followup.md`](../archive/road-to-rule-coherence-followup.md)
> Phase 5 (F5.1) by the autonomous drain run of 2026-08-20. It moved for the
> reason the drain framework's Rule 4 separates from a measured zero: the
> instrument the step assumes is **contaminated**, and a broken instrument
> transfers rather than reporting a null. Framework of record:
> [`agents/evidence/council/drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> § Framework, rule 4. Measurement:
> [`discipline-default-flip-census-2026-08-20.md`](../../evidence/analysis/discipline-default-flip-census-2026-08-20.md) § 4.

## The transfer

**Outcome state:** transferred.

**Original acceptance criterion, verbatim from the parent roadmap:**

> the cap cites a distribution and an n, or the 90-day branch fired; either way
> the provisional note is removed in the same change.

**Original trigger, verbatim:**

> **Trigger, whichever first** (round 3 rejected "once a distribution exists" as
> unfalsifiable — gradual, never urgent, and absence of complaints reads
> identically to absence of measurement): **≥ 10 declared-protocol sessions** →
> set the cap from their p95; or **90 days with fewer than 10** → that is itself
> the answer, declared protocols are rare, the cap is not load-bearing and drops
> back to the undeclared 5.

**Dependent steps moved — the complete list:**

1. **F5.1** — setting the cap of 8 in `src/rules/context-hygiene.md` from a
   distribution, or dropping it to 5 on the 90-day branch.
2. Removing the provisional note in the same change — the criterion's own
   "either way" clause, which is why it moves with the step rather than being
   done early. A rule that has lost its provisional marker while still carrying
   an unmeasured number is worse than one that admits the number is a guess.

## Why it could not be done in the run

Two independent reasons, and the second is the one that makes this a transfer
rather than a wait.

**The window is 14 days, not 90.** The falsifiable trigger landed in
`cb126e88c`, 2026-08-06, so the 90-day branch fires **2026-11-04**. Concluding
early from a 14-day window is precisely what round 3 rejected when it refused
"once a distribution exists".

**The session-counting branch has no working instrument.** Over the 1,226
transcripts written since 2026-08-06, a transcript grep returns 55 files for
`declared protocol` and 28 for `expected read count` — and every hit inspected is
the **rule's own prose**, delivered into the session preamble because
`context-hygiene` projects there, plus roadmap and ADR text discussing the cap,
plus this run's own grep commands quoted back in its own transcript. The search
vocabulary is the rule's vocabulary, so the instrument measures its own delivery
and not the behaviour it is supposed to count. Reporting its zero as a measured
zero would be the contaminated-null failure the framework's rule 4 exists to
separate out.

```
A DETECTOR WHOSE SEARCH TERMS ARE THE RULE'S OWN WORDING MEASURES DELIVERY,
NOT BEHAVIOUR. GREPPING HARDER DOES NOT FIX IT.
```

## What a working instrument looks like

Stated so the re-entry is a build, not a re-derivation. A declaration is valid
only if it states, before the reading starts, a falsifiable analysis goal, an
expected read count, and the output shape those reads feed. All three are
present *in the reply*, which is exactly where the rule's own prose also sits —
so the discriminator cannot be lexical.

The instrument therefore has to **mark the declaration at the moment it is
made** and leave a counter a later pass reads: a session-scoped record written
when a protocol is declared, in the shape `context_hygiene_hook` already uses
for `agents/state/context-hygiene.json` (tool-call count, loop signal, freshness
milestones). One field — declared-protocol read count for the session — turns
this from a text-mining problem into an arithmetic one, and it is the same
carrier the cap itself already depends on.

Building that carrier is a repository change and is **not** transferred; it is
open work anyone may pick up. What is transferred is the **decision the counter
feeds**, because until 2026-11-04 neither branch of the trigger can fire
regardless of how good the instrument is.

## Probe and named re-entry producer

**Producer:** the maintainer **`matze4u` (m.berg@galawork.de)**, on or after
**2026-11-04** — the first date on which the trigger's own second branch is
answerable.

**Detection probe** (three readings, and which one moves decides the branch):

~~~bash
# 1. Has the dated branch become answerable?
#    2026-08-20: 14 days elapsed of 90 → no. Fires 2026-11-04.
git log --format=%ad --date=short -1 cb126e88c

# 2. Does a declaration counter exist yet? (the instrument, not the decision)
grep -rn 'declared_protocol' src/scripts/hooks/ src/scripts/_lib/ | wc -l
# 2026-08-20: 0  → no counter, so the n branch is unanswerable by construction

# 3. Has the cap moved and the note gone?
grep -c 'LOWER BOUND' src/rules/context-hygiene.md
# 2026-08-20: 1  (src/rules/context-hygiene.md:137) → note still in place
~~~

Re-entry has happened when reading 3 returns 0 **and** the rule states either a
p95 with its n, or the 90-day branch and a cap of 5. Reading 3 going to 0 on its
own, with the cap still at 8 and no distribution cited, is not re-entry — it is
the failure mode this criterion's "in the same change" clause forbids.

## What promotion looks like

Promotion is **not** moving this file up a directory. This is one rule edit
behind one date. When a producer performs it, strike this transfer and delete
the file.

<!-- evidence-type: analysis -->

# The estate-ratchet deadlock falsifier has fired — measured, 2026-09-01

`road-to-blocked-quickwin-visibility` step 2.2. Every number below is followed by
the command that reproduces it, run against this tree at this commit. Nothing
here is quoted from the roadmap's own prose: the roadmap made the claim, and this
document is the independent measurement of it.

## The condition, in the council's own words

The AI council of 2026-08-24 recorded what would reopen the general question:

> evidence that the ratchet creates systematic deadlock — validated promotions
> blocked across more than two releases while user-facing defects ship — would
> argue for a mechanically capped provisional-promotion path rather than for
> loosening this rule. **One instance is not that evidence.**

Three things have to hold: a **validated** promotion, **blocked**, across **more
than two** releases that **shipped the defect**. Each is measured separately
below, because a conjunction closed on one met half is the failure this whole
drain run kept finding.

## 1. The validation date — 2026-08-23

Recorded in `agents/roadmaps/stubs/road-to-release-placeholder-guard.md`
§ Estate disposition: a 2/2 convergent council verdict states that *"promotion
readiness remains satisfied"* while *"estate authorization does not"*.

**A note on which date, because the roadmap and its own verify clause disagree.**
Step 2.1's prose says *"since its estate blocker opened"*, which gives **2**
(14.12.0 and 14.13.0, after the 2026-08-24 revert); its verify clause demands
*"3 or more"*. The roadmap's own § The measurement and its sibling both count
from the **validation date**, which gives 3. The validation-date reading is the
one that makes the step's verify true, and it is the one adopted here — **under
DELEGATED owner authority**, per the AI council of 2026-09-01 (drain run 14,
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, quorum 2/2, subscription
transport, `billable=0`). Both seats classified it as a **metric-semantic
amendment, owner-reserved, satisfied only through the run's explicit
delegation** — not as a clerical correction, and not as council-decidable. The
distinction is recorded because it is the difference between a decision that was
delegated and one that was never anyone's to make.

## 2. Three releases shipped after it

```bash
grep -hoE '^## \[[0-9]+\.[0-9]+\.[0-9]+\].*\([0-9]{4}-[0-9]{2}-[0-9]{2}\)$' \
    CHANGELOG.md docs/archive/CHANGELOG-pre-14.12.0.md \
  | sed -E 's/^## \[([^]]+)\].*\(([0-9-]+)\)$/\2 \1/' | sort -r | awk '$1>"2026-08-23"'
```

```
2026-08-31 14.13.0
2026-08-25 14.12.0
2026-08-24 14.11.0
```

Three. The condition asks for **more than two**, and 3 > 2 on the terms the
council set rather than on a reading of them.

**Both era files are read, and that is load-bearing.** `14.11.0` lives only in
`docs/archive/CHANGELOG-pre-14.12.0.md` after the era split — a count taken over
`CHANGELOG.md` alone returns **two**, and the falsifier silently never fires. The
roadmap's claim that each figure is *"reproducible in one command"* did not say
this; it is corrected here, and `CHANGELOG_ERAS`
(`src/agent-src/scripts/stubs_due.ts`) encodes the pair so the mistake is not
available to the next reader.

## 3. The defect shipped in every one of them — four marker lines each

```bash
for v in 14.11.0 14.12.0 14.13.0; do printf '%s ' "$v"
  awk -v v="$v" 'index($0,"## ["v"]")==1{f=1;next} f&&/^## \[/{exit} f' \
      CHANGELOG.md docs/archive/CHANGELOG-pre-14.12.0.md \
    | grep -c 'auto-derived, rewrite before merge'
done
```

```
14.11.0 4
14.12.0 4
14.13.0 4
```

**A correction to this document's own first measurement, recorded rather than
quietly fixed.** The first pass counted the `Curated head: fill before merge`
comment and read **1** per section, which contradicted the roadmap's **4**. The
roadmap was right and the measurement was wrong: a *marker line* is one of the
four `_auto-derived, rewrite before merge:_ …` bullets — Behaviour changes,
Default changes + migration, Security and correctness, Honest nulls — not the
instruction comment above them. Both constructs are real defects at the
publication boundary and they are **different** ones; conflating them would have
put a false number into an evidence file whose whole purpose is that a later
reader re-derives rather than trusts.

## 4. The falsifier now reports itself

```bash
agent-config stubs:due --json | jq '[.stubs[] | select(.blocked_quickwin)
  | {file, blocker_opened, releases_since_blocked}]'
```

```
agents/roadmaps/stubs/road-to-release-placeholder-guard.md
  (estate, 3 release(s) since 2026-08-23)
```

Before this change the condition existed **only as prose inside the stub it
constrains**, which meant the party it would reopen the question for was the only
party who could find it. It is now a number in the command a maintainer already
runs.

**`releases_since` counts strictly AFTER the date**, never on it: a release cut
the same day cannot have carried a fix the hold was blocking, and counting it
would inflate the very figure the council's condition is read against. A stub
with no `blocker_opened:` reports **null, never zero** — zero would read as *"the
falsifier has not fired"*, and absence is not a measurement.

Both properties are pinned by test and proven sensitive: replacing `>` with `>=`
reds 3 of 19; narrowing `CHANGELOG_ERAS` to the current era alone reds 1 of 19.
Both restores verified byte-identical by SHA-256.

## What this does NOT establish

It establishes the council's condition is **met**, not what follows from it. The
verdict named a *"mechanically capped provisional-promotion path"* as what the
evidence would argue for; specifying that path is Phase 3, and its cap, its
activation and its numbers are explicitly the owner's to set. Nothing here
promotes anything, and nothing here lifts the estate hold on
`road-to-release-placeholder-guard` — which remains exactly as blocked as it was,
now visibly rather than silently.

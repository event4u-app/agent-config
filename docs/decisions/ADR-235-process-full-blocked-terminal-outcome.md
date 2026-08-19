---
adr: 235
status: accepted
date: 2026-08-19
decision: process-full-blocked-terminal-outcome
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Reopen if a run is refused or reported blocked on a blocker whose real content
  is "wait for a date" or "wait for another roadmap", since the class taxonomy
  labels both as human-only and the report will read wrong to the person holding
  it; if a blocked report is ever produced while a runnable open step existed,
  since that is the false-positive failure the revalidation step is the only
  defence against and it would mean the defence does not work; or if the
  pre-dating condition is ever satisfied by a blocker the run authored, since
  that is the gaming vector the whole design rests on closing
---

# ADR-235 — `/roadmap:process-full` gains a `blocked` terminal outcome, not a sixth halt

## Status

Accepted.

## Context

`/roadmap:process-full` tells an autonomous agent to work every open step of a
roadmap to completion and open a PR. Its stop condition was `count_open == 0` or
one of **five, and only five,** halt conditions, guarded by an unusually
aggressive forbidden-reasons list ("running low on context", "quality would
degrade", "avoid a PR pile-up", "any agent-invented caution not in the five
halt conditions above" — *"INVENTING A HALT REASON IS A VIOLATION OF THE COMMAND
AND THE USER'S WILL"*). That aggression was earned: agents were stopping runs
early for comfort.

The contract had no answer for the most common real state of the estate.
Measured 2026-08-19, screening the twelve most nearly complete roadmaps on the
ACTION-vs-JUDGEMENT axis: **zero** could reach `count_open == 0` in one PR. Each
remaining open step needed a human action — flip branch protection, delete
committed evidence, authorise paid spend, install an absent binary, wait out a
soak window, use the maintainer's own machine, or edit a file an armed host hook
denies. Two of the strongest candidates were additionally held by live peer
sessions.

So a `process-full` invocation on such a roadmap could be neither obeyed nor
honestly declined. A prior council session had already reached the first half of
this: *"a roadmap that cannot reach `count_open == 0` has no legal stopping point
under that command"* — and rejected picking one regardless of its severity, which
is why the screen above produced no pick at all.

## Decision

Three changes, and the third is what keeps the first two safe.

1. **A runnable-work precondition** (§ 3c of `roadmap-process-loop`). If NO open
   step is runnable, the run does not start: it reports `blocked-preflight`, names
   each blocker with its class and clearing action, creates no branch and takes no
   grant.

2. **A `blocked` terminal outcome.** When `count_open > 0` and the runnable set is
   empty, the run terminates as `blocked` — reporting the work that DID close plus
   every blocker. `blocked` is **never** presented as completion, `count_open`
   stays above zero, and any PR opened on a blocked run is labelled partial
   progress in its first line. The runnable set is revalidated at the moment of
   reporting; one runnable open step rejects the claim and the loop continues.

3. **Structural separation from the five halts.** `blocked` is a terminal outcome,
   not a halt condition. The five stay "five, and only five", and their
   forbidden-reasons list keeps its full authority over mid-run stopping — with
   one entry added to it: *"this step looks human-gated"* is now explicitly a
   forbidden reason, because the new outcome is the most abusable thing on that
   page.

**Runnability is decidable, not felt.** An open step is not runnable only when a
blocker satisfies all four of: it existed in `## Blockers` **before this run
started**; its `Class:` is `2` (consent-once) or `3` (human-only), classes `0`/`1`
being agent-runnable by construction; its `Blocks:` field names the step; and it
names what would clear it. Every other open step is runnable — no citation means
runnable, and that default direction is deliberate.

## Consequences

**What this buys.** A `process-full` invocation on a human-gated roadmap now has
a legal, honest ending instead of an undefined one, and the common case — a bad
pick — is refused before a branch exists. The estate's real state becomes
reportable rather than a contradiction between the command and the tree.

**What it costs, and the mitigation.** The outcome is a way for the command to
decline, which is exactly the shape the forbidden list was built to eliminate.
The gaming vector is concrete: meet a hard step, write a `## Blockers` entry
claiming Class 3, cite it, stop. Condition 1 — the blocker must pre-date the run
— is the whole defence, and it is checkable from git rather than from the agent's
word. A blocker discovered mid-run is recorded, which is honest and useful, and
does **not** make the step non-runnable in that run.

**The `[~]` prohibition is load-bearing.** Deferring blocked steps to `[~]` would
let a run reach `count_open == 0` and report completion — laundering open work
through a glyph, which is what Iron Law 3 of `roadmap-progress-sync` catches on
the archival side. This was the single point the council split on, and the
rejecting seat was right: preserve `count_open > 0` and let the outcome carry the
truth.

**One imprecision, recorded rather than smoothed over.** The blocker class
taxonomy has four rows and none says *"waiting on time"* or *"waiting on another
roadmap"*. A soak window and a cross-roadmap dependency are authored as `3` today
(absence of `Class:` already means `3`), so they are decidable but mislabelled as
human-only. A fifth class is a taxonomy change with `lint_roadmap_blockers` behind
it and is not made here; the review trigger above names the condition that would
force it.

**Enforcement, stated honestly.** Nothing mechanical checks that a reported
`blocked` was genuine. `lint_roadmap_blockers` validates blocker *shape* and can
neither see a run's runnable set nor read a chat report, so the four-condition
test, the revalidation, and the partial-progress labelling are all
model-carried — the same honesty boundary `active-remediation` and
`ui-audit-gate` state for their own obligations. What IS deterministic is the
pre-dating condition's evidence: a blocker's arrival is a commit, and a reviewer
can check it.

## Alternatives

**A sixth halt condition.** Rejected on the council's reasoning and the repo's
own: the five halts interrupt *runnable* work, and folding an
exhaustion-of-runnable-work condition in among them would dilute the
forbidden-list's authority over mid-run stopping. "Six, and only six" reads as a
list that grows.

**Pre-flight refusal only.** Insufficient — it cannot see a blocker discovered
during a run, and the outcome for that case would stay undefined.

**Deferral to `[~]` with completion at `count_open == 0`.** Rejected: it launders
unfinished work into a success report.

**Fix the pick surface instead and leave the command untouched.** Rejected as
insufficient rather than wrong — `/roadmap:next` refusing to select such a roadmap
is a good idea and does nothing for a `process-full` invoked directly, which is
how this session's run started.

## References

- `src/agent-src/contexts/execution/roadmap-process-loop.md` § 3c and
  § Terminal outcomes — the normative text.
- `src/domains/product-basic/roadmap/process-full/command.md` § Terminal
  outcomes — the wrapper's own statement.
- `src/agent-src/templates/roadmaps.md` — the blocker `Class:` 0–3 taxonomy the
  runnable test reads, and `lint_roadmap_blockers` which enforces its shape.
- `src/rules/roadmap-progress-sync.md` Iron Law 3 — the archival-side gate whose
  reasoning the `[~]` prohibition mirrors.
- AI council 2026-08-19, 2/2 convergent on candidate C with the
  structural-separation refinement; the split on `[~]`-as-completion is resolved
  above in favour of the rejecting seat.

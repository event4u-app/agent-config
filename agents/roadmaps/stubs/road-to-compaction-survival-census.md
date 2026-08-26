---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to a compaction-survival census

> **Stub — not active work.** Transferred out of
> [`road-to-context-fidelity.md`](../road-to-context-fidelity.md) Phase 0 and
> Phase 1 on 2026-08-20 under disposition **B — outcome `transferred`**, recorded
> in [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> (council: anthropic + openai, quorum 2/2, one framework round plus one
> disposition round).
>
> **Rationale, quoted from the disposition record:** "The experiment requires
> live host behavior, manual compaction, and an external session-state
> directory; repository work cannot manufacture those observations."
>
> Nothing below was rejected on merit and nothing is half-shipped. Phase 1 was
> never started, and correctly so: it is gated on a number Phase 0 cf01 was
> supposed to produce, and cf01 is gated on a human action in a live session.

## Why this is a transfer and not a deferral

The blocked work is not slow, it is **not performable from a repository**. cf01
needs three things a checkout cannot supply:

1. a live instrumented host session,
2. a **manual** compaction triggered inside it, and
3. a session-state capture directory that does not currently exist.

A stub is the honest container for that. The alternative — leaving six Phase 1
boxes open behind a blocker — is what made this roadmap publish a takeable
backlog row while five of its steps waited on a human, which is the defect its
own `## Blockers` section was added to fix.

## Transferred work — original criteria, verbatim

### From Phase 0 (the census itself)

- **cf01** — "Run a compaction-survival census: in an instrumented session,
  place three probes before a manual compaction — a session-canary-bound
  obligation, a completion-gate reminder, and one trigger-loaded rule with a
  detectable obligation. Measure per probe whether it is still followed, present
  only as paraphrase, or gone. Repeat across at least five sessions and stamp the
  host version."
  `verify: test -f agents/evidence/eval-findings/context-fidelity-cf01.md` <!-- ref-ignore -->

### The blocker's own resolution criterion, verbatim

> "a `context-fidelity-cf01.md` finding exists under
> `agents/evidence/eval-findings/` carrying a per-probe-class number and a host
> stamp, or the user records that the compaction-survival question is closed
> unmeasured and Phase 1 is cancelled."

### From Phase 1 — the complete dependent set (all six steps)

Every Phase 1 step moves. The blocker states the scope as "transitively all of
Phase 1, whose build-or-close decision reads cf01's number", and the disposition
record repeats it: "Move Phase 0 cf01 and all Phase 1 steps dependent on its
number." Steps 1–4 and 6 are the build, which happens only if cf01's baseline
falls below the pre-registered 90 % threshold; step 5 reads the baseline
directly. There is no Phase 1 step that survives cf01's absence.

1. "Add a `reinject-index` concern bound on `session_start` and gated on the
   compact and resume sources, reusing the gating pattern the hot-context concern
   already proves works." `verify: ./scripts-run src/scripts/lint_hook_manifest`
2. "Generate the index at build time from rule frontmatter — tier plus a new
   optional reinject flag — rather than maintaining it by hand: a hand-maintained
   index is the staleness defect wearing a new hat. Cap it at twenty lines of
   pointers, never rule bodies; refilling the window with bulk material re-spends
   exactly the tokens the compaction reclaimed."
   `verify: ./scripts-run src/scripts/check_references`
3. "Spotlight the injected block as data-plus-directive, consistent with the
   framing the hot-context concern already uses."
   `verify: grep -q spotlight src/scripts/reinject_index_hook.ts`
4. "Bind the concern on the primary host only, and report the other platforms as
   open gaps rather than as covered — the same honesty posture the session-canary
   rule states for its own uncovered hosts."
   `verify: ./scripts-run src/scripts/check_enforcement_coverage`
5. "Re-run the Phase 0 census with the concern live and record the delta against
   the baseline. No delta after five sessions reverts the concern and publishes
   the null." `verify: ./scripts-run src/scripts/check_claims`
6. "Record the decision as an ADR: rule survival across compaction is a suite
   responsibility carried on the compaction-sourced session start, index-form
   only, budget-capped. Rejected alternatives: full-payload reinjection (token
   regression), per-turn reinjection (the cost shape the session-canary rule
   already refuses), and relying on host re-injection alone (contested, which is
   why the census exists)."
   `verify: ./scripts-run src/scripts/adr/regenerate_index`

Phase 1's own kill criterion travels with them unchanged: "no measured delta over
five sessions removes the concern and publishes the null."

## Re-entry producer — named, not "when a subsystem exists"

**Producer:** the context-fidelity maintainer, running an instrumented host
session and performing a manual compaction by hand.

This is a person performing a specific act, which is the point of the
three-point integrity check. It is deliberately not phrased as "when session
capture lands for its own reason" — that names nobody and turns a stub into a
parking lot.

## Probe — detection, and its measurement today

The probe the disposition record specifies: **the finding contains detectability,
five-session results where measurable, per-probe values, host versions, and
capture-directory status.**

Measured 2026-08-20 at `239d3bf1c`, all three arms **failing**, which is what
makes this a real gate rather than a formality:

| Probe arm | Command | Result today |
|---|---|---|
| The finding exists | `test -f` on the cf01 finding under `agents/evidence/eval-findings/` | **absent** — only cf02, cf03, cf04 exist |
| Manual compaction is detectable at all | `./scripts-run src/scripts/session_eol_report` | **unestablished** — 19 events across 591 sessions, `auto:19`, zero manual. The detector is pinned to ONE observed auto event (`src/scripts/_lib/session_eol.ts:11-19`), so zero manual is absence of a *record*, not evidence that manual compaction leaves none |
| Capture directory exists | same report, `capture:` line | **UNOBSERVED** — "no session-eol state directory — capture side UNOBSERVED (not zero)". A Phase 1 delta cannot be computed until this directory exists |

**A drift worth recording rather than smoothing over.** cf03 read 29 events
across 473 sessions on 2026-08-17; the same command on 2026-08-20 reads **19
events across 591 sessions** — more sessions, fewer events. The transcript store
is therefore not append-only across this window, so the compaction count is not
monotone and no trend may be inferred from the pair. What survives both readings
is the only load-bearing fact: **every recorded event is `auto` and none is
manual**, on both denominators.

## Re-entry gates — what a promoter must do first

The `## Promotion criteria (shared)` in [`README.md`](README.md) — recruited
customer, funded security audit — **do not govern this stub.** Those are org-mode
gates; this is internal work that crosses no Hard Floor and adds no org surface.
Its gates are:

1. **Establish detectability first, in one session, before spending five.** Run a
   single manual compaction in an instrumented session and check whether
   `session_eol_report` counts it. Cheap, and decisive: without it a cf01 null is
   uninterpretable, because "the obligation did not survive" and "the compaction
   was never recorded" are indistinguishable.
2. **If manual compaction IS detectable** — run the five sessions with the three
   probes placed before each compaction, stamping the host version per
   observation. Compaction survival is a host fact that changes without notice.
3. **If it is NOT detectable** — re-specify cf01 against the automatic path,
   which needs no special session: probes placed in a session that will cross 1M
   tokens, which 277 of 591 recorded sessions end above 400k tokens suggests is
   routine. Reword the five-session repetition when doing so — it was there to
   average *manual* variance and buys nothing on the automatic path.
4. **Either way, the capture directory must exist** before a Phase 1 delta is
   computable. Note that creating it is a host-environment modification, so it is
   itself a human action, not a repository change.

## What this stub does NOT claim

- Not that the compaction-survival defect is disproven. It is **unmeasured**.
  Phase 0's pre-registered honest-null threshold (baseline ≥ 90 % across all
  three probe classes closes Phase 1 unbuilt) is registered as
  `context-fidelity-compaction-compliance` and **carries no baseline**.
- Not that Phase 1's design was wrong. It was never evaluated.
- Not that the transferring roadmap achieved its compaction half. It did not —
  `road-to-context-fidelity.md` records outcome state `transferred` for Phase 0
  cf01 and for all of Phase 1, and its `## Outcome` section says so in the same
  words.

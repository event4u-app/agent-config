<!-- evidence-type: analysis -->

# Spike cf03 — how often compaction actually happens, and at what fill

**Date:** 2026-08-17
**Roadmap:** [road-to-context-fidelity.md](../../roadmaps/road-to-context-fidelity.md) Phase 0
**Tree:** `9beeb0662` (branch base `origin/main`)
**Host stamp:** Claude Code 2.1.233 · model `claude-opus-5[1m]` · store `~/.claude/projects`
**Pre-registered threshold:** none — this step is a count, not a gate. The
gated censuses are cf01 (compaction survival) and cf02 (memory staleness).

## Why this step changed source before it ran

As drafted, the step read the session-start source field out of
`agents/runtime/.agent-chat-history` and piggybacked on cf01. Two problems, both
found while executing:

1. **The file is absent from every worktree.** `hot_context_hook.ts:52` pins
   `HISTORY_REL = 'agents/runtime/.agent-chat-history'`, and `agents/runtime/`
   is gitignored session state written where a session actually runs. Read from
   a fresh worktree it yields zero compaction events — the opposite of the
   truth, reported confidently.
2. **The piggyback was unnecessary.** cf01 needs an instrumented live session
   with a manual compaction; this count does not. `session_eol_report` derives
   it from the host-global `compact_boundary` system records
   (`_lib/session_eol.ts:40`), which exist for every session on the machine.

Correcting the source therefore decoupled a blocked step from its blocker. The
count below needed no instrumented session at all.

## Result

| Metric | Observed |
|---|---:|
| Sessions in the store | 473 (1,673 files) |
| Sessions that compacted at least once | **22** (4.7 %) |
| Compaction events total | **29** |
| — of which host-automatic | **29** (100 %) |
| — of which manual | **0** |
| Trigger pre-tokens (median) | 1,000,677 |
| Trigger pre-tokens (min / max) | 964,035 / 1,031,366 |
| Post-compaction tokens (median) | 17,890 |
| Marker drift (29 boundary vs 29 summary records) | none |
| Sessions ending ≥ 400k tokens | 239 (50.5 %) |
| Sessions ending ≥ 800k tokens | 35 (7.4 %) |

## Three findings, in descending order of consequence for this roadmap

**1. Compaction is rare, and every RECORDED event is automatic — which is not
the same as saying no manual one happened.** 29 events across 473 sessions, all
29 tagged `auto`, zero tagged manual.

**Corrected on R2 finding 6, and the correction matters more than the count.**
The first version of this finding read "exclusively automatic … a shape the store
shows has never once occurred here", which reports an unobservable as an
observation. The detector is pinned to ONE observed auto event
(`src/scripts/_lib/session_eol.ts:11-19`: "pinned to OBSERVED reality … a real
auto-compaction recorded 2026-08-06"), and **nothing in this tree establishes
that a manual compaction writes a `compact_boundary` record at all**, let alone
one carrying `trigger: "manual"`. So the honest reading of "0 manual" is
**absence of a record**, not absence of an event, and an instrument that could
not have seen the thing is not evidence that the thing did not happen.

What survives, and it is still useful for cf01: the automatic path is
**demonstrably observable** and the manual path is **not known to be**. cf01 as
written asks for a manual compaction, so before running it someone has to
establish that the instrument can see one — otherwise a null result from cf01 is
uninterpretable, indistinguishable from a compaction that happened and left no
trace. That is a finding *for* cf01's method, produced before cf01 runs, which is
the cheapest moment to have it. It is **not** a reason to conclude the manual path
is unused.

**2. The trigger sits near a hard ceiling, not at a fill fraction.** Every
observed compaction fired between 964k and 1,031k pre-tokens — a 7 % spread
around 1M. Compaction is therefore not a gradual pressure this roadmap can
expect to meet halfway through a session; it is a cliff at the top of the
window. The Context section's positional-attention argument (start-and-end
advantage below roughly half-full, recency dominating above) applies to the
*approach* to that cliff, and the approach is where half the sessions live: 239
of 473 end above 400k.

**3. The capture side is unobserved, and the report says so.** `capture: no
session-eol state directory — capture side UNOBSERVED (not zero)`. So the 29
events are what the *host* recorded, and nothing here establishes what the
suite's own `pre_compact` concern captured at those boundaries. Phase 1's census
re-run needs that directory to exist before a delta means anything, and the
honest reading today is unobserved rather than absent.

## Reproduction

```
./scripts-run src/scripts/session_eol_report
```

Host-global by construction: it reads `~/.claude/projects`, not the tree, so the
number is a property of this machine's session history and is not reproducible
on a different machine. Anyone re-running it should restate their own store size
alongside the count.

## What this does not show

- Whether any obligation survived a compaction — that is cf01, still open.
- Whether the suite re-injected anything at those 29 boundaries — the capture
  side is unobserved.
- **Whether a manual compaction is detectable at all.** The zero is a property of
  the record set, and the detector's own header says it was pinned to an observed
  auto event. Establishing manual detectability is a precondition for cf01, not a
  result of this census.
- Anything about hosts other than Claude Code; the store is single-host.

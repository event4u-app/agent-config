# The fix-loop ladder — bands, bound outcomes, and how to read a red

`road-to-adversarial-verification-and-long-runs` Phase 4. The obligation lives in
[`autonomous-execution`](../../../src/rules/autonomous-execution.md) § Validation-loop
budget; this page carries the bands, what happens at the bound, and the probe
discipline each band starts from.

**Its own file rather than a section of
[`autonomy-mechanics`](autonomy-mechanics.md), and the reason is measured.** That
page sat at 16,040 chars against a 16,000-char depth ceiling — marginally under by
the gate's own measure — so adding ~5,600 chars of ladder to it crossed the
ceiling and added a violation to a shrink-only ratchet. Splitting a distinct
subject out is the repair the ratchet is asking for; raising the baseline would
have been the defect it names.

## The three bands, and what makes a band a band

The bound was a hard cap of 3 whose remedy was *STOP. SURFACE. ASK USER FOR
GUIDANCE.* It is now `execution.fix_loop_max` — default 10 — divided into three
bands, and the division is the substance: a larger number alone would only buy
more of the same attempt.

| Attempts | What is required | What is NOT an attempt |
|---|---|---|
| 1-3 | root-cause, then a targeted fix | — |
| 4-6 | a **mandatory strategy shift**: re-examine the assumptions, read the history, build a minimal reproduction, find the last known good state, check upstream docs and issues, or try an alternative implementation | repeating the previous approach with a smaller edit. That is the same attempt again, and it does not advance the band |
| 7-10 | **independent escalation**: a second session, a provider-diverse reviewer, the council, the team with repository access, or a rollback of the slice | anything the same session can decide alone |

## At the bound — five outcomes, in order, and none of them is a count

```
A COUNT IS NOT A REASON TO ASK. THE BOUND ENDS A STRATEGY, NEVER THE RUN.
```

1. **The escalation yielded a new strategy** → open a **new epoch**: the attempt
   counter resets against the new strategy, because the thing the budget was
   bounding is gone.
2. **An independent phase can proceed** → continue it. A blocked target is not a
   blocked run, and the run's other work does not wait on this one.
3. **The residue is owner-owned** per the ownership table → **one** native ask,
   naming the residue. This rung is reached by the OWNERSHIP test, never by the
   count that got here.
4. **An external prerequisite is objectively missing** — an absent credential, an
   unreachable service, a decision only the forge can carry → `BLOCKED`, with the
   evidence that establishes the absence.
5. **Otherwise** → a new epoch. Running out of ideas is not one of the four above,
   and converting it into an owner ask is the failure this ladder replaces.

Council and team verdicts reached during band 3 append to the run's
`## Decisions` — so the next epoch starts from a record rather than from the
previous epoch's memory of it.

**The allowlist-growth counter is a separate mechanism** with its own threshold
and its own remedy (fix the tool's shape). It is not a band of this ladder, and
crossing it does not advance the attempt count — it spends the whole bound for
that target at once, which is a different statement.

## Read the red before diagnosing it, with the narrowest probe

An attempt that begins from a guess about the failure is not a band-1 attempt; it
is the first of three that will be spent learning what band 1 was supposed to
start from. So, before the fix:

- **A CI red** is read with `gh run view --job <id> --log-failed`, filtered
  (`| grep -E '×|FAIL|Error'`) — never the whole log into context, and **never**
  `gh pr checks --watch`'s exit code, which is 0 on a failure and 1 when no
  checks exist at all. Two different wrong answers from one number.
- **The CI waiter is `ci_settle`**, and it is ONE waiter for the condition: its
  LAST OUTPUT LINE is the verdict, and a run that reaches no verdict can still
  exit 0. A hand-written poll loop beside it is the fleet
  [`context-hygiene`](../../../src/rules/context-hygiene.md) § Waiting is one
  waiter forbids.
- **A local red** is read with the runner filtered to the failing name — not the
  suite, and not a meta-pipeline. Match the probe to the surface: `curl` or a
  Playwright spec for an HTTP or UI red, the debugger for a runtime frame, the
  test runner with a filter for a behavior.
- **Reproduce before believing the diagnosis.** An environment-dependent red
  reproduces under its condition, not on the machine's defaults.

## The allowlist guard's host reach, and the two corrections it has taken

Migrated out of `autonomous-execution` on 2026-09-13 (P4): the rule keeps the
obligation, this page carries the host claim and its history. The rule was
re-sending all of it on every session and every spawn.

`block_config_weakening.ts` counts allowlist entries added per session, warns from
5, and blocks past 20 — **on `claude` alone**, the one host that both binds
`pre_tool_use` and honours a deny. It is *bound* on augment and cowork as well and
ignored there: `host_semantics.ts` verifies claude alone, and both trampolines
discard dispatcher output and `exit 0` unconditionally. Everywhere else the cap is
model-carried and "enforced at tool-call time" is not a claim that can be made.

**Corrected 2026-08-17, in both directions.** The sentence used to certify
augment, claude and cowork as the enforcing set — an over-claim of two hosts — and
to explain the rest with "the guard has nowhere to bind", which is false for
cursor, cline and gemini, whose native pre-tool events `native_event_aliases`
already maps onto `pre_tool_use`: there it is **unbound, not unbindable**. Only
windsurf and copilot carry no alias row. The four states are tabulated once in
[`hook-architecture-v1 § Which hosts carry pre_tool_use`](../../../docs/contracts/hook-architecture-v1.md).

The sibling rules `git-history-discipline` and `evaluator-independence` qualify
the identical slot, so an unqualified claim in any of them would read as a
guarantee the manifest does not give.

## Related

- [`autonomy-mechanics`](autonomy-mechanics.md) — the rest of the autonomy body: opt-in detection, task scope, probe efficiency, the retry-budget ladder.
- [`terminal-states`](terminal-states.md) — `exhausted` vs `stagnated`, the two words the bound and a repeating signature report.

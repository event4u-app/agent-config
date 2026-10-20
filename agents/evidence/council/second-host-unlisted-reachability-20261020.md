<!-- evidence-type: analysis -->

# The second host's unlisted skills: give it a retrieval path

**Date:** 2026-10-20 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, two rounds · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 concluded · **Prompt:** `second-host-unlisted-reachability-20261020.question.md`, beside this file
**Authority:** the blocker names the council as owner — a host-behaviour question with reversible internal remedies, reaching the owner only if the answer weakens what ADR-289 (b) published

A first attempt the same day returned 0/2 present: the council's own local quota
counter read 51/50 and 50/50. It was reset and the question re-run unchanged;
nothing was billed by either attempt.

## Verdict — remedy (a), 2/2

| Seat | Choice | Owner-only |
|---|---|---|
| `anthropic` | **DECIDE (a)** | no |
| `openai` | **DECIDE (a)**, "subject to a contractual clarification and stricter acceptance criteria" | only if "one deterministic step" must mean direct invocation of the target skill |

Both read (b) and (c) as weakening ADR-289 — (b) by amending the promise, (c) by
handing reach back to alphabetical truncation — and (a) as the only remedy that
keeps it.

## What both seats attached, and how each is met

| Condition | Met by |
|---|---|
| The finder's own listing entry is counted inside the 8,000-character budget | `applyCodexResidentSet` reserves the entry before the split, sized for the whole catalogue being unlisted; `tests/install/codex_skill_finder.test.ts` asserts listing + finder ≤ budget and fails when the reservation is removed |
| Two deterministic modes: exact name, and task | the entry carries an index of every unlisted name under the directory holding it (exact lookup, no ranker involved), and routes a task through `agent-config route:explain --skills` with the index as fallback |
| Exhaustive static check, not a sample: unique name, exact lookup to exactly one path, confined to a root the package writes, file readable | `finderRoutes`, applied to EVERY unlisted name by the reach report and by the test |
| Classification on more than host-applied keys | a routed skill whose declared `skills:` / `requires_skills:` dependency is absent is `degraded`; host-applied keys are this host's (`agent-skills-spec`), not the first host's |
| Install, recompute and uninstall idempotent, ownership recorded | the entry has its own ownership record; written only where nothing else stands, removed only while its bytes are the ones recorded, removed with the resident set on uninstall |
| Fresh-session live probes: a named non-resident skill is loaded and a distinctive instruction in it is followed; a task with no listed match is routed; unknown names fail safely | `agents/evidence/analysis/second-host-finder-probe-20261020.md` |
| "One deterministic step" stated as one model-visible invocation of a package surface | ADR-289 § Clarification, 2026-10-20 |

## Where the seats differed, and what was taken

`openai` asked for live probes across "every distinct dependency/semantic class";
`anthropic` asked for eight named probes. The probes taken are the ones that
distinguish reach from non-reach on this host — listing, named, task, unknown
name. A dependency class is a property of a skill's frontmatter, so it is
covered exhaustively by the static classification rather than by sampling
model behaviour, which is the split `openai` itself drew between static and
live checks.

One statement in the prompt was wrong and is corrected here rather than
silently: `route:explain --skills` prints names and descriptions, not paths.
The index the finder carries is what supplies the path, which is why exact
lookup does not depend on the ranker at all.

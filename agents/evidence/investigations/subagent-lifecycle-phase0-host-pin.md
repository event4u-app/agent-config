# Subagent lifecycle — Phase 0 Step 1: host pin + event-enum re-extract

> Read-only evidence for Phase 0 Step 1 of
> [`road-to-subagent-lifecycle-integrity`](../../roadmaps/road-to-subagent-lifecycle-integrity.md).
> Measured 2026-08-13 against `origin/main` @ `da40cc27b`. Every number below
> carries the command that produced it; nothing is asserted from memory or
> carried over from the earlier spike.

## Host pin

```
$ claude --version
2.1.229 (Claude Code)

$ readlink -f "$(which claude)"
/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
```

The prior spike
([`solution-minimalism-phase0-spikes.md`](solution-minimalism-phase0-spikes.md)
§ S0.2) pinned **2.1.220**. This re-extract is against **2.1.229**, so the
finding below is a fresh measurement on the version this roadmap ships against,
not a transferred one.

## Event enum — exact-token counts

Method: `strings -a <binary> | grep -c '^<token>$'`. The exact-match anchor
matters — a substring count inflates every token that also appears inside prose
or a longer identifier (`Notification` alone reads 446 as a substring and 14 as
an exact token).

| Native event | exact | in this tree's vocabulary? |
|---|---:|---|
| `SessionStart` | 24 | yes → `session_start` |
| `SessionEnd` | 12 | yes → `session_end` |
| `UserPromptSubmit` | 16 | yes → `user_prompt_submit` |
| `PreToolUse` | 25 | yes → `pre_tool_use` |
| `PostToolUse` | 25 | yes → `post_tool_use` |
| `PreCompact` | 11 | yes → `pre_compact` |
| `Notification` | 14 | no — not bound by this tree |
| **`SubagentStart`** | **12** | **no — added by Phase 1 Step 1** |
| **`SubagentStop`** | **24** | **no — added by Phase 1 Step 1** |
| `PostToolBatch` | 10 | no — out of scope for this roadmap |

`Stop` is deliberately absent from the table: it is a two-character-boundary
token that no exact-line grep can separate from the many identifiers ending in
`Stop` (`SubagentStop` among them), so a count for it would be noise. Its
binding is already shipped and is not what this step is establishing.

**Assertion of Phase 0 Step 1 holds:** `SubagentStop` is still present on the
installed host, and `SubagentStart` with it.

## Payload field names — present in the binary

Same exact-token method. This is a **presence** check on the string table, not
a proof that the fields arrive on a given event's stdin — that is Phase 0
Steps 2 and 4, which need a hook registered in a fresh session and are not
discharged here.

| Field | exact |
|---|---:|
| `agent_id` | 3 |
| `agent_type` | 3 |
| `subagent_type` | 4 |
| `last_assistant_message` | 1 |
| `additionalContext` | 5 |
| `hook_event_name` | 1 |
| `transcript_path` | 1 |
| `stop_hook_active` | 1 |

## What this step does NOT establish

The three fields the roadmap's Phase 2 and Phase 4 depend on — `agent_id` /
`agent_type` on tool events, and `last_assistant_message` on `SubagentStop` —
are present as **strings in the binary**. That is necessary and not sufficient:
a string table cannot say which event carries which field. Phase 0 Steps 2 and
4 remain open, and Phase 4 stays gated on Step 4 exactly as written.

The honest consequence for this PR: Phase 1 binds the two events and captures
whatever the payload actually carries, recording absence as data. Nothing in
Phase 1 assumes a field it has not seen arrive.

## Phase 5 Step 1 — the wired tier caller is reachable and NOT load-bearing

The draft's fork ("wire it or delete it") was already decided:
`resolveSubagentRouting` has a production caller. The open question the step
actually asks is whether that caller *governs* anything. Traced end to end:

| step | site | what happens to the tier |
|---|---|---|
| 1 | `delegation_nudge_hook.ts:341` | `recommendSliceTier` calls `resolveSubagentRouting` with a hardcoded `task_tier: "lite"` / `session_tier: "high"` — there is no per-slice classification at prompt-submit time |
| 2 | `delegation_nudge_hook.ts:443` | the returned `Tier` is assigned to a local |
| 3 | `delegation_nudge_hook.ts:382` | `buildNudgeLine` interpolates it into prose: `` `(${sliceCount} ${unit}, ${tier} tier recommended)` `` |
| 4 | — | the string is injected as `additionalContext`. Nothing else reads it. |

`resolveSubagentRouting` has exactly one production caller
(`grep -n resolveSubagentRouting src --include '*.ts'`, excluding tests: one
import and one call, both in `delegation_nudge_hook.ts`), and its output
terminates in a sentence.

**Finding, which is the outcome the step pre-registered as the honest one:**
the caller is **reachable but not load-bearing**. The tier a spawn actually
uses is chosen by the model when it invokes the `Agent` tool, downstream of and
unconstrained by the nudge. A second wiring change is therefore *not* the
follow-up — the follow-up is Phase 5 Step 2, which measures whether the
distribution moves at all, and it needs the ≥20-dispatch window the Phase-1
ledger has only just started collecting.

## Phase 3 — not started, and the reason is a missing artefact

Phase 3 Step 1 states that the spawn guard "ships **warn-first** … **per the
concern activation policy** (program X3), which this step cites instead of
re-arguing" the soak history. That policy does not exist:

```
$ grep -rl "concern activation policy" .
agents/roadmaps/road-to-august-program.md
agents/roadmaps/road-to-subagent-lifecycle-integrity.md
agents/roadmaps/road-to-source-first-frontend.md
agents/evidence/reviews/feat-source-first-frontend.review-input/roadmap.md
```

Four hits, all of them roadmap prose or a review input — no policy artefact in
`docs/contracts/`, `src/rules/`, or anywhere else. Three roadmaps now cite a
document none of them wrote.

Building the guard anyway would mean inventing the warn→deny posture the step
deliberately deferred to that policy, on top of thresholds (`N=2`, `M=4`) whose
own text calls them "pre-registered … refined from Phase-1 telemetry, never
final" — telemetry this PR produces the instrument for and cannot yet have.
That is the threshold-invented-rather-than-measured failure this repository has
recorded repeatedly, so Phase 3 stays open with this note rather than shipping
a guard whose activation rule is a citation to nothing.

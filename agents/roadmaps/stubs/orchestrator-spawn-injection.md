---
complexity: lightweight
---

# Stub: orchestrator-side spawn injection

> **Stub — not active work.** Created 2026-08-23 from the bonus finding of the
> `b-subagent-payload-trigger-match` probe, on the AI council's explicit
> instruction (2026-08-23, disposition **A + ii**, 1 of 2 members answering —
> a DEGRADED reading, recorded as such). It is a stub and not a step because the
> question it asks is a **different surface** from the one the blocker asked
> about, and folding it in would have made that blocker's resolution unreadable.

## What the probe found, and why it is not the blocker's answer

[`subagent-start-payload-probe.md`](../../evidence/investigations/subagent-start-payload-probe.md)
asked whether a rule body can be delivered **inside** a spawned child session.
Three negatives on claude 2.1.241: the `subagent_start` payload carries no
prompt-bearing field and its `session_id` is the orchestrator's;
`user_prompt_submit` does not fire inside a child; neither do the tool slots.
`subagent delivery: orchestrator-only`, and the blocker closed on that.

The bonus finding is a **different** fact. The Task spawn IS visible on the
**orchestrator's** own `pre_tool_use` — `spawn-guard-shadow` is bound there
(`src/scripts/hook_manifest.yaml`) and recorded
`{"event":"spawn_guard_shadow","tool":"Agent",…}` for the probe spawn — and a
`pre_tool_use` payload for that tool carries `tool_input`, which for a Task call
carries the child's prompt.

So a rule body could be matched against the prompt the orchestrator is about to
send, and injected into the **orchestrator's** context before the spawn. The
theory: the orchestrator is the one composing the child's task, so it should be
under the rules that task would trigger while composing it.

## Scope

Decide whether `rule-inject` gains a third match path — Task `tool_input.prompt`
on the orchestrator's `pre_tool_use` — in addition to the per-turn prompt and
per-file paths it already has. If yes, measure whether it degrades spawn latency
or token cost against per-turn injection alone.

## Why this is not obviously worth doing

Stated up front so nobody promotes it on the strength of the finding alone:

1. **The orchestrator has usually already been injected.** A turn that spawns a
   subagent normally began with a user prompt, and that prompt already went
   through the `user_prompt_submit` path. The seen-set then makes the spawn match
   a no-op for every rule already delivered — so the marginal delivery is only
   the rules the child's prompt triggers that the parent's did not.
2. **It is the widest match surface in the design.** A Task prompt is model-
   written prose, often long, and matching keyword triggers against it is the
   shape most likely to over-fire. The corpus that licenses the other two paths
   (`tests/eval/routing-matrix`) contains no Task prompts at all, so there is no
   labelled population to measure false fires against.
3. **The cost lands on the hot slot.** `pre_tool_use` carries the tightest
   latency cap (175 ms CI) and the tightest injection sum (2,048 B), and
   `rule-inject` gate-open reads p95 0.61 ms — small, but this slot is where a
   regression is least affordable, and the concern already learned that lesson
   once: its first cut read 87.8 ms because a token-based cap pulled a tokenizer
   into every dispatch.

## What would have to be true to promote it

- A labelled corpus of real Task prompts with expected-rule annotations, so
  false fires are measurable rather than assumed absent. This is the blocking
  prerequisite; without it the change is unfalsifiable.
- A measured marginal delivery: how many rules a spawn match would deliver that
  the parent turn had not already delivered. If that number is near zero the
  whole idea is answered without building anything.
- Spawn overhead measured over a 20-spawn session with and without the path,
  compared against `hook-latency-budget.json`.

## Kill criteria

- The marginal delivery measured above is ~0 — the seen-set already covers it.
- Spawn-time matching over Task prose produces false fires the per-turn path
  does not.
- A host version starts delivering context inside child sessions, which makes
  the orchestrator-side workaround pointless rather than merely marginal.

## Promotion

Not governed by the shared promotion criteria in [`README.md`](README.md) — it
introduces no product surface and no attack surface. Promote by landing the
labelled Task-prompt corpus first; the decision follows from its numbers. Delete
this stub if a kill criterion fires.

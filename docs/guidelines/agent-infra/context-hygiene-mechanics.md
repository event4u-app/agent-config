# Context Hygiene — Mechanics

> Suggestion templates, state-dump format, read-loop self-checks, and host fallbacks for the `context-hygiene` rule

_Origin: migrated from `src/rules/context-hygiene.md` per the P4 pattern of `road-to-kernel-and-router.md`. The freshness thresholds, the 3-failure rule (with failure-identity and hard-blocker classes), the tool-loop cap, and the read-loop 15/25 Iron Law stay in the rule; this file carries the templates and per-host procedures._

## Conversation-freshness suggestion — how to phrase it

Estimate token cost: responses × ~1,500 tokens.

```
> ⚡ This conversation has ~{N} messages (~{N×1500} tokens history cost — charged on EVERY request).
> A fresh chat saves ~{N×1500} input tokens per request.
>
> 1. Start fresh — I'll initiate a session handoff
> 2. Continue here
```

**If the user picks 1:** Initiate a session handoff or start fresh.

## Read-loop self-check (fires at the 15-min warning)

1. Source expectation known? If no → read **once**, then act.
2. Can a single failing test name the error? If yes → run it now.
3. Regression in working code? → `git log` + `git show <sha> -- <file>`.
4. Guessing at mock / payload shape? → read the producer **once**.

## Read-loop abort block (the 25-min stop)

```
> ⛔ Loop: N read-only turns, ~M min. Read: <files>. Hypothesis: <X>.
> 1. Different approach (suggestion: <Y>)
> 2. Point me at the right spot
> 3. Fresh chat with state dump
```

Non-bypassable. An autonomous mandate (`/work`, `/roadmap:process-*`,
"entscheide selbst") does **not** lift the abort — it is the safety
net that protects autonomy from becoming a token sink.

Debug procedure for "I'm in a read loop fixing tests" →
`systematic-debugging` § Debug micro-loop (one test, one fix, one re-run).

## State dump format

```
## State Dump: [Task]
### Tried: 1. [Approach] → [Why failed] 2. ... 3. ...
### Known: [Key facts]
### Hypothesis: [Best guess for root cause]
### Recommendation: [Next approach for fresh session]
```

Use `/agent-handoff` to generate a context summary for a fresh conversation.

## Augment-specific: ignored-skills recovery

Skills excluded via `.augmentignore` don't appear in `<available_skills>`.
If you need an ignored skill: read its SKILL.md directly, apply guidance, then ask:

```
> 💡 I loaded `{name}` manually — currently ignored in `.augmentignore`.
> 1. Remove from ignore — relevant for this project
> 2. Keep ignored — one-off
```

## Copilot fallback

GitHub Copilot has no `PostToolUse` hook surface, so
`scripts/context_hygiene_hook.ts` cannot run structurally and
`agents/state/context-hygiene.json` is not maintained automatically
(tool-call count, loop signal, freshness milestones at 20/40/60).

The cooperative path: track turns and tool-loop signals from memory
during the conversation and apply the suggest-a-new-chat / 3-failure
stop / loop-detection rules. To refresh the state file manually so the
dashboard or another tool can read the latest counters, run:

```bash
./scripts-run src/scripts/context_hygiene_hook < /dev/null
```

The script reads from stdin if a JSON envelope is provided and
otherwise writes a no-op snapshot under the shared dispatcher lock.
Exit code is always 0 — hooks must never block the agent loop.

## See also

- `context-hygiene` (rule) — thresholds, 3-failure rule, tool-loop cap, read-loop Iron Law.
- `systematic-debugging` § Debug micro-loop — the one-test-one-fix-one-rerun procedure.

## The CI waiter — use the helper, never the hand-written loop

`./scripts-run src/scripts/ci_settle <pr> [--timeout-min N] [--interval-sec N]`

Exit codes: **0** settled green · **1** settled red, with the failing checks
named · **2** did not settle, or the API could not be read — never a verdict.

Four states classify as *not settled*, and each one is a way the hand-written
form goes wrong: an API error, a non-zero `gh` exit, unparseable output, and
**zero registered checks** (a run that has not registered its checks yet looks
exactly like a finished one with nothing to report).

**Why it exists.** Measured 2026-08-20:

```bash
until ! gh pr checks 1459 | grep -q "pending"; do sleep 60; done
```

The API then failed. Its error text — `error connecting to api.github.com` —
contains no `pending`, so the loop exited, the session reported a settle that
had not happened, and the claim had to be retracted to the user in the next
reply. The bug is not the sleep or the grep: **absence of the word `pending`
was treated as evidence of completion**, and an error is neither settled nor
pending. The exit condition is the part that is easy to get wrong, so it lives
in one place rather than in every agent's head.

## Waiting is one waiter — why the loop test misses it

Migrated from [`context-hygiene`](../../../src/rules/context-hygiene.md)
§ *Waiting is one waiter, never a fleet* under the P4 pattern
(`road-to-standing-payload-diet` step 1.3). The rule keeps the Iron Law, the
one-waiter instruction and the enforcement verdict; the argument for them is
here.

The loop test in that rule fails on waiting in **both** of its clauses:

- **"Same parameters" fails.** A `sleep 240` followed by `sleep 420` followed by
  `sleep 595` are three different calls by any parameter comparison, so nothing
  reads them as repetition.
- **"Repetition without new information" fails too**, and this is the subtler
  half: the poll genuinely returns a different value each round — 31 green, then
  34, then 36 — which *feels* like progress. It is not information unless a
  different digit would make you act differently. It would not: the only actions
  available were wait, or stop and report, and 34 licensed neither more than 31
  did. **The discriminator is the decision, not the digits.**

So state it separately: pick **one** waiter for the condition and let it finish.
Where the harness re-invokes on completion, waiting costs nothing and polling
costs a turn per expiry — and every stacked waiter is a turn that arrives *after*
the answer already did. Where it does not, one `until <condition>` loop is still
one call rather than N.

**Measured once, at n=1, and worth naming for its shape rather than its
frequency** (2026-08-12): a CI wait started roughly 35 background commands —
a fresh timer *and* a fresh condition-watcher per round, none cancelled when the
next pair started. CI settled with about fifteen still live; each then expired
and produced an empty turn. Nothing was corrupted, which is exactly why it ran
so long: every individual step looked reasonable.

**Enforcement: none, and the reason is structural.** The `context-hygiene` hook
counts tool calls; a waiter is indistinguishable from any other call at that
layer, and nothing in the envelope says two live waiters are watching one
condition. This is model-carried on every host.

## The declared-protocol cap — why 8, and when it changes

Migrated from [`context-hygiene`](../../../src/rules/context-hygiene.md)
§ *Declared read protocol* under the same pattern. The rule keeps the cap and the
three-field declaration contract; the honesty note about the number is here.

> **The 8 is a guess, and specifically a LOWER BOUND.** One observed run — the coherence audit that motivated this clause — needed 8+ read turns and was legibly the protocol working, not a loop. So 8 is "the number that was enough once", not a measured optimum: n=1 says almost nothing about where the tail of the distribution sits, and nobody knows how many sessions silently hit the old 5 and should have continued. Calling this a derivation would be false advertising, which is the same failure class as the "17 rules carry absolutes" figure this rule's own roadmap refuted.
> **Revisit-if — whichever comes first:** (a) **≥ 10 declared-protocol sessions** have been observed, at which point set the cap from their p95 and delete this note; or (b) **90 days** elapse with fewer than 10, which is itself the answer — declared protocols are rare, the cap is not load-bearing, and it drops back to the undeclared 5. A condition like "once a distribution exists" was rejected as unfalsifiable: it is gradual, never feels urgent, and absence of complaints is indistinguishable from absence of measurement. <!-- enforcement-count-ok: not an enforcement denominator — the 10 is a revisit threshold for observed declared-protocol read sessions and the 90 a calendar deadline; neither is a count of rules, obligations, or covered platforms, so there is no resolver output to cite instead -->



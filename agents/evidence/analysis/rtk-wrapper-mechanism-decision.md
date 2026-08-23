<!-- evidence-type: analysis -->

# Which wrapper mechanism — one chosen, two rejected with reasons

**Date:** 2026-08-23. **For:** `road-to-terminal-token-economy` Phase 2, steps 2.1–2.3.
**Decided by:** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 +
openai/codex-default), **convergent**. The maintainer delegated owner-reserved decisions to
the council for this autonomous drain run.

**Phase 1 changed the input to this decision, so it is not the decision the roadmap
anticipated.** The premise that ruled out a transparent rewrite —
*"there is no transparent `updatedInput` rewrite"* — is **false for Claude Code 2.1.241**
(`host-input-rewrite-probe-2026-08-23.md`). The rewrite had to be rejected on its real
costs or not at all.

## The three candidates, with what each costs and what each cannot do

### (a) Transparent input rewrite via `updatedInput`

**Available at the host.** 2.1.241 documents the field, validates its schema, and falls
back when it is absent.

**What it costs.** Two things, and the first is not a plumbing detail:

1. **No composition rule exists.** The dispatcher aggregates many concerns per event and
   reduces them to **one** exit code. What happens when two concerns both want to rewrite
   the same tool input — precedence, conflict detection, failure semantics — is undecided.
   Writing one is design work with a safety surface, not wiring.
2. **A different safety posture.** A default-OFF hook that silently changes what the agent
   runs is categorically unlike one that warns. `injection_scan_hook` sets the house
   precedent for warn-preserves-agency on exactly this reasoning.

**What it cannot do.** Ship before that composition rule is decided.

### (b) The existing warn-only nudge — **CHOSEN**

**Shipped.** Zero new surface. Preserves agency: the agent sees "re-run wrapped with rtk"
and decides.

**What it costs.** The saving is captured only when the agent acts on the warn, so the
mechanism's efficacy is bounded by compliance — and compliance is **unmeasured**. That is a
real limitation and it is why both seats' next-step list includes measuring warn compliance
as the efficacy proxy.

**What it cannot do.** Guarantee the wrap. It never will; that is the trade for agency.

### (c) The bounded-alternative branch — **RETAINED, coexisting**

`OUTPUT_CAP_TABLE` at `rtk_wrap_hook.ts:211`: a committed per-command cap table, rows
individually removable, per-row `enabled` opt-out, emitting a warn that names the bounded
alternative for commands the wrapper cannot take (`grep`, `rg`).

**What it costs.** Advisory only. **What it cannot do.** Cap anything — nothing is ever
truncated, and ignoring the advisory *is* the uncapped re-run.

## The choice, and the two rejections

**Chosen: (b), the warn-only nudge.** One mechanism ships.

**REJECTED — (a), the transparent rewrite.** Reason, and the correction matters more than
the verdict: **not** "the host cannot" — that is refuted — but the two costs above, an
absent composition policy across concerns and a materially different safety posture for a
default-OFF hook. As one seat put it: *"A host capability is not yet a safe dispatcher
capability."*

**REJECTED as a sole mechanism — (c), the cap table.** It covers the commands the wrapper
*cannot* take, so it was never a candidate to replace (b); choosing it alone would leave
every wrappable command unaddressed. It is **retained** rather than discarded (see 2.3).

## 2.3 — what happens to the second branch

**They coexist, and the split is by command, not by precedence.** There is no ordering
question to answer because the two branches address disjoint sets:

| branch | fires on | outcome |
|---|---|---|
| the wrapper nudge (b) | a verbose command **rtk can wrap** | warn: re-run wrapped |
| the cap advisory (c) | a command in `OUTPUT_CAP_TABLE` that rtk **cannot** wrap (`grep`, `rg`) | warn: use the bounded alternative |

A command cannot be in both sets: membership in the cap table is precisely the record that
the wrapper has no form for it. So the chosen mechanism **supersedes nothing**, and no code
changed for this step — which is the honest outcome for a decision that ratified what
already ships.

## The reopening condition — because a rejection with no reopen is inertia

Both seats named this explicitly: *"merely rejecting rewrite risks turning a temporary
design gap into permanent inertia."* So (a) is **rejected-for-now**, and what reopens it is
named:

**An accepted composition policy for per-concern input rewrite in this dispatcher** —
precedence between two concerns rewriting the same input, conflict detection, and failure
semantics when a rewrite fails schema validation. That is a dispatcher-contract decision,
not this hook's, and it is the thing to build first if the rewrite is wanted.

The correction one seat added, and it is adopted here rather than paraphrased: the
unavailable capability must be labelled accurately. **`updatedInput` is available.** What is
absent is *an accepted safe composition policy in this dispatcher*. Recording it the other
way would re-create the undated host-capability claim this whole phase exists to remove.

## 2.4 — default-OFF is untouched

`hooks.rtk_wrap.enabled` remains `false` in `src/config/agent-settings.template.yml`.
Choosing a mechanism is not flipping a default, and a flip is a change to what every
consumer session does. Phase 3 would have to earn it, and Phase 3's run is deferred.

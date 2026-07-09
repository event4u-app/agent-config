# Second-brain scope — what it is, what it is not, what is measured

> The agent-config "second-brain" substrate is **agent-facing memory**, not a
> human personal-knowledge-management (PKM) tool. This page states the boundary
> honestly and binds every capability word to evidence. It follows the
> `docs/proof.md` § 4 discipline: the category column describes human-PKM only
> by what is publicly observable, never as a counter-claim to a named project.
>
> Roadmap: `road-to-second-brain-delta-proof`. Verdict of record:
> `agents/settings/contexts/second-brain-delta-verdict.md` (council 2026-07-07).

## The honest status (2026-07-09 — measured PASS, bounded)

The substrate is **built** (typed knowledge dirs, INDEX generator, retrieval
protocol, `hot_context_hook` working-memory continuity across compaction,
`fold_intake`, contradiction surfacing), and the cross-session recall *delta*
is now **measured** — a real, placebo-controlled lift, honestly scoped.

- **The measurement rig** — a deterministic multi-session recall corpus
  (`internal/bench/second-brain/corpus/`) + a scorer
  (`src/scripts/second_brain_score.ts`) with no model-in-the-loop grading.
- **The paired run (Phase 2)** — `memory-on` / `memory-off` / `placebo` on a
  fixed host (claude-haiku-4-5), 9 tasks × 3 seeds (81 calls). Result:
  memory-on **27/27**, no-memory **10/27**, equal-byte placebo **9/27**;
  memory-on beats BOTH, sign test **p = 0.031** for each pairing → **PASS**.
  Full report: `internal/bench/reports/second-brain-delta.json`
  (claim `second-brain-recall-lift`).
- **Where the lift lives** — it concentrates on the retrieval-accuracy tasks
  where the prior fact is available ONLY from memory (memory-on 3/3, baseline
  0/3). It **ties** on the three tasks whose k+1 prompt already self-contains
  the signal (a correction stated in-prompt, or a contradiction the prompt
  names) — exactly where memory is not the only source. memory-on never loses.

### The scoping caveat (stated, not buried)

This is the **context-value upper bound**, not proof of retrieval precision:
the corpus is one-fact-per-task, so memory-on injects the exact fact (perfect
retrieval). It shows that **the right prior fact, surfaced, lets the model
answer — and that this beats both no memory and equal-byte noise** (the placebo
isolates mechanism from mere extra context). It does **not** show the substrate
finds the right fact among many under a large store; that retrieval-precision
corpus is the follow-up. The public claim is scoped to exactly this.

## What it IS (measured lift, bounded as above)

| Capability | What it does | Evidence status |
|---|---|---|
| Working-memory continuity | `hot_context_hook` re-injects a bounded, deterministic cache across session boundaries and Claude Code compaction | mechanism shipped; recall lift **measured (bounded PASS)** |
| Promotable knowledge cards/pages | typed dirs + INDEX + retrieval protocol, with redaction + team-share gate | mechanism shipped; recall lift **measured (bounded PASS)** |
| Contradiction surfacing | a session that contradicts a prior decision is flagged on promote | mechanism shipped; ties in-prompt, lift where memory is the only source |

## What it is NOT

- **Not a human-browsable knowledge graph.** There is no `.obsidian/` config,
  no enforced `[[wikilink]]` convention, no link-density value thesis. An
  editable vault view was evaluated and **rejected** (the dual-write hazard:
  an external edit that never commits silently diverges the INDEX and
  recurrence counters). Browsability, if demanded, is a read-only static
  render — not an editable vault.
- **Not an Obsidian (or any named PKM) replacement.** The category — a
  human Markdown graph browsed in an editor, value proportional to
  link-density, hybrid human-facing retrieval — is a *different product* for a
  *different consumer* (a person, not an agent). This package writes
  agent-facing memory; it does not serve a human graph browser.
- **Not an unbounded accuracy multiplier** — the recall lift is measured but
  scoped to the context-value upper bound (see honest status), not proven
  retrieval precision under a large store.

## Interop, not competition (export declined, on the record)

The Phase-2 paired run did show a real (bounded) lift, which unlocks the
optional one-way export (promoted cards → Obsidian-compatible Markdown). It is
**deliberately not built**: the delta-verdict of record
(`agents/settings/contexts/second-brain-delta-verdict.md`, council 2026-07-07)
**rejected** Obsidian compatibility — the dual-write hazard (an external edit
that never commits silently diverges the INDEX + recurrence counters) outweighs
the browsing convenience, and the measured lift is a bounded context-value
result, not a retrieval-precision proof that would justify a new external
surface. If a human-PKM bridge is ever wanted, the sanctioned path is a
read-only static render, not an editable vault. Positioning stays: agent-config
writes agent-facing memory; it does not replace a human PKM.

## Verify

```bash
./scripts-run src/scripts/second_brain_score            # corpus summary
./scripts-run src/scripts/second_brain_score --dry-run  # scorer correct + discriminating, no spend
```

The paired-run delta, when authorized, pins to
`internal/bench/reports/` and updates `docs/CLAIMS.md` + `docs/benchmark.md`.

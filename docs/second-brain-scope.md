# Second-brain scope — what it is, what it is not, what is measured

> The agent-config "second-brain" substrate is **agent-facing memory**, not a
> human personal-knowledge-management (PKM) tool. This page states the boundary
> honestly and binds every capability word to evidence. It follows the
> `docs/proof.md` § 4 discipline: the category column describes human-PKM only
> by what is publicly observable, never as a counter-claim to a named project.
>
> Roadmap: `road-to-second-brain-delta-proof`. Verdict of record:
> `agents/settings/contexts/second-brain-delta-verdict.md` (council 2026-07-07).

## The honest status (2026-07-08)

The substrate is **built** (typed knowledge dirs, INDEX generator, retrieval
protocol, `hot_context_hook` working-memory continuity across compaction,
`fold_intake`, contradiction surfacing). What is **not yet measured** is the
*delta*: whether agent-facing memory beats a no-memory baseline on a
reproducible multi-session task.

- **The measurement rig exists** — a deterministic multi-session recall corpus
  (`internal/bench/second-brain/corpus/`) + a scorer
  (`src/scripts/second_brain_score.ts`) with no model-in-the-loop grading. It
  dry-runs correctly and discriminatingly on hand-written transcripts.
- **The paired run does not** — the 3-arm `memory-on` / `memory-off` /
  `placebo` measurement (Phase 2) is spend-bearing and has not been run. So
  there is **no measured task-lift**, and therefore **no "second brain"
  capability claim** is made anywhere in public prose. This is the
  falsifiability lock: the marker never outruns the evidence.

Until the paired run backs a lift, the substrate is documented as **continuity
convenience** — it carries working memory across sessions and compaction — not
a proven task-accuracy multiplier.

## What it IS (by design; task-lift unmeasured)

| Capability | What it does | Evidence status |
|---|---|---|
| Working-memory continuity | `hot_context_hook` re-injects a bounded, deterministic cache across session boundaries and Claude Code compaction | mechanism shipped; task-lift **unmeasured** |
| Promotable knowledge cards/pages | typed dirs + INDEX + retrieval protocol, with redaction + team-share gate | mechanism shipped; task-lift **unmeasured** |
| Contradiction surfacing | a session that contradicts a prior decision is flagged on promote | mechanism shipped; catch-rate **unmeasured** |

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
- **Not a measured accuracy multiplier** — see the honest status above.

## Interop, not competition (gated on a measured lift)

If — and only if — the Phase-2 paired run shows a real lift, the sanctioned
next step is a **one-way export** (promoted cards → plain Obsidian-compatible
Markdown + wikilinks), positioning agent-config as the *writer* and a human PKM
as the *reader*: complementary, never a replacement. Absent a measured lift,
the exporter is not built.

## Verify

```bash
./scripts-run src/scripts/second_brain_score            # corpus summary
./scripts-run src/scripts/second_brain_score --dry-run  # scorer correct + discriminating, no spend
```

The paired-run delta, when authorized, pins to
`internal/bench/reports/` and updates `docs/CLAIMS.md` + `docs/benchmark.md`.

<!-- evidence-type: analysis -->

# Host-emitted-event denominator — the obtainability survey (Phase 1.1)

**Date:** 2026-08-29 · **Roadmap:** `road-to-journal-host-capture-measurement`,
step 1.1 · **Subject:** every bound `(platform, event)` cell in
`src/scripts/hook_manifest.yaml`

## Verdict in one line

**A host-emitted-event denominator is obtainable for 6 of the 43 bound cells,
all of them on one platform — and that is enough to falsify the reason the
council gave for abandoning the measurement.** The remaining 37 bound cells emit
without publishing any count this package can read.

## Population and install configuration — committed here, before any measurement

Step 1.3 requires the population to be written down **first**, so the number
cannot be re-scoped once it lands. It is committed on this page rather than on
the measurement page for exactly that reason: this page precedes the
measurement.

Per the unanimous council resolution of `measurement-population-default-off`
(option **c**), **two** rates will be published, each with its own caption, and
neither may be presented as "the" capture rate:

| Population | Install configuration | What it answers |
|---|---|---|
| **Opted-in** | `hooks.runtime_journal.enabled: true` | Does the journal capture what it is bound to capture, for a user who asked for it? |
| **Default** | shipped defaults; `hooks.runtime_journal.enabled` absent, resolving to `false` | What does the installed base actually record today? Expected 0 %, over a **known** denominator — a real and publishable result, unlike today's `undefined`. |

Both are scoped to the **six `counted` cells** identified below, never to all 43
bound cells. Each caption must therefore carry four things: numerator,
denominator, population, and install configuration.

One refinement from the openai seat is adopted and recorded here so it is not
lost between this page and the measurement: a default-install 0 % is a
**product-adoption / configuration** result, not a capture-*quality* result, and
the caption must say so. A reader who meets 0 % without that label will read a
working mechanism as a broken one.

## Why this survey decides something

The `host-denominator-obtainability` blocker offered three options and the AI
council of 2026-08-29 **split**: anthropic chose (c), *declare the host rate
unobtainable and close on that finding*; openai chose (b), *measure only the
cells whose host publishes a count*. Both rejected (a) — building a dispatch
counter and calling it a host rate — as the category substitution this
roadmap's parent already had to refuse once.

anthropic's argument for (c) rested on a **prediction**, stated as such:

> "if most platforms don't publish host counts, (b) yields near-zero measurable
> cells and functionally collapses to (c)."

That prediction is testable, and this survey is the test. **It comes back
false.** Option (b) yields six cells, on the platform carrying the most bound
cells of the eight. The split therefore resolves to **(b)** on evidence rather
than on preference or on a tie-break — which is the resolution rule this work
was asked to follow.

## The table

Every one of the 80 `(platform, event)` cells, no blanks. Bindings read from
`src/scripts/hook_manifest.yaml` at execution, not carried from memory.

| event | augment | claude | cowork | cursor | cline | windsurf | gemini | copilot |
|---|---|---|---|---|---|---|---|---|
| `session_start` | emits-but-uncounted | counted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound |
| `session_end` | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound | emits-but-uncounted | not-bound |
| `user_prompt_submit` | not-bound | counted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound |
| `pre_tool_use` | emits-but-uncounted | counted | emits-but-uncounted | not-bound | not-bound | not-bound | not-bound | not-bound |
| `post_tool_use` | emits-but-uncounted | counted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound | emits-but-uncounted | not-bound |
| `stop` | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | emits-but-uncounted | not-bound |
| `pre_compact` | not-bound | emits-but-uncounted | not-bound | not-bound | not-bound | not-bound | not-bound | not-bound |
| `agent_error` | not-bound | not-bound | not-bound | not-bound | not-bound | not-bound | not-bound | not-bound |
| `subagent_start` | not-bound | counted | emits-but-uncounted | not-bound | not-bound | not-bound | not-bound | not-bound |
| `subagent_stop` | not-bound | counted | emits-but-uncounted | not-bound | not-bound | not-bound | not-bound | not-bound |

**Totals:** 6 `counted` · 34 `emits-but-uncounted` · 40 `not-bound` · 80 cells.
43 cells are bound (`counted` + `emits-but-uncounted`).

## What `counted` rests on — read, not assumed

Claude Code writes a durable, host-authored session transcript per session at
`~/.claude/projects/<project-slug>/<session-id>.jsonl`. This is a **host**
artefact: the package does not write it, and it exists whether or not any hook
is bound. It was read at execution (156 transcripts present for this project;
the newest was analysed record by record) and the following emissions are
reconstructable from it:

| Event | Reconstructed from | Reading in the analysed transcript |
|---|---|---|
| `session_start` | one transcript file per session | 1 per file |
| `user_prompt_submit` | `type: user` records carrying no `tool_result` block | 3 (vs 163 `user` records that are tool results — the discriminator is what makes this a count rather than an overcount) |
| `pre_tool_use` / `post_tool_use` | `tool_use` blocks in `type: assistant` records | 164 |
| `subagent_start` / `subagent_stop` | `tool_use` blocks naming the `Agent`/`Task` tool | 0 — correct for this session, which spawned none |

## What is deliberately NOT claimed `counted`

**`stop` on Claude, though it looked reconstructable.** The obvious mapping is
`type: assistant` records carrying a `stop_reason`. Measured, **all 305 of them
read `stop_reason: tool_use` and none read `end_turn`** — so the field counts
assistant *messages*, not turn completions, and the hook `stop` event fires once
per turn. Using it would have over-counted the denominator by roughly two orders
of magnitude and made the capture rate look catastrophically low for a reason
that is an artefact of the instrument. It is classified `emits-but-uncounted`.

**`session_end`, `pre_compact` and `agent_error`.** No transcript record
corresponds to them.

**Every cell on the other seven platforms.** Stated precisely, because the
distinction matters: this is an **absence of evidence within this package's
reach**, not a proof that those hosts publish nothing. What was established is
(i) the package contains **no reader** for a host-published emission count on
any platform — searched at execution — and (ii) the hook integration model gives
the package one observation per *dispatch*, never a host-side tally. A host that
does publish a count somewhere unread by this package would move its cells to
`counted`; nothing here forecloses that, and finding one is the cheapest way to
widen the measurement.

## Consequence for the blocker

`host-denominator-obtainability` resolves to **(b)**: measure the six `counted`
cells, report the rate only for them, and leave the other 37 bound cells
explicitly unmeasured rather than silently absent. The published caption must
name the six cells, because a rate over 6 of 43 cells is a different claim from
a rate over all of them, and a reader who cannot see the denominator's *scope*
cannot tell them apart — the same failure the parent's evidence page had to
refuse when the dispatch figure was mistaken for a host figure.

`measurement-population-default-off` is therefore **not** moot (it would have
been under (c)) and its unanimous **(c)** stands: publish both the opted-in and
the default-install rate, each with its own caption.

## Limits of this survey

- **One platform's artefact was read; seven were not, because there is nothing
  in this package to read.** See above — absence of evidence, named as such.
- **The transcript is a local artefact.** It establishes obtainability, not that
  a population of installs will yield one; a measurement still needs machines.
- **Reconstruction is not the host's own tally.** The transcript is host-written
  and independent of the hook path, which is what makes it a legitimate
  denominator, but the counts are derived by this analysis rather than published
  as counts by the host. The derivation is the four rules in the table above and
  is re-runnable.

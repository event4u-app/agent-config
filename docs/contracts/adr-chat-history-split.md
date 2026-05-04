---
stability: beta
---

# ADR — Chat-history rule split

> **Status:** Decided · 2026-05-02
> **Context:** AI #1, AI #3, AI #5 review of PR #29 flagged the
> 200-line monolithic `rules/chat-history.md` as the rule the agent
> revisited 12+ times during the 1.14.0 cycle — three independent
> concerns coupled into one Iron Law block.
> **Builds on:** [`adr-implement-ticket-runtime.md`](adr-implement-ticket-runtime.md)
> — engine path was added to the existing rule mid-flight, which
> exposed the coupling.
> **Defers to:** Phase 2 P2.9 (memory-visibility surface) for the
> reuse of the heartbeat plumbing.

## Decision

`rules/chat-history.md` is split into **three sibling `always` rules**,
each owning one orthogonal concern and a clear single Iron Law:

| Rule | Iron Law owned | What it answers |
|---|---|---|
| `chat-history-ownership.md` | Foreign/Returning/Missing handshake — whose file is this? | Activation, two-paths table (HOOK/ENGINE/CHECKPOINT/MANUAL), Foreign/Returning prompts |
| `chat-history-cadence.md` | turn-check + append gates — when to write? | Turn-start gate, append cadence (`per_turn`/`per_phase`/`per_tool`), `OWNERSHIP_REFUSED` handling |
| `chat-history-visibility.md` | Heartbeat marker — how does the user see drift? | Heartbeat invocation, `on`/`off`/`hybrid` modes, memory-typing-the-marker hard-rule |

The original `rules/chat-history.md` is deleted. Cross-references
across the three splits are explicit one-line backlinks at the top of
each file. The CHECKPOINT-path Iron Law (the three-gate block) is
re-anchored: ownership owns gate 1 (turn-check), cadence owns gate 2
(append), visibility owns gate 3 (heartbeat).

## Why this was a real question

Three options were on the table:

1. **Leave the monolith, add sub-section index.** Rejected: the
   12-iteration churn was on individual sub-sections (heartbeat
   visibility modes, foreign/returning prompts, cadence frequencies)
   touching unrelated parts of the file. Index doesn't separate
   concerns; it only renames the problem.
2. **Move the Iron Law block to a context doc, leave the rule as a
   thin pointer.** Rejected: contexts are reference, rules are
   triggers — the three gates ARE the trigger surface. Demoting them
   to context bleeds enforcement.
3. **Three sibling rules, one concern each (chosen).** Adopted
   because each concern has a distinct lifecycle: ownership is a
   first-turn handshake (rare event, high stakes), cadence is per-
   phase (high frequency, low stakes per write), visibility is per-
   reply (every turn, observability-only). Coupling them produced the
   "memory-typing the marker" failure mode we hardened against in
   1.14.0 — separating them makes future hardening surgical.

## Sizing & always-rule budget

Pre-split: `chat-history.md` = 201 lines. Always-rule budget pre-split = 2207 lines across 18 rules.

Post-split target (frontmatter + cloud-behavior + interactions
sections triplicated):

| File | Target lines |
|---|---:|
| `chat-history-ownership.md` | ≤ 95 |
| `chat-history-cadence.md` | ≤ 80 |
| `chat-history-visibility.md` | ≤ 65 |
| **Total** | **≤ 240** |

Net always-rule budget delta: **+39 lines** (≈ 1.8 % of the current
2207-line total). Within the ~49k-token target ceiling tracked in
`road-to-governance-cleanup.md`.

## Consequences

**Wins**

- Each rule has one Iron Law instead of three. Future edits to
  cadence don't risk touching ownership prompt mechanics.
- The `chat-history-visibility.md` rule becomes a clean reuse target
  for Phase 2 P2.9 (memory-visibility surface).
- Refactoring the engine-side hooks (`chat_history_turn_check.py`,
  `chat_history_append.py`, `chat_history_heartbeat.py`) is now
  1:1 with rule files — one rule per hook.

**Costs / migration surface**

- Every cross-reference to `chat-history` across the package must be
  updated to point at the right split. Inventory: ~30 files (rules,
  templates, scripts, commands, contexts, README, AGENTS.md).
- `docs-sync.md` table needs the new triple instead of the singleton.
- `scripts/check_references.py` runs catch broken links; CI gates the
  split.
- Any consumer project carrying a project-level override of
  `chat-history` must also split (or alias) — handled by an explicit
  migration note in `docs/migrations/commands-1.15.0.md` (extended
  for this rule split).

**Reversibility**

Split is a structural refactor, not a behavior change. Reverting
would mean re-concatenating the three files — mechanical but loud
in CI. The CHECKPOINT-path Iron Law numbering is preserved, so
agents that learned "gates 1-2-3" still find the same numbered
sequence, just across three files.

## Out of scope

- Behavior changes to `scripts/chat_history.py` — the script's
  CLI surface is unchanged.
- Adding new cadence frequencies or visibility modes — separate
  decision, not part of this split.
- Removing the CHECKPOINT-path entirely — Cline-on-Windows still
  needs cooperative gates; that's a Phase 3+ conversation.

## Implementation plan (this PR)

1. Create the three new rules under `.agent-src.uncompressed/rules/`.
2. Delete `.agent-src.uncompressed/rules/chat-history.md`.
3. Run `bash scripts/compress.sh --sync` to project the change into
   `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`,
   `.windsurfrules`.
4. Update every cross-reference (~30 files) — `check-refs` is the
   gate.
5. Append a migration note to `docs/migrations/commands-1.15.0.md`
   under a new "Rule splits" section.
6. Regenerate `agents/roadmaps-progress.md`.
7. Verify: `task ci` (lint-skills, check-refs, check-public-links,
   check-compression, counts-check, lint-readme, runtime-e2e,
   roadmap-progress-check, lint-readme).

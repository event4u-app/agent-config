---
complexity: structural
status: ready
---

# Road to memory-pipeline consolidation & scope

> Collapse the three overlapping session-mining surfaces into one
> `/memory mine` command (keep the cross-host JSONL log + `/chat-history
> import`, drop `/chat-history show`), AND tighten the Layer-1 memory scope
> per the council Option-B verdict: gitignore intake, narrow the curated
> types to the defensible slice, add size bounding, keep the YML machinery.

## Goal

One mining command (`/memory mine --mode=[signals|proposals|both]`) sourced
from the universal cross-host JSONL log, plus a bounded committed memory
that stays small: intake gitignored (curated-only commits), three curated
types, per-type entry caps, archived entries deleted — so the pipeline
`log → mine → intake → consolidate → promote` is single-path and the repo
never bloats, without a decay engine.

## Council verdict — Option B (keep narrowed YML; markdown-only rejected)

Resolved 2026-06-14 (claude-sonnet-4-5 + gpt-4o, debate 2 rounds — both
flipped to Option B in rebuttal): **keep** the `retrieve()` typed-lookup
machinery + `check_memory.py` redaction gate; **narrow** the content.
Markdown-only was rejected — a schema-less markdown parser is harder than
the working ~180-line `memory_lookup.py`, substring matching causes
false positives, and the redaction gate is real governance markdown can't
cheaply replace. NO personal memory layer (category error). Decay engine
stays gone — size is bounded manually.

## Prerequisites

- [ ] Council decision recorded (claude-sonnet-4-5 + gpt-4o, 2026-06-14:
      keep JSONL log + `import`, merge mining paths, drop `show`).
- [ ] `road-to-agent-memory-removal.md` Phase 5 landed, OR coordinate the
      shared `memory-consolidation` SKILL edit between the two roadmaps to
      avoid a conflicting rewrite (both touch that file).

## Context

Verified facts behind the consolidation:
- `src/scripts/mine_session.py` is "Phase-1 single-host" — supports **only**
  `claude-code` (`~/.claude/projects/*.jsonl`); any other host prints
  "No TranscriptAdapter for host=…".
- The chat-history JSONL log (`agents/runtime/.agent-chat-history`) is written
  by **platform hooks** (cross-host) → it is the universal normalized capture,
  NOT a redundant copy. Keep it.
- Three mining paths overlap: `/chat-history learn` (log → proposals via
  `learning-to-rule-or-skill`), `/memory mine-session` (claude-code transcript
  → intake signals), `memory-consolidation` GATHER (intake → curated).

Target pipeline:
`platform hooks → .agent-chat-history (JSONL) → /memory mine
--mode=[signals|proposals|both] → intake / proposals → /memory consolidate`.

Command files: `src/domains/meta/memory/mine-session/command.md`,
`src/domains/meta/chat-history/{learn,show,import}/command.md` +
orchestrator `src/domains/meta/chat-history/command.md`. Scripts:
`src/scripts/mine_session.py`, `src/scripts/chat_history.py`.

## Phase 1 — Unified mining engine reads the JSONL log

- [ ] Extend `src/scripts/mine_session.py` to read the chat-history JSONL log
      (`agents/runtime/.agent-chat-history`, session-tagged via the `s` field)
      as the canonical cross-host source, keeping the claude-code transcript
      path as a fallback adapter.
- [ ] Add a `--mode=[signals|proposals|both]` switch: `signals` → memory
      intake (current behaviour); `proposals` → run `learning-to-rule-or-skill`;
      `both` → run both.
- [ ] Preserve the opt-in confirmation gates (`--confirm-transcript-access`,
      `--commit-intake`) and preview-by-default.

**Exit:** `python3 src/scripts/mine_session.py --mode=both` mines a prior
session from the JSONL log and previews both signals + proposals; targeted
unit run for the new mode passes.
**Rollback:** revert `mine_session.py`; the three legacy commands still work.

## Phase 2 — Fold `/chat-history learn` into `/memory mine --mode=proposals`

- [ ] Rewrite `src/domains/meta/memory/mine-session/command.md` as the single
      `/memory mine` command documenting the three modes.
- [ ] Remove `src/domains/meta/chat-history/learn/command.md`; update the
      `chat-history` orchestrator (`command.md`) sub-command table to point
      `learn` users at `/memory mine --mode=proposals`.
- [ ] Update `learning-to-rule-or-skill` references that named `chat-history learn`.

**Exit:** `task check-refs` green; no command file references a removed
`/chat-history learn`; orchestrator table updated.
**Rollback:** restore `learn/command.md` + orchestrator table.

## Phase 3 — Drop `/chat-history show`, keep `import` + log + hooks

- [ ] Remove `src/domains/meta/chat-history/show/command.md`; update the
      orchestrator table (keep `import` only).
- [ ] Confirm `chat-history` orchestrator now exposes only `import` (resume)
      and points mining at `/memory mine`.
- [ ] Leave `chat_history.py` write path + platform hooks + `import` untouched.

**Exit:** `/chat-history` orchestrator lists `import` only; `task check-refs`
green; the JSONL log still written by the hook (manual smoke).
**Rollback:** restore `show/command.md` + orchestrator entry.

## Phase 4 — Single GATHER source + docs

- [ ] Point the `memory-consolidation` GATHER phase at `/memory mine` as the
      one mining entry (coordinate with `road-to-agent-memory-removal.md`
      Phase 5 which adds MemSkill write-time discipline to the same skill).
- [ ] Update `docs/contracts/memory-visibility-v1.md` and any docs that named
      the three separate mining paths to the unified pipeline.
- [ ] Update `docs/contracts/command-surface*` / catalog counts for the
      removed commands.

**Exit:** docs describe one mining command; `task check-refs` green; skill
lints clean (`task lint-skills`).
**Rollback:** revert the doc + skill edits.

## Phase 5 — Gitignore intake (commit only curated)

- [ ] Add `agents/memory/intake/` to the consumer gitignore block
      (`src/config/gitignore-block.txt`) — raw append-only intake is local
      scratch; only promoted/curated entries get committed/shared.
- [ ] Confirm `retrieve()` still reads local intake (low-confidence tier) but
      curated YML remains the only committed source.
- [ ] Update `memory-consolidation` + `docs/guidelines/agent-infra/memory-access.md`
      to state: intake = local, curated = team-shared.

**Exit:** `agents/memory/intake/` gitignored; `retrieve()` still returns
intake hits locally; docs state the commit boundary.
**Rollback:** remove the gitignore entry.

## Phase 6 — Narrow curated types to the defensible slice

- [ ] Keep curated types `ownership`, `domain-invariants`, `product-rules`.
- [ ] Retire `architecture-decisions` (point to ADRs), `incident-learnings`
      (point to postmortems), `historical-patterns` (git-derivable / merge the
      durable subset into `domain-invariants`). Update the 6 example schemas →
      3, `check_memory.py` type set, `memory_lookup.py` `CURATED_TYPES`, and the
      `retrieve()` callers that named the retired types.
- [ ] Update `docs/guidelines/agent-infra/memory-access.md` type table.

**Exit:** `memory_lookup.py` `CURATED_TYPES` = the 3 kept types; `task check-refs`
green; no skill references a retired type.
**Rollback:** restore the retired type set.

## Phase 7 — Size bounding without a decay engine

- [ ] Add a per-type soft entry cap to `check_memory.py` (e.g. ownership ~50,
      invariants ~150, product-rules ~100): over-cap → consolidation flags it,
      not a hard error.
- [ ] Make the `memory-consolidation` PRUNE phase **delete** `status: archived`
      entries (git history is the cold archive) instead of only flagging them.
- [ ] Enforce one-durable-fact-per-entry in the schema check (reject narrative /
      transcript-style blobs). Keep the existing PII/secret redaction gate.

**Exit:** `check_memory.py` flags over-cap types + rejects multi-fact/narrative
entries; PRUNE deletes archived entries on the next run; redaction gate intact.
**Rollback:** revert the `check_memory.py` + PRUNE edits.

## Phase 8 — Verify + regenerate

- [ ] `grep -rn "chat-history learn\|chat-history show\|mine-session" src docs`
      returns only intentional historical mentions; no retired memory type
      referenced.
- [ ] `/condense` (command + skill edits) and `task generate-tools`.
- [ ] `task ci` green.

**Exit:** greps clean, projections regenerated, `task ci` green.
**Rollback:** revert the failing phase.

## Acceptance criteria

- [ ] One mining command (`/memory mine --mode=[signals|proposals|both]`)
      reading the cross-host JSONL log; `/chat-history learn` and
      `/chat-history show` removed.
- [ ] JSONL log, platform hooks, and `/chat-history import` (resume) retained
      and working.
- [ ] `agents/memory/intake/` gitignored; only curated YML committed.
- [ ] Curated types narrowed to `ownership`, `domain-invariants`,
      `product-rules`; `retrieve()` machinery + `check_memory.py` redaction
      retained (Option B — no markdown-only migration, no decay engine, no
      personal layer).
- [ ] Per-type entry caps + archived-entry deletion + one-fact schema in force.
- [ ] `task check-refs`, `task lint-skills`, `task ci` green.

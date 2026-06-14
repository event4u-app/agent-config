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

- [x] Council decision recorded (claude-sonnet-4-5 + gpt-4o, 2026-06-14:
      keep JSONL log + `import`, merge mining paths, drop `show`).
- [x] `road-to-agent-memory-removal.md` Phase 5 landed (memory-consolidation
      SKILL already carries the MemSkill discipline; this roadmap extends the
      same file consistently).

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

- [x] Extend `src/scripts/mine_session.py` to read the chat-history JSONL log
      (`agents/runtime/.agent-chat-history`, session-tagged via the `s` field)
      as the canonical cross-host source, keeping the claude-code transcript
      path as a fallback adapter (`_resolve_source`, `_iter_chat_history`).
- [x] Add a `--mode=[signals|proposals|both]` switch: `signals` → memory
      intake (current behaviour); `proposals` → proposal seeds for the
      `/memory mine` command to run `learning-to-rule-or-skill` on; `both`.
- [x] Preserve the opt-in confirmation gates (`--confirm-transcript-access`,
      `--commit-intake`) and preview-by-default. (7 unit tests green.)

**Exit:** `python3 src/scripts/mine_session.py --mode=both` mines a prior
session from the JSONL log and previews both signals + proposals; targeted
unit run for the new mode passes.
**Rollback:** revert `mine_session.py`; the three legacy commands still work.

## Phase 2 — Fold `/chat-history learn` into `/memory mine --mode=proposals`

- [x] Rewrite `src/domains/meta/memory/mine-session/command.md` as the single
      mining command documenting the three modes. (Kept the `mine-session` slug
      to avoid a discovery/catalog-wide rename ripple; the `--mode` flag is what
      unifies — `/memory mine-session --mode=[signals|proposals|both]`.)
- [x] Remove the `chat-history/learn` command (src + dist; now deleted); update the
      `chat-history` orchestrator to point `learn` users at
      `/memory mine-session --mode=proposals`.
- [x] Update `learning-to-rule-or-skill` references that named `chat-history learn`
      (import command, agent-handoff, getting-started, surface-map, packs README regen).

**Exit:** `task check-refs` green; no command file references a removed
`/chat-history learn`; orchestrator table updated.
**Rollback:** restore `learn/command.md` + orchestrator table.

## Phase 3 — Drop `/chat-history show`, keep `import` + log + hooks

- [x] Remove the `chat-history/show` command (src + dist; now deleted); update the
      orchestrator table (keep `import` only).
- [x] Confirm `chat-history` orchestrator now exposes only `import` (resume)
      and points mining at `/memory mine-session`. (check_references green;
      command-count + index regenerated.)
- [x] Leave `chat_history.py` write path + platform hooks + `import` untouched.

**Exit:** `/chat-history` orchestrator lists `import` only; `task check-refs`
green; the JSONL log still written by the hook (manual smoke).
**Rollback:** restore `show/command.md` + orchestrator entry.

## Phase 4 — Single GATHER source + docs

- [x] Point the `memory-consolidation` GATHER phase at the single
      `/memory:mine-session` command (cross-host log + `--mode`), replacing the
      stale "single host: Claude Code" note. Same skill already carries the
      MemSkill discipline from the removal roadmap.
- [x] `docs/contracts/memory-visibility-v1.md` carries no mining-path references
      (verified); no doc named the three separate paths beyond the skill/commands
      already updated.
- [x] Catalog + index counts regenerated (147 commands); `check-command-count`
      messaging fixed in README + getting-started. No `command-surface` contract
      file exists.

**Exit:** docs describe one mining command; `task check-refs` green; skill
lints clean (`task lint-skills`).
**Rollback:** revert the doc + skill edits.

## Phase 5 — Gitignore intake (commit only curated)

- [x] Add `agents/memory/intake/` to the consumer gitignore block
      (`src/config/gitignore-block.txt`) — raw append-only intake is local
      scratch; only promoted/curated entries get committed/shared.
- [x] Confirm `retrieve()` still reads local intake (low-confidence tier) but
      curated YML remains the only committed source. (`_iter_intake_entries`
      reads the files regardless of git-tracking — verified unchanged.)
- [x] Update `memory-consolidation` + `docs/guidelines/agent-infra/memory-access.md`
      to state: intake = local, curated = team-shared. (memory-access "Sharing
      boundary" block + skill CONSOLIDATE note.)

**Exit:** `agents/memory/intake/` gitignored; `retrieve()` still returns
intake hits locally; docs state the commit boundary.
**Rollback:** remove the gitignore entry.

## Phase 6 — Narrow curated types (REVISED by tie-break council → Option C)

> Tie-break council (2026-06-14) converged on **Option C**: retire ONLY
> `architecture-decisions` (pure ADR-duplicate). `incident-learnings` +
> `historical-patterns` are load-bearing (security-sensitive-stop prior-incident
> consult, bug-analyzer, review-routing, systematic-debugging) and have no
> postmortems surface to repoint to — Option A (retire all 3 + invent postmortems
> + rewrite a security rule) was rejected. Kept curated types = `ownership`,
> `domain-invariants`, `product-rules`, `incident-learnings`, `historical-patterns` (5).

- [x] Keep `ownership`, `domain-invariants`, `product-rules`, `incident-learnings`,
      `historical-patterns`.
- [x] Retire ONLY `architecture-decisions` → point to ADRs (`docs/decisions/INDEX.md`).
      Removed from `memory_lookup.CURATED_TYPES`, `check_memory.KNOWN_TYPES`,
      `memory_signal.VALID_TYPES`, `check_memory_proposal`, `memory_report`, the
      work-engine type sets (+ template mirrors); deleted the example schema;
      repointed the `retrieve()` callers (`developer-like-execution`,
      `blast-radius-analyzer`, `receiving-code-review`, `think-before-action-mechanics`)
      to the ADR index; updated memory commands + config + gitattributes.
- [x] Update `docs/guidelines/agent-infra/memory-access.md` type table + access-policy.

**Exit:** `memory_lookup.CURATED_TYPES` = the 5 kept types (architecture-decisions
gone); `check-refs` green; no consumer references the retired type; 344 tests green.
**Rollback:** restore the retired type set.

## Phase 7 — Size bounding without a decay engine

- [x] Add a per-type soft entry cap to `check_memory.py` (`PER_TYPE_CAPS`:
      ownership 50, invariants 150, product-rules 100, incident-learnings 150,
      historical-patterns 150): over-cap → warning, not a hard error.
- [x] Make the `memory-consolidation` PRUNE phase **delete** `status: archived`
      entries (git history is the cold archive) instead of only flagging them;
      still-active stale entries stay a flag, not a delete trigger.
- [x] Enforce one-durable-fact-per-entry in `check_memory.py` (`ONE_FACT_MAX_CHARS`
      = 600 → warning on transcript/narrative blobs). PII/secret redaction gate
      kept intact. (check_memory exit 0, 28 tests green.)

**Exit:** `check_memory.py` flags over-cap types + rejects multi-fact/narrative
entries; PRUNE deletes archived entries on the next run; redaction gate intact.
**Rollback:** revert the `check_memory.py` + PRUNE edits.

## Phase 8 — Verify + regenerate

- [x] `grep` returns only intentional historical mentions ("former
      `/chat-history learn`", "`/chat-history show` was dropped"); no retired
      memory type referenced anywhere.
- [x] Re-condensed the 10 changed `.md` into `dist/` + `--mark-done`; `task sync`
      reconciled non-.md (commands 147, condense `--check` in sync);
      `task generate-tools` (0 locally — `tools: []` gate; remote regenerates).
- [x] `task ci`: all change-scoped gates green (`check-refs`, `check-condensation`,
      `validate-schema`, `lint-skills`, `lint-command-routing`, `lint-mcp-inventory`,
      `check-command-count`, `check-index`, `lint-namespace`, `lint-skill-tools`,
      `check-skill-requires`-adjacent + 515 pytest). Two reds are **pre-existing,
      unrelated** (not in this branch's diff): `audit-tokens-budget` (dangling
      `.claude/` symlink) and `check-skill-requires` (`reasoning-orchestrator` →
      `adversarial-review` pack dependency, from the RDP work on main). Remote CI
      regenerates `.claude/`; both pre-date this branch.

**Exit:** greps clean, projections regenerated, change-scoped gates green; the
two reds are pre-existing + unrelated.
**Rollback:** revert the failing phase.

## Acceptance criteria

- [x] One mining command (`/memory mine-session --mode=[signals|proposals|both]`)
      reading the cross-host JSONL log; `/chat-history learn` and
      `/chat-history show` removed.
- [x] JSONL log, platform hooks, and `/chat-history import` (resume) retained
      and working.
- [x] `agents/memory/intake/` gitignored; only curated YML committed.
- [x] Curated types narrowed (Option C — retired only `architecture-decisions`;
      kept `ownership`, `domain-invariants`, `product-rules`, `incident-learnings`,
      `historical-patterns`); `retrieve()` machinery + `check_memory.py` redaction
      retained (no markdown-only migration, no decay engine, no personal layer).
- [x] Per-type entry caps + archived-entry deletion + one-fact schema in force.
- [x] `check-refs` + `lint-skills` green; `task ci` change-scoped gates green
      (two pre-existing unrelated reds documented in Phase 8). <!-- merge-gated: archives with the memory-layer-cleanup PR; the removal roadmap + ADR-094 reference this file until then -->
- [x] Open the memory-layer-cleanup PR (#540, covers both memory roadmaps; merged 2026-06-14).

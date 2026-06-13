---
model_tier: medium
name: memory-consolidation
description: "Use when consolidating session signals into curated memory — four-phase loop ORIENT → GATHER → CONSOLIDATE → PRUNE. Triggers on 'mine my sessions', 'consolidate memory', 'review intake signals'."
status: active
tier: senior
domain: engineering
context_spine: [repo]
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# memory-consolidation

## When to use

- Intake JSONL has accumulated unreviewed signals and `/memory:load` shows the inline-review block.
- A pattern recurred across recent sessions (correction, preference, decision, repeat-bug) and is at risk of being forgotten by the next fresh chat.
- Before closing out a multi-day implementation, capture project-scoped facts so the next agent does not re-discover them.

Do NOT use for one-off code review notes (those belong in PR comments,
not memory), for user-attribute facts like name or IDE preference (the
`onboard` flow owns those), or for transient TODOs (use the task list).

## Cognition cluster

- **Mental model 5 — Signal vs. noise.** A consolidation pass that
  promotes 30 entries from a 50-message session is noise; the Pareto
  cut is roughly 3–5 promote-worthy signals per cycle. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 5.
- **Mental model 12 — Defense in depth.** Date-discipline, tag
  intersection, and per-invocation transcript-access confirmation are
  three independent guards; any one alone fails open. See § 12.

## Procedure

The loop is four sequential phases. Each phase has one exit gate; do
not advance until the gate is green.

### Phase 1 — ORIENT (review scope and assess adapter)

1. Confirm scope: which project, which time window, which transcript
   source. Default window: last 14 days. The agent must read the
   user's last chat message for an explicit `--since` override before
   defaulting.
2. Inspect the current curated state: list files under
   `agents/memory/` and check the most recent `last_validated`
   timestamps. Identify which schemas are stale before mining adds
   noise.
3. Review the **repo** slot of the [context-spine](../../../docs/contracts/context-spine.md)
   for project boundaries (modules, owners, sensitive paths). If empty,
   note the gap in the consolidation report; do not invent.
4. Resolve the `TranscriptAdapter` for the current host (see Adapter
   contract below). If no adapter matches, stop and route the user to
   `/memory:propose` for manual signal entry. Do **not** synthesize.

**Exit gate:** scope, window, adapter all named. If any one is
missing, stop.

### Phase 2 — GATHER SIGNAL

1. Stream transcript turns through the four signal regex families:
   - **Correction:** `actually|wrong|stop doing|don't do|that's not what|nicht so`.
   - **Preference:** `prefer|always|never|standard|i want|ich will`.
   - **Decision:** `let's go with|decided|we'll use|entschieden`.
   - **Pattern (recurring):** the same file path or symbol appears in
     ≥ 3 turns within 24 hours.
2. For each match, extract a **normalised fact** — strip personal
   pronouns, IDE chrome, timestamps, and turn-id. The fact must be
   project-scoped (refers to a file, module, command, or invariant)
   not user-scoped (refers to *me*, *Matze*, *my IDE*).
3. Drop user-attribute matches. If the fact cannot survive the
   normalisation, discard it. The miner is a strict gate.

**Exit gate:** ≤ 5 normalised facts per cycle. More than 5 means the
miner is too loose; tighten patterns and re-run before promoting.

### Phase 3 — CONSOLIDATE

1. Tag each fact via the schema-routing table:

   | Tag | Schema |
   |---|---|
   | `convention` | `agents/memory/conventions.yml` |
   | `invariant` | `agents/memory/domain-invariants.yml` |
   | `gotcha` | `agents/memory/operational-gotchas.yml` |
   | `pattern` | `agents/memory/recurring-patterns.yml` |

   A fact may carry **two** tags; the promoter resolves via tag
   intersection, not by file extension. See
   [`docs/contracts/agent-memory-contract.md`](../../../docs/contracts/agent-memory-contract.md)
   for the curated YAML schemas.

2. Append each fact as one JSONL line to
   `agents/memory/intake/<primary-tag>.jsonl` with required fields
   per the contract: `ts`, `type`, `key`, `observation`, `source:
   agent`, `session_id`, plus the new optional `tags: [<one>, <two>]`.
3. Default to `--preview` mode: render the JSONL block to stdout and
   stop. Only `--commit-intake` writes the file.

**Exit gate:** every fact carries ≥ 1 tag and a JSONL-shape that
validates against the contract.

### Phase 4 — PRUNE & INDEX

1. After promotion (handled by `/memory:promote`, not this skill),
   archive the consumed JSONL lines into
   `agents/memory/intake/.archive/YYYY-Www.jsonl` — week-bucketed,
   not day-bucketed (defeats session-context inference attacks).
2. If a curated entry's `last_validated` field is older than 90 days
   AND no signal in the last 30 days touched its `key`, mark it
   stale in the consolidation report — but do **not** auto-delete.
   Pruning is a human-confirmed action.

**Exit gate:** report cites ≥ 0 promotions, ≥ 0 stale flags, 0
auto-deletes.

## TranscriptAdapter contract

The miner is host-agnostic by design. A `TranscriptAdapter` for host
`X` ships:

- **Discover:** function returning the absolute path(s) of session
  transcripts for the active project, scoped to the `--since` window.
  Phase 1 ships the Claude-Code adapter only; absent adapter →
  `not-supported-on-this-host`.
- **Iterate:** generator yielding turn objects with `{role, ts,
  text}`. Adapter strips IDE chrome and tool-call boilerplate before
  yielding.
- **Redact:** function applied to every yielded text — drops user
  names, file paths outside the repo root, and any personal
  identifier the consumer project lists in
  `.agent-settings.yml` under `memory.redact_patterns`.

Phase 1 implementation lives in
`/memory:mine-session` (single host: Claude Code,
`~/.claude/projects/*/sessions/*.jsonl`). Phase 3 of the
adoption roadmap adds a second host adapter; the contract above is
documented now so the second implementation is not a vacuum design.

## Related Skills

**WHEN to use this**

- Intake JSONL has > 10 unreviewed signals.
- A correction / preference recurred across ≥ 3 sessions.
- Closing out a multi-day implementation.

**WHEN NOT to use this**

- One-off PR review notes — comment on the PR.
- User-attribute facts (name, IDE) — those belong to the
  [`onboard`](../../commands/onboard.md) flow, not curated memory.
- Transient TODOs — use the task-list tools.
- A single bug fix that does not generalise — fix the bug, do not
  memorise it.

## When the agent should load this

- "Mine my recent sessions for memory signals."
- "Consolidate the intake stream into curated entries."
- "What did we decide about X across the last week?"
- "Review unreviewed memory signals before I switch projects."
- "Run a memory consolidation cycle."

## Output

1. **Consolidation report** — Markdown block printed to stdout: scope
   (project, window, host), signal counts per class, list of
   normalised facts with tag and target schema, stale-flag list. No
   side effects in `--preview` mode.
2. **Intake JSONL appendix** — only with `--commit-intake`: appended
   lines to `agents/memory/intake/<tag>.jsonl`. Lines validate
   against the contract.
3. **Archive bucket** — only after `/memory:promote` runs and lifts
   the lines into curated YAML: appends to
   `agents/memory/intake/.archive/YYYY-Www.jsonl`. Week-bucketed.

## Gotcha

- Mining without `--confirm-transcript-access` reads zero turns and
  prints an opt-in hint. The flag is per-invocation, not persistent.
- The miner is a strict gate. > 5 normalised facts per cycle means
  the regex set is too loose, not that the session was rich.
- A fact tagged `gotcha + invariant` lands in the `gotcha` JSONL
  (primary tag); the promoter reads tag intersection to decide the
  curated YAML target.
- Date-discipline: the `check_memory.py` linter rejects
  `yesterday|today|tomorrow|last/next/this week|month|year` in curated
  YAML without an `YYYY-MM-DD` anchor within ±20 chars. Re-anchor
  before commit.

## Do NOT

- Do NOT auto-trigger this skill on session end. The flow is manual,
  per-invocation, and confirmed.
- Do NOT vendor patterns or text from any external source —
  the upstream lacks a `LICENSE`. Concept and procedure structure are
  the only adoption surface.
- Do NOT promote a normalised fact whose `key` falls outside the
  repo root or names another consumer project.
- Do NOT delete a stale curated entry without explicit user
  confirmation. Stale-flag is the most this skill emits.

## Runnable example

After a 4-day refactor of `app/Services/PaymentGateway`, run a
consolidation cycle:

- `/memory:mine-session --since 2026-05-06 --confirm-transcript-access --preview`.
- Miner surfaces 4 facts: 1 correction (`PaymentGateway::charge` must
  not throw on idempotency replays — `convention`), 1 decision
  (`Stripe webhook signing key lives in `config/services.php` only —
  `gotcha`), 2 patterns (`PaymentGatewayTest` flakes when seeded data
  carries timestamps in microseconds — `pattern + gotcha`).
- Report cites 0 stale flags. Re-run with `--commit-intake` after
  spot-checking the 4 facts.
- Hand off to `/memory:promote` for the curated-YAML write.

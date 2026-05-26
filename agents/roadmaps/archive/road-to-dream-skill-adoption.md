---
complexity: lightweight
---

# Road to dream-skill adoption

**Status:** ARCHIVED — Phase 1 shipped (PR #81), Phase 2 partial
shipped (PR #82, B2 + B3 + B4), B1 + Phase 3 cancelled-deferred
behind external evidence gates. New roadmap reactivates the
deferred work when the gates fire — not before.
**Started:** 2026-05-10
**Closed:** 2026-05-10
**Trigger:** User pointed at `grandamenium/dream-skill` and asked
for a `coreyhaines31/marketingskills`-depth analysis with autonomous
roadmap drafting via the AI council. Council consultation
(`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`, $0.0643 actual,
2 rounds) shaped the adoption guardrails.
**Mode:** Closure shape — `[-]` on B1 and Phase 3 reflects
gate-deferred-by-design, not abandoned work. The redesign and
trigger conditions are documented in-line so a future council pass
can reactivate them under fresh evidence without re-deriving the
context.

## Purpose

Ship a portable memory-consolidation workflow inspired by
`dream-skill`'s four-phase loop, **without** vendoring its code,
file format, topic taxonomy, or auto-trigger mechanism. The win is a
manual `/memory:mine-session` sub-command that scans Claude Code
transcripts (single-host, Phase 1) for four signal classes
(corrections, preferences, decisions, recurring patterns), redacts
to project-scoped normalised facts, and drops them into the
existing `agents/memory/intake/*.jsonl` stream — feeding the existing
`/memory:promote` curation funnel. The four-phase procedure
(`ORIENT → GATHER SIGNAL → CONSOLIDATE → PRUNE & INDEX`) ships as
the body of a new senior-tier skill `memory-consolidation`. A
documented `TranscriptAdapter` contract sits in front of the Claude
Code implementation so a second host can be added later against
real evidence, not against a vacuum-designed interface.

The adoption is council-shaped: the persistent
`personal.transcript_mining` flag is replaced with a per-invocation
`--confirm-transcript-access` flag; intake review is surfaced inline
during `/memory:load` (no auto-spawn, no reminders); intake JSONL
gains an optional `tags: []` field so signals that straddle two
schemas land without silent drops; promotions write `ts_week`
instead of full ISO timestamps to defeat session-context inference.
A date-discipline linter rejects relative dates in curated YAML.

Full background, lens-by-lens analysis, comparison matrix, council
convergence, and the rationale for what we **do not** ship lives at
[`agents/evidence/analysis/compare-dream-skill.md`](../analysis/compare-dream-skill.md).

## Scope ordering

- **Phase 1 (A1–A8) — Ship skill + sub-command + date linter +
  intake `tags` field + inline-review hook on `/memory:load`.** This
  is the executable scope.
- **Phase 2 (B1–B4) — Generated index, critical-priority tier,
  temporal-jitter promotion (`ts_week`).** Deferred. Gate: ≥ 100
  curated entries OR observed `/memory:load` latency > 1.5 s on a
  real consumer project.
- **Phase 3 (C1–C3) — Second `TranscriptAdapter` implementation
  (Cursor or Augment).** Deferred. Gate: ≥ 2 consumer projects file
  an issue requesting non-Claude-Code mining, OR Phase 1 measured
  signal-yield rate > 5 promoted entries per consolidation cycle
  (proves the pattern is worth porting).

## Phase 1 — Ship the skill + sub-command + date linter (READY)

- [x] **A1 — Cluster contract update.** Add `mine-session` to the
  `memory` cluster row in
  [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md):
  `add · load · promote · propose · mine-session`. No legacy atomic
  to deprecate (new sub-command). Bump `lint_no_new_atomic_commands.py`
  expected-set if it caches the row.
- [x] **A2 — `memory-consolidation` skill.** Author at
  `.agent-src.uncondensed/skills/memory-consolidation/SKILL.md`,
  senior-tier, Wing-1 engineering. Body documents the four phases
  (`ORIENT → GATHER SIGNAL → CONSOLIDATE → PRUNE & INDEX`) with the
  per-phase invariants from `compare-dream-skill.md` § Top-3 ADOPT,
  the `TranscriptAdapter` contract (file-path discovery, JSONL
  schema, normalisation rules, output shape), and the schema-mapping
  table for our four typed schemas (rejects `preferences.md` user-
  attribute noise; routes via tag intersection). Cites
  `dream-skill` as concept source, never vendors text or code.
  Frontmatter trigger covers "consolidate memory", "mine my
  sessions", "review intake signals".
- [x] **A3 — `/memory:mine-session` sub-command.** Author at
  `.agent-src.uncondensed/commands/memory/mine-session.md`,
  cluster `memory`, sub `mine-session`. Default behaviour
  `--preview`; explicit `--commit-intake` writes JSONL.
  `--confirm-transcript-access` flag required per invocation
  (replaces persistent settings flag); without it the command
  refuses transcript reads and prints a one-line opt-in hint.
  Accepts `--since YYYY-MM-DD` and `--limit N`; default window
  14 days. Single-host implementation against
  `~/.claude/projects/*/sessions/*.jsonl`; other hosts emit
  `not-supported-on-this-host` with manual `/memory:propose` fallback.
- [x] **A4 — `/memory:load` inline-review hook.** Update
  `.agent-src.uncondensed/commands/memory/load.md` so a load
  action that finds > 10 unreviewed intake entries surfaces a
  numbered-options preview of the top-3 signals (highest-confidence
  first) with `[s]kip` as the default. Replaces the auto-trigger
  problem without violating the autonomy floor; fits into
  `/memory:load`'s existing surface, no new mechanism. Threshold
  `10` lives in `.agent-settings.yml` under
  `memory.inline_review_threshold` (default 10, settable by
  consumers).
- [x] **A5 — Date-discipline linter rule.** Add
  `scripts/check_memory.py` (new file) with one rule for Phase 1:
  reject curated YAML body fields containing `yesterday|last
  week|last month|tomorrow|today` without an ISO anchor
  (`YYYY-MM-DD`) within ±5 chars. Wire into `task lint-memory` and
  the existing `task ci` aggregator.
- [x] **A6 — Intake `tags` field.** Update
  [`docs/contracts/agent-memory-contract.md`](../../docs/contracts/agent-memory-contract.md)
  to add `tags: string[]` (optional, default `[]`) to the intake
  JSONL shape. Update `/memory:propose` and `/memory:mine-session`
  to emit; `/memory:promote` to read tag intersection when picking
  the destination schema. Schema-mapping table in the skill body
  documents the routing.
- [x] **A7 — Marketplace + counts sync.** Run `task sync` +
  `task generate-tools` to project the new skill and command into
  `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`,
  `.clinerules/`, `.windsurfrules`. Update
  `.claude-plugin/marketplace.json`, `README.md` skill / command
  counts, `docs/architecture.md`, and the skills-count line in
  `AGENTS.md` to match.
- [x] **A8 — Smoke-test fixture + `task ci`.** Author
  `tests/fixtures/dream-skill/` with one minimal Claude-Code-format
  JSONL session containing one of each signal class (corrections,
  preferences, decisions, patterns). Add
  `tests/test_mine_session.py` (or extend existing memory tests)
  asserting the command emits JSONL matching the contract shape,
  redacts user names, and writes nothing in `--preview` mode. Run
  `task ci` end-to-end.

**Exit criteria for Phase 1:**

1. `task lint-skills`, `task check-refs`, `task check-portability`,
   `task lint-memory`, `task test`, `task ci` all pass.
2. The new skill renders cleanly via `skill_linter.py`.
3. `/memory:mine-session --preview --confirm-transcript-access` on
   the smoke-test fixture surfaces 4 signals (one per class) and
   writes nothing.
4. `/memory:mine-session --commit-intake --confirm-transcript-access`
   on the same fixture appends 4 JSONL lines to
   `agents/memory/intake/<type>.jsonl`, all redacted, all carrying
   `tags: []`.
5. `/memory:load` with > 10 unreviewed entries surfaces the
   numbered-options preview block; with ≤ 10 it does not.
6. The date-discipline linter fails-loud on a hand-crafted YAML
   entry with `last week` and passes on the same entry rewritten
   with `YYYY-MM-DD`.

**Rollback trigger:** if any of (a) the cluster-contract update
breaks `lint_no_new_atomic_commands.py`, (b) the inline-review hook
lands during `/memory:load` and the user reports it as nagging in
real use, OR (c) the council surfaces a privacy gap not addressed
above, **revert A4 and A6 only** (keep skill + sub-command + linter
since they are independently useful) and re-run the council.

## Phase 2 — Generated index + critical-priority tier + temporal jitter (partial)

**Status:** B2 + B3 + B4 shipped 2026-05-10. B1 explicitly deferred —
its sub-gate (≥ 100 curated entries OR measured `/memory:load` latency
> 1.5 s) has not fired and the council confirmed that a static line-cap
on a near-empty index ships theatre.

- [-] **B1 — generated memory-index artifact.** *Deferred.* Council
  Round 2 (`anthropic/claude-sonnet-4-5`) flagged the 200-line line-cap
  as the wrong metric: the index is a human-browse artifact, not a
  token-budget problem. Section-based density caps (by priority + tag)
  would replace raw line caps when this is reactivated. **Sub-gate:**
  reactivate when ≥ 100 curated entries exist in any consumer project,
  OR `/memory:load` measured latency exceeds 1.5 s. Until then, file
  walks are O(n) on a small n.
- [x] **B2 — `priority: critical | normal | low` field.** Added as
  optional frontmatter (default `normal`) per Phase 2 council
  convergence. `scripts/check_memory.py` validates the enum, warns on
  `critical-stale` (>90 days since `last_validated`), and warns on
  tier-0 inflation (>10 active critical entries per type).
  `/memory:load` surfaces the Tier-0 critical slice across all types
  before the requested type-load. `/memory:promote` documents
  pass-through with curator override allowed. Council rejected a
  fourth `high` tier — the three-tier enum is the smallest set that
  solves the always-surface use case.
- [x] **B3 — Temporal-jitter promotion.** `/memory:promote` writes
  `ts_week: YYYY-Www` (ISO-week) on curated entries. **Convention,
  not validator-enforced** per council convergence — manual edits and
  legacy entries without `ts_week` are accepted; back-fill is
  explicitly discouraged. Intake JSONL retains exact `ts:` for the
  pruning window. Defeats the session-context inference attack from
  Phase 1 council Round 2.
- [x] **B4 — Phase 2 council.** Two-round council
  (`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`) ran 2026-05-10
  against the Phase 2 question brief. Convergence summary in the
  decision log below; raw response transcript stays gitignored under
  `agents/council-responses/` (treat as session artifact, not source).

**Gate (legacy):** Phase 1 ships AND ≥ 100 curated entries exist in any
consumer project, OR `/memory:load` measured latency exceeds 1.5 s.
This gate originally guarded all of Phase 2; with B2/B3/B4 shipped, it
now governs only B1.

## Phase 3 — Second TranscriptAdapter implementation (cancelled-deferred)

**Status:** Cancelled in this roadmap 2026-05-10. Both gate
conditions remain unmet (zero consumer issues for non-Claude mining;
Phase 1 yield is currently unmeasurable since memory lives in a
sibling package, so the > 5 promoted/cycle signal is not observable
from this repo). The Phase 2 shipout council pass converged on
Option A (defer both B1 and Phase 3); marking the items `[-]` here
matches the council's "gate stays closed by default" framing.
A future roadmap reactivates this work when either gate fires.

- [-] **C1 — Pick the second host.** Cursor (JSON chat history) and
  Augment (chat-history hook) are the candidates. Pick from
  measured Phase 1 demand; do not speculate.
- [-] **C2 — Refactor adapter to interface.** Lift the adapter
  contract from documentation to actual Python (or shell) code with
  one implementation per host. Anthropic's "design from examples"
  rule: at least two implementations exist before the interface is
  extracted, not before.
- [-] **C3 — Cross-host smoke test.** Extend the Phase 1 fixture
  set with one fixture per supported host, asserting the adapter
  normalises both into the same intake JSONL shape.

**Gate (reactivation trigger):** ≥ 2 consumer projects file issues
requesting non-Claude mining, OR Phase 1 measured yield > 5 promoted
entries / cycle. When either fires, draft a new roadmap rather than
re-opening this one — the analysis context (`compare-dream-skill.md`)
and the `TranscriptAdapter` contract documented in the
`memory-consolidation` skill remain valid starting points.

## Decision log

- **2026-05-10 — Pattern-only adoption** confirmed via council. No
  source vendoring (Lens 1, no `LICENSE` file in `dream-skill`).
- **2026-05-10 — Auto-trigger rejected** for portability + autonomy
  + cost-blindness reasons (Lens 3 + council convergence).
- **2026-05-10 — `preferences.md` topic rejected** as user-attribute
  noise; project-scoped only (Lens 2).
- **2026-05-10 — Persistent settings flag replaced with per-invocation
  `--confirm-transcript-access`** per anthropic Round 2 + openai
  partial agreement.
- **2026-05-10 — Inline-review on `/memory:load`** replaces the
  manual-fallback adoption-rate problem. Per anthropic Round 2 New
  Point 1.
- **2026-05-10 — Multi-tag intake** chosen over a fifth schema
  `operational-patterns.yml`. Lighter, no contract drift. Per
  anthropic Round 2 New Point 1.
- **2026-05-10 — Phase 1 = Claude-Code-only** with documented
  `TranscriptAdapter` contract upfront. Splits the difference
  between anthropic ("design from examples") and openai ("design
  upfront"); the contract document costs ~half a day and prevents
  lock-in.
- **2026-05-10 — Add-ons D and E deferred to Phase 2.** Both
  members agreed they address hypothetical pain.
- **2026-05-10 — Temporal jitter adopted for Phase 2** (not
  Phase 1) to address the session-context inference attack from
  anthropic Round 2 New Point 2.
- **2026-05-10 — Phase 2 partial ship (B2 + B3 + B4, B1 deferred).**
  Re-triage flagged the original "all Phase 2 deferred" gate as
  over-coupled. B2 (priority field) is schema-additive and useful at
  any scale; B3 (temporal jitter) closes the Round 2 security finding
  and should not wait for the volume gate. B1 (index generator)
  remains gated on the original ≥ 100 entries / 1.5 s latency
  trigger; council Round 2 added that section-based density caps
  replace the line-cap when reactivated.
- **2026-05-10 — Three-tier `priority` enum (`critical | normal |
  low`).** Phase 2 council rejected a fourth `high` tier as
  contract drift. The three-tier set is the smallest enum that
  encodes "always surface", "query-matched", and "background only".
- **2026-05-10 — `priority` validator uses warnings, not hard caps.**
  Phase 2 council convergence: hard-block at >10 critical entries
  punishes legitimate domains (heavily regulated, high-tenant). Warn
  loudly, let the curator raise the threshold deliberately. Same
  rationale for the 90-day `critical-stale` warning.
- **2026-05-10 — `ts_week` is convention, not validator-enforced.**
  Phase 2 council split: anthropic wanted soft-required, openai
  flagged back-compat risk for legacy entries. Convergence: tooling
  writes it on every promotion; validator does not check; manual
  edits free to omit. Back-filling old entries explicitly discouraged
  (would re-introduce the inference signal jitter is meant to remove).
- **2026-05-10 — Phase 2 shipout: B1 + Phase 3 stay deferred.**
  Second council pass on the ship-vs-push-against-gate question.
  Both members converged on Option A. anthropic flagged that B1
  cannot ship even if the gate were ignored — the section-based
  density redesign is a known-wrong → unimplemented pivot, not just
  a "while we're here" speedup; shipping today would lock the
  rejected raw-line-cap design into consumer contracts. openai
  framed it as gate-integrity discipline: features designed by an
  earlier council pass keep their gate unless evidence contradicts
  the gate, not just the absence of demand. anthropic's open
  follow-up: Phase 3's gate is a two-condition OR including
  measured Phase 1 yield > 5 promoted entries / cycle; that
  condition is currently unmeasured (Phase 1 has zero curated
  entries in this repo since memory is in a sibling package), so
  the gate stays closed by default and gets revisited when the
  yield signal is observable.
- **2026-05-10 — Roadmap closure.** All gate-active scope shipped
  (Phase 1 via PR #81, Phase 2 partial via PR #82). Remaining items
  (B1 redesign + Phase 3) are flipped from `[ ]` to `[-]` so the
  dashboard archives this roadmap rather than carrying it forward
  with permanently-blocked checkboxes. Reactivation belongs to a
  new roadmap drafted under fresh evidence — not to a re-opened
  carcass of this one. Closure decision matches the two prior
  council convergences and adds no new design surface; no third
  council pass was run on the closure mechanic itself (would be a
  cheap re-ask of an already-converged question).

## Out-of-scope

- Vendoring any of `dream-skill`'s shell scripts or markdown body
  text. Patterns and procedure structure only.
- A `~/.claude/.dream-pending` flag-file mechanism or any
  background-subagent auto-spawn.
- Storing user names, IDE preferences, or any user-attribute fact
  in curated memory.
- Multi-host transcript mining in Phase 1 (deferred to Phase 3).
- Adding a fifth memory schema. Multi-tag intake is the
  resolution.
- Chasing upstream `dream-skill` for updates. Single commit, single
  author, no `LICENSE` — we treat it as inspiration, not as a
  dependency.

## Pinned references

- Compare doc: `agents/evidence/analysis/compare-dream-skill.md`
- Council brief: `agents/council-questions/dream-skill-adoption.md` <!-- council-ref-allowed: traceability for roadmap's adoption decisions -->
- Council responses: `agents/council-responses/dream-skill-adoption.json` <!-- council-ref-allowed: traceability for roadmap's adoption decisions -->
- Council convergence summary (inline): three external AIs reviewed
  the import — keep extraction-guard, redact user names, treat upstream
  as inspiration not dependency, ship as opt-in skill.
- Upstream skill: https://github.com/grandamenium/dream-skill
  (commit `228634143517906e3407ecec827890aaf70d5a97`, 2026-03-24,
  no `LICENSE`)
- Memory contract: `docs/contracts/agent-memory-contract.md`
- Memory data format: `docs/guidelines/agent-infra/engineering-memory-data-format.md`
- Cluster contract: `docs/contracts/command-clusters.md`
- Iron Laws relied on: `augment-portability`,
  `augment-source-of-truth`, `non-destructive-by-default`,
  `commit-policy`, `skill-quality`, `verify-before-complete`.

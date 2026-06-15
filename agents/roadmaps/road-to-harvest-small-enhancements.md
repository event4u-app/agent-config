---
complexity: lightweight
status: ready
---

# Roadmap: Competitive-harvest small enhancements + file-first pattern library

**Trigger:** Source-E competitive-harvest (2026-06-15). After filtering the external
reference (**Source-E**, § Provenance) against what AC already ships, a handful
of small, genuinely-additive ADAPTs remain — plus one REJECT the council
**reversed** (a file-first pattern library). The council was explicit: do NOT
"fold these into existing roadmaps" (that is the scope-creep trap where every
"3-hour" item becomes 3 days and the roadmap dies). Each is its own capped
milestone here, **scheduled after** `road-to-security-hardening` +
`road-to-mission-mode` land.

## Goal

Land the small Source-E harvest wins as discrete, ≤ ~1-week milestones with explicit
done-criteria — each reusing existing AC primitives, none introducing a runtime.

## Phase 1 — File-first pattern library (council-reversed ADOPT)

The council corrected an earlier REJECT: a static `patterns/` library is NOT the
sunset runtime memory store, and patterns are NOT personas (so the
`persona-governance` ≤2-cap does not apply). It is file-first, like `rules/`.

- [ ] `src/patterns/<slug>.md` shape: markdown + frontmatter
      (`applies_to`, `reliability`, `last_verified`) — reusable refactor/fix
      recipes (e.g. "N+1 fix in Eloquent"). Read at authoring time; no auto-write,
      no decay, no runtime.
- [ ] A skill (or extend `learning-to-rule-or-skill`) that surfaces relevant
      patterns when a related workflow fires.
- [ ] Manual `pattern-export` / `pattern-import` (developer script, NOT a user
      command) for cross-project sharing — respects
      `low-impact-corpus-privacy-floor`. Check `council-team-shared-memory`
      overlap first.
- [ ] Seed 3-5 patterns from existing AC knowledge; ADR for the new surface.

## Phase 2 — Project-analysis freshness loop

AC's `project-analyzer` output is richer than Source-E's codemaps but lacks a
cheap freshness signal (Source-E ADAPT — the discipline, not the script).

- [ ] Add a freshness header to each `agents/evidence/analysis/*.md`
      (`<!-- analyzed: <date> | commit: <sha> | files: N -->`).
- [ ] A small deterministic staleness probe (`git diff --stat <sha>..HEAD` over
      the analyzed paths) so the agent knows when a re-analysis high-tier pass is
      worth it. File-first, no runtime.

## Phase 3 — Observability + debugging ADAPTs

- [ ] MCP tool-schema token accounting in `audit_initial_context.py` (price MCP
      tool schemas ~per-tool, flag over-subscription) — fold into
      `road-to-capability-discoverability`'s existing `context-load-budget` item,
      not a new surface.
- [ ] Add Source-E's failure-pattern → cause → check lookup table
      (loop / 429 / ECONNREFUSED / file-missing) to `systematic-debugging`.

## Phase 4 — Eval + learning ADAPTs

- [ ] Cross-project-promotion **surfacing** in `skill-improvement-pipeline`:
      "same learning seen in ≥ 2 projects ⇒ surface for promotion" — a surfacing
      signal, NOT an auto-writer (the auto-write/decay store stays rejected,
      `council-agent-memory-sunset`).
- [ ] Add agent-X-vs-Y head-to-head + pass^k / pass@k reliability metrics to the
      bench harness — fold into the existing discipline-axis benchmark work, not
      a new harness.

## Phase 5 — Launch-readiness canary fragments

- [ ] Add Source-E's post-deploy verification fragments (SSE-heartbeat,
      static-asset content-type drift, LCP-delta) to the `launch-readiness`
      checklist — as checklist items, not an automated canary loop (the full
      canary is runtime → rejected).

## Phase 6 — Remove agent-memory from the public surface (user-flagged)

The user flagged agent-memory as MUST-remove; it aligns with the sunset of the
pgvector/MCP memory layer (`council-agent-memory-sunset`).

- [ ] Remove the `@event4u/agent-memory` install block + contract link from
      `README.md` (currently ~lines 303-309) and audit `docs/` / `AGENTS.md` for
      stale references; keep the file-based `agents/memory/` fallback wording.
- [ ] Decide the fate of `docs/contracts/agent-memory-contract.md` (archive or
      mark deprecated) + the experimental MCP-server doc reference; record in the
      same change. `check-refs` / `check-public-links` stay green.

---

## Acceptance criteria

- [ ] Each phase lands as its own change with explicit done-criteria; none
      expands into a parallel mega-effort (council scope-creep warning).
- [ ] Pattern library is file-first (no runtime), seeded, ADR-recorded.
- [ ] agent-memory removed from README + public docs; references green.
- [ ] Scheduled after `road-to-security-hardening` + `road-to-mission-mode`;
      not worked in parallel with them.

## Council notes (2026-06-15, deep + peer-review)

Council: do NOT "fold" these into existing roadmaps — "fold-in" hides the
scope-creep where six 3-hour items become a 3-month tail and the roadmap dies.
Make each a distinct capped milestone, sequenced last. The pattern-library
REJECT was **wrong and reversed**: a file-first `patterns/` dir (markdown +
frontmatter, like `rules/`) enables cross-project learning without the rejected
runtime store and is not persona-proliferation. All other harvest REJECTS
(continuous-learning auto-write store, agent-harness cron/dispatch, control-pane
SQLite runtime, knowledge-graph MCP, 33 per-language agents) stand.

## Provenance

- Source-E (external agent-harness reference, code-audited 2026-06-15;
  maintainer-recoverable via `src/scripts/_lib/link_crypto.py decrypt`):
  `ENC1:KPeL+ygg/jMY1GhTqv0giUX6ZODHZCJEHN6zxZh5VvLwnrNmfGwwhvXN3Pz/N69lIhLQBEojZTwbXkJ7nKW44Dfn1m3JBzimqNcQynvJa7icti4F53l+EWAGMawPzAg=`
- Evidence: gitignored harvest store (`agents/.harvest-local/source-e-findings/02-*`,
  `03-*`, `05-*`). Each ADAPT cites a specific Source-E mechanism cross-checked
  against AC's existing surface.
- Council: live two-member run (claude-sonnet-4-5 + gpt-4o, deep, peer-review,
  2026-06-15); convergence inlined above.

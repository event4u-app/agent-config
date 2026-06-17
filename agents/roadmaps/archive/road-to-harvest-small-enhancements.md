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

- [x] `src/patterns/<slug>.md` shape: markdown + frontmatter
      (`applies_to`, `reliability`, `last_verified`) — reusable refactor/fix
      recipes (e.g. "N+1 fix in Eloquent"). Read at authoring time; no auto-write,
      no decay, no runtime. <!-- src/patterns/README.md (contract); unregistered source root = reference library, not condensed/projected -->
- [x] A skill (or extend `learning-to-rule-or-skill`) that surfaces relevant
      patterns when a related workflow fires. <!-- extended learning-to-rule-or-skill: Decision matrix + § 4 fifth surface -->
- [x] Manual `pattern-export` / `pattern-import` (developer script, NOT a user
      command) for cross-project sharing — respects
      `low-impact-corpus-privacy-floor`. Check `council-team-shared-memory`
      overlap first. <!-- src/scripts/pattern_share.py: reuses the redactor (privacy classes), exempts long_code_excerpt (patterns are code recipes); overlap = governance only -->
- [x] Seed 3-5 patterns from existing AC knowledge; ADR for the new surface. <!-- 3 seeds (n-plus-one-eager-load, enum-switch-to-strategy, guard-clause-early-return) + ADR-099 -->


## Phase 2 — Project-analysis freshness loop

AC's `project-analyzer` output is richer than Source-E's codemaps but lacks a
cheap freshness signal (Source-E ADAPT — the discipline, not the script).

- [x] Add a freshness header to each `agents/evidence/analysis/*.md`
      (`<!-- analyzed: <date> | commit: <sha> | files: N -->`). <!-- 17 files stamped via analysis_freshness.py --stamp-all; README convention -->
- [x] A small deterministic staleness probe (`git diff --stat <sha>..HEAD` over
      the analyzed paths) so the agent knows when a re-analysis high-tier pass is
      worth it. File-first, no runtime. <!-- analysis_freshness.py --check; softened from 'deterministic' to a heuristic signal per council (a 1-line change can invalidate; not a gate) -->


## Phase 3 — Observability + debugging ADAPTs

- [-] MCP tool-schema token accounting in `audit_initial_context.py` (price MCP
      tool schemas ~per-tool, flag over-subscription) — fold into
      `road-to-capability-discoverability`'s existing `context-load-budget` item,
      not a new surface. <!-- moved to follow-up road-to-mcp-token-accounting.md (status: draft) — council: fold-in without an owner is a hidden deferral; gave it an open target + trigger. Not dropped. -->
- [x] Add Source-E's failure-pattern → cause → check lookup table
      (loop / 429 / ECONNREFUSED / file-missing) to `systematic-debugging`. <!-- file-first reference docs/guidelines/agent-infra/failure-signatures.md (NOT a hardcoded table, per council hill-to-die-on) + systematic-debugging pointer -->


## Phase 4 — Eval + learning ADAPTs

- [x] Cross-project-promotion **surfacing** in `skill-improvement-pipeline`:
      "same learning seen in ≥ 2 projects ⇒ surface for promotion" — a surfacing
      signal, NOT an auto-writer (the auto-write/decay store stays rejected,
      `council-agent-memory-sunset`). <!-- added to skill-improvement-pipeline Step 2 (Promotion Gate): surfacing-only block, no auto-write -->
- [-] Add agent-X-vs-Y head-to-head + pass^k / pass@k reliability metrics to the
      bench harness — fold into the existing discipline-axis benchmark work, not
      a new harness. <!-- moved to follow-up road-to-bench-headtohead-metrics.md (status: draft) — owner discipline-axis-benchmark is ARCHIVED; 'fold into archived' is nonsense (council), so trigger-gated on re-open. Not dropped. -->


## Phase 5 — Launch-readiness canary fragments

- [x] Add Source-E's post-deploy verification fragments (SSE-heartbeat,
      static-asset content-type drift, LCP-delta) to the `launch-readiness`
      checklist — as checklist items, not an automated canary loop (the full
      canary is runtime → rejected). <!-- launch-readiness § 4b — manual one-shot checks feeding the § 4 trip wires -->


## Phase 6 — Remove agent-memory from the public surface (user-flagged)

The user flagged agent-memory as MUST-remove; it aligns with the sunset of the
pgvector/MCP memory layer (`council-agent-memory-sunset`).

- [x] Remove the `@event4u/agent-memory` install block + contract link from
      `README.md` (currently ~lines 303-309) and audit `docs/` / `AGENTS.md` for
      stale references; keep the file-based `agents/memory/` fallback wording. <!-- removed README § "Optional: persistent agent memory"; file-based memory stays documented in docs/customization.md; ADR/CHANGELOG mentions are historical, kept -->
- [x] Decide the fate of `docs/contracts/agent-memory-contract.md` (archive or
      mark deprecated) + the experimental MCP-server doc reference; record in the
      same change. `check-refs` / `check-public-links` stay green. <!-- contract doc already removed by ADR-094 (moot); dangling README link removed with the block; docs/mcp-server.md kept (referenced from many other places) -->


---

## Acceptance criteria

- [x] Each phase lands as its own change with explicit done-criteria; none
      expands into a parallel mega-effort (council scope-creep warning). <!-- 1/2/3b/4a/5/6 shipped capped; 3a/4b deferred to draft follow-ups (council scope-cut) -->
- [x] Pattern library is file-first (no runtime), seeded, ADR-recorded. <!-- src/patterns/ + 3 seeds + ADR-099 -->
- [x] agent-memory removed from README + public docs; references green. <!-- README block removed; historical ADR/CHANGELOG mentions kept; check-refs verified -->
- [x] Scheduled after `road-to-security-hardening` + `road-to-mission-mode`;
      not worked in parallel with them. <!-- both landed (PRs #561/#564) before this -->


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

---
complexity: lightweight
execution:
  mode: autonomous
---

# Road to Knowledge System

> Ship the repo-tracked team-knowledge + self-learning layer by extending `agents/knowledge/` in place — typed lifecycle directories, one index, deterministic dedup/recurrence/pointer-degradation — per the 2026-07-05 council verdict.

## Goal

A consumer project gains a git-tracked, team-shared knowledge layer under `agents/knowledge/` (sessions / concepts / procedures / decisions beside the untouched knowledge-cards) with index-first retrieval, pre-commit sharing gates, and a capture→recur→propose→promote→pointer loop wired into the existing memory + skill-promotion pipeline — in ~500 LOC of TypeScript, zero runtime, zero breaking changes.

## Prerequisites

- [ ] Verdict context exists: `agents/settings/contexts/knowledge-system-verdict.md` (this roadmap encodes it; do not reopen B-vs-C)
- [ ] Existing surfaces confirmed at HEAD: `check_knowledge_cards.ts`, `knowledge_global*.ts` (ADR-100), `memory:*` commands + gitignored intake, `memory-consolidation` skill, `learning-to-rule-or-skill`, `skill-improvement-pipeline`, chat-history JSONL import

## Context

Maintainer goal: agent-config as "ultimate agent support" needs knowledge management for projects and teams plus a self-improving loop — global personal knowledge stays in the ADR-100 user-global store; project knowledge lives in the consumer repo so the whole team benefits. Ten external references were deep-read (2026-07-05); the council converged the design. Constraints that stand: file-first (Layer-2 sunset), gitignored intake + human-gated commit, no app runtime, TS-first deterministic backstops.

## Council notes (2026-07-05, three debates)

Members: anthropic/claude-sonnet-4-5 + openai/gpt-4o. Debate 1 split on architecture; tie-break round 1 converged 2/2 on **Option C — extend `agents/knowledge/` in place** (no `agents/wiki/`). Tie-break rebuttal round killed symlink migration (git symlinks break write paths in CI) → cards stay flat, untouched. Converged across rounds: index-first + grep retrieval with NO search infra; schema v1 = convention over configuration (optional warn-linted frontmatter); team gate = pre-commit lint only; self-learning = deterministic pieces into the existing pipeline; honest framing = human-gated learning support, not autonomous self-learning. Full verdict + REJECT list: `agents/settings/contexts/knowledge-system-verdict.md`.

Third debate (living-context capture, same members, 2 rounds) converged: **intake-first continuous capture** with a deterministic trigger taxonomy (`convention_detected` / `mistake_made` / `api_shape_learned` / `context_stale` — typed JSONL events), consolidated into tracked pages only at an explicit gate; **hybrid escape for live contradictions** — when `observed_value ≠ documented_value` fires mid-task, the agent proposes an immediate context fix that lands as its OWN commit chunk after this-turn user approval; declined → append-only `contested` annotation (with provenance: evidence file:line + session) and the fix waits for consolidation. Error repairs default project-local; global-store promotion only with cross-project evidence, manual. Bootstrap = deterministic static analysis wired from existing analyzers into TEMPLATE pages with `[HUMAN: verify]` markers — no LLM-invented claims, allowlist-scoped, never secrets/PII/transient state.

## Gap-table (KEEP / FOLD / CUT)

| Item (from sources) | Verdict | Where |
|---|---|---|
| Lifecycle-typed dirs (episodic/semantic/procedural/decisions) | KEEP | Phase 1 |
| Unified `INDEX.md` generator (one-liners, all knowledge surfaces) | KEEP | Phase 1 |
| Index-first + grep retrieval protocol | KEEP | Phase 1 |
| Dedup similarity check at propose time (≥0.80 merge / ≥0.40 warn) | KEEP | Phase 2 |
| Recurrence counter → `skill-candidates.md` (≥3 mentions) | KEEP | Phase 2 |
| `contested` / `review_after` / `scope` / `visibility` optional frontmatter (warn-lint) | KEEP | Phase 2 |
| Pre-commit share gate (intake/personal-path block + creation budget) | KEEP | Phase 3 |
| Pointer-degradation after promotion | KEEP | Phase 4 |
| NEW/EXTEND/CONFIRM/CONFLICT consolidation triage | FOLD | into `memory-consolidation` skill prose (Phase 2) |
| `date + what + why` entry micro-schema | FOLD | into knowledge/memory templates (Phase 1) |
| Draft-from-original-session-log guidance | FOLD | into `learning-to-rule-or-skill` (Phase 4) |
| 200-line page budget | FOLD | into the knowledge lint (Phase 2) |
| Typed in-flight observation events (deterministic trigger taxonomy) | KEEP | Phase 5 |
| `knowledge:consolidate` gate (intake → tracked pages, human-reviewed) | KEEP | Phase 5 |
| Hybrid immediate context-fix flow (this-turn approval, own commit chunk) | KEEP | Phase 5 |
| Append-only `contested` annotation with provenance on context faults | KEEP | Phase 5 |
| `knowledge:bootstrap` template generator (existing analyzers → staged pages) | KEEP | Phase 6 |
| Separate `agents/wiki/` layer | CUT | routing ambiguity, dual-run anti-pattern |
| SCHEMA-as-contract (mandatory fields, schema-driven linter) | CUT | deferred until team usage data exists |
| Vector / semantic search; transcript-RAG | CUT | Layer-2 sunset stands |
| Runtime policy engine; contradiction auto-resolution; `/memory share` command | CUT | see verdict REJECT list |

## Phase 1 — Substrate: typed dirs, one index, retrieval protocol

- [x] Add directory conventions for `agents/knowledge/{sessions,concepts,procedures,decisions}/` to the knowledge templates (`src/agent-src/templates/contexts/`), including the `date + what + why` entry micro-schema and page-shape guidance; existing cards stay flat and untouched
- [x] `src/scripts/generate_knowledge_index.ts` — scan cards + new typed dirs (+ optionally `agents/settings/contexts/`), emit `agents/knowledge/INDEX.md` with one line per page; idempotent, deterministic ordering
- [x] Document the retrieval protocol (read INDEX.md → grep → read specific files; never enumerate everything) in the `context-document`/`source-discovery` skill surfaces that own knowledge reads
- [x] Unit tests for the index generator (empty dirs, cards-only, mixed, stable ordering)

Exit criteria: generator produces a stable INDEX.md on this repo and on an empty fixture; templates document the four dir types; retrieval protocol referenced from at least one shipped skill.
Rollback: delete the generator + template additions; empty dirs are inert.

## Phase 2 — Capture hygiene: dedup, recurrence, optional frontmatter

- [x] Extend the memory propose path with a similarity check (token/Jaccard-based, TS, no embeddings): ≥0.80 → refuse-and-suggest-merge target; ≥0.40 → warn with nearest match; below → proceed
- [x] Extend `memory-consolidation` with a recurrence counter across session intake: ≥3 mentions of an unpromoted topic → append a candidate entry to `agents/knowledge/procedures/skill-candidates.md` (date, count, pointer to sessions)
- [x] Fold the NEW/EXTEND/CONFIRM/CONFLICT triage taxonomy into `memory-consolidation` skill prose (CONFLICT → write both positions + `contested: true`, human resolves)
- [x] Extend the knowledge lint (warn-only): optional frontmatter fields (`type`, `scope`, `visibility`, `review_after`, `contested`), 200-line page budget, stale `review_after` dates
- [x] Unit tests: similarity thresholds, recurrence counting, lint warn cases

Exit criteria: propose path demonstrably refuses a near-duplicate in a test fixture; consolidation run on a synthetic intake produces a skill-candidate entry; lint warns (never blocks) on the new fields.
Rollback: revert the propose/consolidation extensions; lint rules are warn-only and can be dropped independently.

## Phase 3 — Team-sharing gate

- [ ] `src/scripts/check_knowledge_sharing.ts` (pre-commit): block staged files from gitignored intake paths and from personal/global-store paths; warn on ≥5 new files under `agents/knowledge/` in one commit (creation budget)
- [ ] Register in the hook manifest + document the storage-location-is-policy contract (personal → ADR-100 global store; team → `agents/`) in the knowledge templates
- [ ] Negative tests: staged intake file blocks; 6 new knowledge files warn; normal card edit passes

Exit criteria: gate runs in pre-commit on this repo, all three test cases green once locally. <!-- carve-out: new-gate-verification -->
Rollback: unregister the hook; no data affected.

## Phase 4 — Self-learning wiring: promotion + pointer degradation

- [ ] `src/scripts/degrade_to_pointer.ts` — given a promoted artifact (skill/rule/guideline) and its source knowledge/memory entry, rewrite the source to a pointer stub (`Promoted to <artifact> on <date>; see <path>`) and regenerate INDEX.md
- [ ] Wire the step into `learning-to-rule-or-skill` + `skill-improvement-pipeline` checklists (promotion is not complete until the source is a pointer)
- [ ] Add draft-grounding guidance to `learning-to-rule-or-skill`: candidate drafts cite the original session log (chat-history), not the consolidated summary
- [ ] Unit test: degradation rewrites the entry, preserves frontmatter provenance, INDEX stays consistent

Exit criteria: one real skill-candidate walked end-to-end (candidate → promotion → pointer) on this repo; both promotion skills reference the step.
Rollback: pointer stubs retain provenance; restoring an entry is a git revert of that file.

## Phase 5 — Living-context capture + error-driven repair

- [ ] Define the typed observation-event schema (JSONL in the existing gitignored intake): `convention_detected` (pattern, evidence file:line refs, sample size), `mistake_made` (error category, followed context source, correction, recurrence key), `api_shape_learned` (endpoint, method, request/response shape, observed_at), `context_stale` (page path, expected vs actual, failing evidence)
- [ ] Fold the capture triggers into the owning skill surfaces as prose obligations (`memory-consolidation`, `source-discovery`, `systematic-debugging`, `project-analysis-*`): when a trigger condition is observed during normal work, append the typed event to intake — never write tracked pages mid-task by default
- [ ] `knowledge:consolidate` step/command: read typed intake events, aggregate by recurrence key, run the Phase-2 dedup check, propose tracked-page creates/updates as a reviewable batch (NEW/EXTEND/CONFIRM/CONFLICT), write only on approval, regenerate INDEX.md
- [ ] Hybrid immediate-fix flow (prose contract in the knowledge templates + `memory-consolidation`): on a live contradiction (`observed_value ≠ documented_value`, boolean — no confidence guessing), surface the proposed context fix with provenance; user approves this turn → fix lands as its OWN commit chunk (never mixed into the task diff); user declines → append `contested:` annotation (timestamp, trigger, evidence, session) to the page and emit a `context_stale` intake event
- [ ] `contested` annotation writer + lint: append-only array in frontmatter; lint warns when a page carries ≥2 unresolved contested entries (forces consolidation attention); resolution is always human
- [ ] Project-local vs global routing rule documented: repairs default to the project store; global-store (ADR-100) promotion only with cross-project evidence and via the existing manual promotion path
- [ ] Unit tests: event schema validation, consolidate aggregation, contested-append idempotence

Exit criteria: a synthetic session producing all four event types consolidates into correct page proposals; the contradiction flow demonstrably produces (a) an isolated commit chunk on approval and (b) a contested annotation on decline.
Rollback: triggers are prose + intake-only; disable by removing the consolidate command — tracked pages untouched.

## Phase 6 — Project familiarization bootstrap

- [ ] `knowledge:bootstrap` command: run the EXISTING deterministic analyzers (`project-analysis-*` structure detection, `standards-from-config`, `module-detect-on-the-fly`) and render their outputs into typed knowledge-page TEMPLATES (`concepts/structure.md`, `concepts/standards.md`, `concepts/modules.md`, `procedures/api-conventions.md`, empty `sessions/common-mistakes` seed) in a gitignored staging dir
- [ ] Template discipline: detected facts carry evidence pointers; anything inferential carries a `[HUMAN: verify]` marker; no LLM-invented claims — deterministic static analysis only
- [ ] Capture allowlist + exclusion scan: allowlisted fact classes only (layout, entry points, naming conventions, export/API maps); hard-exclude secrets (existing secret patterns), personal data, transient state (build artifacts, paths under ignored dirs, timestamps beyond `observed_at`)
- [ ] Review-then-commit flow: bootstrap ends with a review instruction; pages move from staging into `agents/knowledge/` only after human review (reuses the Phase-3 share gate + INDEX regen)
- [ ] Run bootstrap once against a fixture project in tests (deterministic output snapshot)

Exit criteria: bootstrap on the fixture yields staged templates that pass the exclusion scan and the knowledge lint; nothing lands tracked without the review step.
Rollback: delete staging output; command is additive.

## Acceptance criteria

- [ ] All new scripts are TypeScript, deterministic, runtime-free; tests green once locally on introduction
- [ ] Zero changes to existing knowledge-card paths, `check_knowledge_cards.ts` behavior, or ADR-100 global-store scripts
- [ ] Anti-dump litmus: every new artifact fills a verified gap from the gap-table; no new artifact duplicates an existing skill/command/lint; new prose folds into existing skills (`memory-consolidation`, `learning-to-rule-or-skill`) instead of spawning parallel ones
- [ ] Governance preflight: no new domain opened (`domain-adoption-policy` — within existing memory/knowledge surfaces); no new personas; framework-neutral; all files within size budgets
- [ ] REJECT list from the verdict context remains intact (no wiki layer, no search infra, no mandatory schema, no auto-resolution) — plus the living-context additions: no mid-task tracked writes without this-turn approval, no auto-committed bootstrap output, no LLM-invented claims in bootstrap templates, session-boundary is not the SOLE gate (immediate-approval path exists)
- [ ] Context faults are never silently repaired: every repair carries provenance (what failed, evidence, session) either in the contested annotation or the isolated fix commit

## Provenance

Ten external references deep-read 2026-07-05 (trees + key files, not READMEs); named here by neutral descriptor, real links retained encrypted:

- Source A — public "LLM-maintained wiki" pattern note (substrate: raw/typed-pages/schema, index-first, lint op): `ENC1:/qClIVsR5A/r0/GXdZYfHBBZZ2x6gvxl6Ij1FWDi1P2sd1GkrWEoOvzIwtU+DPxnqM7HOn2oXtZAIrxnPipC4/b8+YzpWxDJzQIThrO4UqSdBiYGdCELF1drKvVX7gJPaXdUw0cgwnTj/gZlK7BK7jJP9+Q0nrsG+DZvB/R1JYE/`
- Source B — plugin-marketplace knowledge-management plugin (schema-as-contract, contested-frontmatter, ingest triage): `ENC1:N4t+kRg0s6Lw/5x5FIavekgfoiZGeJ1PANmiDVGCJ/hgar63lIXmP5A5LvHXL1llEhJ70G6ugzGwuvG8S9zbw1XXEyjO7vvJgUoTafdrGoFhXdRtvGVlXNQ3kKIl0L3nGmi83peS/P6q3gSv/gy1kQqgy5LPJ9DZmoqyvX8YWP0Kt5KWS0W6g9nh8Q==`
- Source C — local personal-memory runtime (scope×visibility axes, review_after/expires_at, share-readiness gate): `ENC1:bMeDjTUfZ2W8SBNJZZpMlo+bDhpznfi0y77JHji0pFjmbkn6JaDtwfyqVoRD9S7GRJZcAhV41vU85b94Q4YEXX9z5z6eb6JW86aWQZF0dVI7b0G1HYsXc7UxYMddem/RCVF/`
- Source D — research-lifecycle wiki platform (dedup thresholds, creation budgets, writers-policy-as-spec): `ENC1:GxUBWIQWgIQoethY5BrEV36ACWpP+ngiG6LGceWcHracjp4/9mUUZQoEv7LhCkB02tF5OBpA7ytK/FWnqb50iGpGOJ7TXb5dQpI1xTG4TbtZkcXAreB37G4ajCr1Fu2uo7bVRw==`
- Source E — markdown-first agent memory with rebuildable shadow index (episodic/semantic/procedural split, skills-from-memory): `ENC1:lgkHaO2Df3lq/1s+WOQC7ic+klDfQG3DrsnTm3DMRzyL7bSEctwBArx0ECaXnVhEZCB2DTgFyjYzC7EgRsW+2qJXYu76qFVzBc4OHe7Z1usDZjsTKf/pukb53vFssVyMdNIqNB43OQ==`
- Source F — verbatim-recall memory palace (tiny-index validation, invalidate-then-add supersession; storage rejected): `ENC1:oAGhis10pW/Gbe4detxfvfK6kbQZI0QSoiSW7pqalbTJOOC0HoC4wSILeeVfGA3TTyYr/KfjSjJMbbONIMQbToiN/qowFYJE18snXVX274c3WVLlmTQ4Ojnh7ibTZRDI2ELCJsuz`
- Source G — vault-based knowledge plugin (hot-cache + lock patterns; analyzed separately): `ENC1:n1x7tOuoS5F0pWXRVCMKzbnLMduUV5C6npg1/K/i53CWbT1c5faHj+QFljXoLIky3eTudGfCu2wJknRH0OazDZJbsFOTJNu5Tm7AD/Hh/t55iQ/c8cCQ42DGt65HoUJ2DybqzjtkMo1B3VEcdCoF`
- Source H — engineering-kernel skill with per-goal checkpoint vault: `ENC1:EExLYRxxa7YTGKz7iRrCLf1S0oMzlKB5mJhjXEjFpDUg1pb+9EUemAdgpB0aNWRBVyrCmBGHV6fdHxMVkrwgTdWic1XCd2TRGrGO7YXoOwhYMCY8UXLNghTPeCw8NtlTHxUlLrUZq1+V67lmB+q7z6JuVOSrn9iUTITcj5B1dqqL`
- Source I — practitioner memory-workflow notes (staging→promotion→pointer, rules-vs-content separation): `ENC1:I+cOdPuLZfKjntb8NkkmB50xgpD1w/rAIisezYPIdwRiavaUbsG08xPd4pshHYopD6ZF328ZLKbgpbGRxihqpaYxBtWal88ONGhPYDbFjR3b5fvbkgok5ExpBd33UDuaQ+5v1mLlbPsUrAuH` · `ENC1:5bi8h+UF5bvTjStVTW7TBDUH/uXgQJYnkJWe2j8iLFen+6+u2z/uapWVQxcDqyTQaWmrrPJm8imKxKwB6ZMQb2LvEW6LAL2IGm9XSpXEDkAaEebjjusfLr9ZiZ9r4P/A2DLCMi6yPR2aZHbk0YD22E56e5/vZcV9sfMMoeckySiDg+zSnqwEclXE`
- Source J — community session-memory guide (two-tier session log, over-structuring dissent): `ENC1:cVQe1qqNFST70brr7d7FxcRK1tXmNhuS9yJElBnsw19ZnHhXgWdTs1FhMJgJPgOjp2aqw1fv2bm6MueQsY7HOGTGdSln02XK7+1Kyv6xFfQw8pWvuN21/DI1rUz6UyPopL7D9ygdKzEZKSqXvigJiH4a23BOn7D9XIn54gb03zZcsG2vdpl3Tw/cwu95CPv13UxlJtszJwn/zAoaUMy6Q5E=`

# Knowledge-management + self-learning system — verdict: extend `agents/knowledge/` in place

**Decision (2026-07-05).** The package's knowledge-management and self-learning
layer is built by **extending `agents/knowledge/` in place** (council Option C).
There is **no separate `agents/wiki/`**, no search infrastructure, and no
runtime component. All writes stay human-gated; deterministic TypeScript
scripts (dedup, index generation, pre-commit lint) are the enforcement
backstops. Executable plan: `agents/roadmaps/archive/road-to-knowledge-system.md`.

Council: claude-sonnet-4-5 + openai/gpt-4o, 2026-07-05, two debates × two
rounds (~$0.29). Debate 1 split on architecture (C vs B); the focused
tie-break round converged 2/2 on Option C. The tie-break's adversarial
rebuttal round contributed one substantive correction that is folded into the
verdict: **no symlink-based migration** (git symlinks break write paths in
CI), therefore existing knowledge-cards are not moved at all.

## The verdict, point by point

1. **Architecture — one namespace.** Existing knowledge-cards stay flat and
   untouched at `agents/knowledge/<source>.md` (ADR-100 global-store scripts
   and `check_knowledge_cards.ts` keep working unchanged). New
   lifecycle-typed sibling directories are added beside them:
   - `sessions/` — episodic (consolidated session learnings)
   - `concepts/` — semantic (entities, domain facts, project truths)
   - `procedures/` — procedural (how-to knowledge on its way to skills)
   - `decisions/` — decision records not big enough for an ADR
   ONE `INDEX.md`, ONE schema/conventions doc, ONE dedup namespace, ONE
   retrieval path. A parallel `agents/wiki/` was rejected: permanent routing
   ambiguity at the capture boundary (every fact would need classification
   across two competing stores), dual index/schema/linter surface, and the
   classic dual-run migration anti-pattern.

2. **Global vs project — storage location IS the sharing policy.** Personal
   knowledge goes to the user-global store (ADR-100 promotion/redaction path);
   team knowledge lives in the consumer repo under `agents/`. Session intake
   stays gitignored; committed knowledge is human-gated (2026-06-14
   team-shared-memory council stands). No personal-attribute layer in the
   repo, ever.

3. **Schema v1 — convention over configuration.** Frontmatter fields `type`,
   `scope: user|project|global`, `visibility: private|project|team`,
   `review_after`, `contested` are documented and OPTIONAL, warn-linted only.
   Full SCHEMA-as-contract (mandatory fields, schema-driven linter) is
   deferred until real team usage data exists. Entry micro-schema for session
   learnings: `date + what + why`.

4. **Team-sharing gate — pre-commit lint, no mandatory command.** The lint
   blocks commits of gitignored-intake files and personal-store paths, and
   warns on ≥5 new knowledge files in one commit (creation budget). No
   `/memory share` command.

5. **Self-learning loop — deterministic pieces wired into the EXISTING
   pipeline.** Similarity/dedup check at propose time (thresholds: ≥0.80
   merge, ≥0.40 warn-and-review; rationale: over-merging is cheap to undo,
   over-creating silently poisons downstream consumers). Recurrence counter
   in consolidation (≥3 mentions → `skill-candidates.md` entry). After
   promotion via `learning-to-rule-or-skill` / `skill-improvement-pipeline`,
   the source knowledge entry is **degraded to a pointer** (staging →
   promotion → pointer; prevents double-maintenance). Drafts are grounded in
   original session logs (chat-history), not in summaries — as prose
   guidance, without any RAG machinery.

6. **Retrieval — index-first + grep, nothing else.** `INDEX.md` carries one
   line per page (auto-generated); agents read the index first, then grep,
   then read specific files. Vector/semantic search stays explicitly out of
   scope (the 2026-06-14 agent-memory Layer-2 sunset stands; revival requires
   deployment + funding).

## Addendum (2026-07-05, third debate) — living-context capture + error-driven repair

Same members, two rounds. Extends the verdict with the continuous-learning
requirement (agent builds committable context WHILE working; context faults
trigger learning):

7. **In-flight capture is intake-first.** During normal task work,
   observations land as typed JSONL events in the existing gitignored intake
   — `convention_detected`, `mistake_made`, `api_shape_learned`,
   `context_stale` — fired by deterministic trigger conditions in the owning
   skills, never by vibes. Tracked pages are written only at an explicit
   gate (`team-knowledge:consolidate` / session-end memory flow) as a reviewable
   batch. This keeps `minimal-safe-diff` intact (task diffs stay
   task-scoped) and honors the Evidence-v2 kill (no auto-accumulating
   tracked store).

8. **Hybrid escape for live contradictions.** When the agent detects
   `observed_value ≠ documented_value` mid-task (boolean trigger), it may
   propose an immediate context fix: with this-turn user approval the fix
   lands as its OWN commit chunk (never mixed into the task diff); declined
   → an append-only `contested:` annotation with provenance (evidence
   file:line, session) goes on the page and the fix waits for consolidation.
   The agent never keeps working against known-bad context silently, and
   never silently rewrites tracked context either.

9. **Repair routing.** Context repairs default to the project store; the
   user-global store (ADR-100) is touched only with cross-project evidence
   via the existing manual promotion path. Every repair carries provenance.

10. **Bootstrap.** `team-knowledge:bootstrap` wires the EXISTING deterministic
    analyzers (project-analysis structure detection, standards-from-config,
    module detection) into typed knowledge-page TEMPLATES in gitignored
    staging — detected facts with evidence pointers, inferences marked
    `[HUMAN: verify]`, allowlist-scoped, hard-excluding secrets/PII/transient
    state. Human reviews, then commits. No LLM-invented claims.

REJECT additions from this round: mid-task tracked context writes without
this-turn approval; auto-committed bootstrap output; LLM interpretation in
bootstrap templates; treating the session boundary as the SOLE gate (the
immediate-approval path must exist); auto-resolving contested entries.

**Execution-time naming correction (2026-07-05, road-to-knowledge-system
Phase 5):** the command names above were revised from `knowledge:*` to
`team-knowledge:*` after discovering the pre-existing `/knowledge` cluster
(local file ingestion into `agents/memory/knowledge/` — an unrelated
concern). This is an implementation-naming detail, not a reopening of
this verdict.

## REJECT list (do not relitigate)

- Separate `agents/wiki/` layer (routing ambiguity, dual-run anti-pattern).
- SCHEMA-as-contract in v1 (schema drift across a team with gitignored
  intake; premature without usage data).
- Vector / semantic / fuzzy search of any kind.
- Runtime policy engine or background jobs for knowledge maintenance.
- Automatic contradiction resolution — every surveyed implementation
  surfaces both positions (`contested: true`) and defers to the human.
- Transcript-RAG for drafting (needs the sunset infra).
- Symlink-based card migration (breaks write paths in CI).
- Personal-attribute layer in the repo.

## Honest framing (both council members, independently)

The biggest risk is scope creep disguised as "self-learning". v1 ships
**human-gated learning support** (~500 LOC of deterministic tooling around
existing memory/knowledge surfaces), not autonomous self-learning. True
autonomy would require the sunset Layer-2 infrastructure; if that is ever
wanted, the honest path is reviving Layer 2 with funding — not smuggling
search infra into this layer.

## Related decisions

- 2026-06-14 agent-memory Layer-2 sunset (file-first Layer 1 kept).
- 2026-06-14 team-shared memory (gitignored intake, human-gated commit,
  narrow types, no personal layer).
- 2026-06-16 Evidence-v2 accumulation killed (no auto-accumulating store).
- 2026-06-14 chat-history consolidation (one JSONL log + one mine path).

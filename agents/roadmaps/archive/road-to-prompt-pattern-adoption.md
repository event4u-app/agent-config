---
complexity: lightweight
execution:
  mode: autonomous
---

# Road to prompt pattern adoption

> Fold the verified gaps from publicly documented frontier-host system-prompt material into existing artifacts: a content-quoting floor, memory-application etiquette, a volatile-fact freshness table, and four micro-sharpenings — plus one evidence-gated pilot for contextual reminder injection.

## Goal

Close 3 real coverage gaps (quoting floor, memory etiquette, freshness discipline) with minimal new surface (1 new rule, rest folded into existing artifacts), land 4 one-paragraph sharpenings in existing rules/contexts, and record — without building — an evidence-gated design for hook-injected contextual reminders.

## Provenance

- **Source A** — consumer-surface system prompt of a frontier host (~188 KB): memory etiquette, search-decision criteria, copyright hard limits, formatting calibration, fake-authority handling.
- **Source B** — the same host's coding-agent harness prompt (~95 KB): outcome-first communication, end-of-turn checkpoint, code-comment discipline, inspect-target-before-delete, faithful outcome reporting.
- **Source C** — runtime reminder-injection notes (~10 KB): contextual pre-message reminders (`image / cyber / ethics / ip / long-conversation` classes), discretionary rather than blocking.
- **Source D** — a third-party analysis article: structure ratios (55 % tool/capability specs vs 17 % behavior), identity-last ordering, "odd-specific rules are shipped incident fixes".

Deep-dive per `external-reference-deep-dive`: directory trees + raw files fetched (not README-level); Sources A–C extracted with verbatim-quote passes. Raw evidence stays local-only.

Retained links (maintainer-recoverable):
`ENC1:kisxFy41YutF9aXkHm6v5iHzXdbDl7sRDCUDkNZL9Ip6KyQ93sZcJZIaDX/iGLnr8OcyodIycdqFx2wMm396ZQ==`
`ENC1:9id0mRK2kZLjnOXrtL/G0xBhkrhnmEP8kxF2Y+Pm4h+lR3kZLlXy9ywUIuC9dbTkmizD+cUd0Gjufml/mtMusQ==`

## Disposition summary

| Pattern (source) | Verdict | Where |
|---|---|---|
| Quote budget: ≤15 words/quote, one quote per source, no complete short works, paraphrase-default (A) | **adopt** | Phase 1 — new rule + wiring |
| Memory-application etiquette: selective use, no meta-narration phrases, sensitivity floor (A) | **adopt** | Phase 2 |
| Retrieval-trigger linguistics: possessives / definite references / past-time cues → consult memory (A) | **adapt** | Phase 2 |
| Volatile-fact freshness criteria: which fact classes demand a fresh lookup (A) | **adapt** | Phase 3 — generalizes the existing git-live-state clause |
| Bullet floor (1–2 full sentences per bullet) + never bullets when declining (A) | **adopt** | Phase 4 |
| Inspect target before delete/overwrite; surface contradictions (B) | **adopt** | Phase 4 |
| Code comments state constraints only, never reviewer-directed justification (B) | **adopt** | Phase 4 |
| End-of-turn checkpoint: last paragraph must not be an unexecuted promise (B) | **adapt** | Phase 4 — one clause in autonomous-execution context |
| Contextual reminder injection via hooks (C) | **build-to-measure** (council 2026-07-06) | Phase 5 — flag-gated apparatus + pre-registered A/B |
| Outcome-first communication, faithful reporting (B) | already — `direct-answers`, `verify-before-complete` |
| Reversible-vs-destructive autonomy split (B) | already — `autonomous-execution`, `non-destructive-by-default` |
| Fake-authority / embedded-instruction caution (A) | already — `untrusted-input-defense`, `security-sensitive-stop` |
| Named injection patterns in instructions (D) | already — `untrusted-input-defense` |
| Incident-fix rules pattern (D) | already — `learning-to-rule-or-skill`, memory incident-learnings |
| Budget ratio: capability specs over personality (D) | already — kernel/router + token-saving measurement track |
| Identity-last ordering (D) | **reject** — thin-root AGENTS.md already operational-first; no measurable lever |
| Consumer wellbeing/crisis routing (A) | **reject** — consumer-surface concern; `domain-safety-*` covers our advisory floors |

## Phase 1 — Content-quoting floor

The one genuine legal-adjacent gap: no artifact in the suite constrains quoting from external sources. Ghostwriter, research, release-comms, and content skills can currently emit unbounded verbatim excerpts.

- [x] Author `src/rules/content-quoting-floor.md` (auto rule, triggers: write/draft/research/summarize surfaces): ≤15 words per verbatim quote, one quote per source per deliverable, never reproduce complete short works (lyrics, poems) regardless of brevity, paraphrase-default, no displacive summaries that substitute for the source. Include a failure-mode list and a carve-out for user-owned/user-supplied text and license-permitted vendored content.
- [x] Run the artifact overlap scan (per `artifact-drafting-protocol` Phase B) against `domain-safety-disclaimer`, `untrusted-input-defense`, and the write-engine contract; record extend-vs-create verdict inline in the rule's See-also. <!-- done: no existing artifact caps quote length/count — verdict CREATE -->
- [x] Wire the floor into consuming surfaces: `ghostwriter` command cluster (write-engine contract note), `research:deep` / `research:report`, `deep-reading-analyst`, `release-comms`, `content-funnel-design` — one See-also/obligation line each, no restated body. <!-- done: 4 of 5 wired (write-engine, research:deep, research:report, deep-reading-analyst [extended existing verbatim-copy line], release-comms); content-funnel-design has no external-source-quoting surface on inspection — skipped rather than forcing an artificial edit -->
- [x] Verify: `./scripts-run src/scripts/validate_frontmatter` on the new rule + `./scripts-run src/scripts/check_refs` targeted at touched files. <!-- done: 388 artefacts 0 failing; no broken references -->

## Phase 2 — Memory-application etiquette

The suite defines how memories are written (memory-consolidation, knowledge pipeline) but not how recalled content is *used* in replies. Source A's etiquette closes that.

- [x] Add an "Applying recalled memories" section to `src/skills/memory-consolidation/SKILL.md`: apply selectively and contextually; never narrate the mechanism (forbidden phrases: "I remember", "based on your memories", "according to your profile/data", "I can see from memory"); recalled facts surface as normal working knowledge.
- [x] Add the sensitivity floor to the same section: recalled content about sensitive topics (personal difficulties, conflicts, health) is never surfaced unprompted — only when the user raises the topic first this session.
- [x] Add retrieval-trigger linguistics to `memory:load` / `knowledge` retrieval guidance: possessives ("my/our X"), definite references to unnamed prior work ("that bug", "the migration"), and past-time cues ("last week", "back then") are consult-memory signals before answering from scratch.
- [x] Cross-link the existing staleness caveat (recalled memories reflect what was true when written; verify files/flags still exist) so etiquette and staleness live in one place.
- [x] Verify: `./scripts-run src/scripts/skill_linter` on the touched skill.

## Phase 3 — Volatile-fact freshness table

`direct-answers` Iron Law 2 already forbids live git/PR state from memory. Source A generalizes this into a fact-class table worth adopting for research and non-git surfaces.

- [x] Extend the `direct-answers` mechanics doc (`asking-and-brevity-examples` or the severity-tier section) with a freshness table: **fresh-lookup classes** — current roles/status of people/orgs, prices/versions/quotas, laws & policies, unrecognized entities (tools, packages, products), binary events (releases, deprecations, incidents); **stable classes** — math/CS fundamentals, historical facts, language/framework basics pinned by the project's lockfiles.
- [x] Wire the table into `research:deep` / `research:report` pre-flight and `deep-reading-analyst` (one pointer line each): claims in fresh-lookup classes require a cited live source, never model memory.
- [x] Verify: `./scripts-run src/scripts/check_refs` on touched files.

## Phase 4 — Micro-sharpenings (folds only, no new files)

- [x] `user-interaction-mechanics` + `direct-answers` examples: add the bullet floor (each bullet a complete 1–2-sentence statement, never fragments-as-lists) and "never bullet-point a refusal/decline — declines are short prose".
- [x] `destructive-mechanics` context: add the inspect-before-destroy clause — before deleting or overwriting, look at the target; if its contents contradict how it was described, or the agent didn't create it, surface instead of proceeding.
- [x] Coding guidelines (PHP + TS pattern docs): add the comment discipline clause — a comment states a constraint the code cannot show; never provenance, never next-line narration, never change-justification aimed at the reviewer.
- [x] `autonomous-execution` mechanics context: add the end-of-turn checkpoint — if the reply's last paragraph is a plan, an open question the context already answers, or a promise of unexecuted work ("I'll…"), execute it before ending the turn (bounded by the N=3 budget and Hard Floor as-is).
- [x] Run `/condense`-path verification on every touched rule (preservation-guard: Iron Law sections byte-stable) — `./scripts-run src/scripts/check_condensation` targeted.

## Phase 5 — Contextual reminder injection (build-to-measure, per council verdict)

Source C's mechanism — small, contextual, discretionary pre-message reminders instead of always-loaded prose — is architecturally aligned with kernel/router. Council re-evaluation (2026-07-06, tie-break after a round-2 split) converged on **build-to-measure**: the 2026-06-25 honest-null tested blocking projections (a ceiling, not a floor) and does not transfer to the salience regime. Pre-registered experiment design + scope + revisit-if: `agents/settings/contexts/reminder-injection-verdict.md`.

- [x] Re-evaluate the 2026-06-25 lock in the AI council; record the convergence with scope + revisit-if. <!-- done 2026-07-06: verdict (b') build-to-measure, promoted to agents/settings/contexts/reminder-injection-verdict.md; design-note step superseded by the verdict file -->
- [x] Build the minimal injection apparatus: a default-off, flag-gated hook path (PreToolUse/PostToolUse) that injects a one-line tier-2 reminder for the three initial trigger classes (token-distance > ~3K behind the decision, weak-host long session, high-stakes turn) plus the random-reminder negative-control arm. Eval instrument only — no production default.
- [x] Author the pressure corpus (long-session + weak-host arms, n≈50 per arm) and wire the three-arm A/B (kernel-only · kernel+targeted · kernel+random) against the pre-registered thresholds (≥8 pp → expand, still flag-gated · <5 pp → teardown, pre-committed · 5–8 pp → one extension run).
- [x] Run the A/B on the CURRENT kernel schema (no concurrent kernel-salience rewrites or brevity changes — they contaminate the independent variable), record the readout in `reminder-injection-verdict.md`, and execute the pre-committed consequence (expand flag-gated, or tear down).

## Acceptance criteria

- One new rule (`content-quoting-floor`), zero other new files outside the Phase 5 apparatus (flag-gated hook path + pressure corpus) and its verdict/readout context note; everything else folded into existing artifacts.
- All touched artifacts pass the targeted linters cited per phase; remote CI on the PR is the authoritative full gate.
- No tracked artifact names the external sources; links remain ENC1-only.

<!-- ## Blockers — no gates; Phases 2–4 are agent-executable. Phase 5
(contextual reminder injection) is flag-gated per the 2026-07-06 council
verdict and proceeds autonomously once the apparatus is built (no external
approval gate required — the pre-committed A/B thresholds are the decision
criteria). -->

---
complexity: lightweight
---

# Road to execution-discipline harvest

> Fold the agent-execution and prompt-engineering-architecture mechanisms harvested from frontier-host system prompts into existing rules/guidelines — a no-time-estimates rule, an amend-after-hook-failure git trap, a tool-tier ladder, a disconfirmation-search gate, a never-cite-the-rule clause, an anti-over-engineering fold, and two authoring guidelines (tool-description-as-policy + emphasis budget) — with zero corpus vendoring and no blocking linter.

## Goal

Close 6 real execution-discipline gaps (time-estimates, amend-trap, tool-tier fallthrough, disconfirmation search, rule-citation UX, over-engineering) with minimal new surface (1 new small rule, rest folded into existing artifacts), and land 2 authoring guidelines (tool-description-as-policy, emphasis budget) — the emphasis budget as a **soft authoring guideline, never a merge-blocking linter** per the council convergence below.

## Prerequisites

- [x] Read `AGENTS.md`, `CLAUDE.md`, and the kernel/router contracts (`docs/contracts/kernel-membership.md`, `docs/contracts/rule-router.md`).
- [x] Read `src/rules/git-history-discipline.md`, `src/rules/minimal-safe-diff.md`, `src/rules/direct-answers.md`, `src/rules/output-discipline.md`, and the `skill-writing` / `command-writing` / `mcp-builder` skills before editing.

## Context

- Extends the shipped consumer-prompt harvest (`agents/roadmaps/archive/road-to-prompt-pattern-adoption.md`) with the execution/architecture layer that harvest did not cover.
- Source of truth is `src/`; every edit condenses via `/condense`; remote CI is the authoritative gate (`quality.local_auto_run: false`).

## Phase 1 — No-time-estimates rule

The one clean gap with nothing adjacent in the suite. An LLM has no wall-clock and no latency training signal; fabricated schedules ("this will take 2–3 weeks") are confident nonsense.

- [x] Add a one-paragraph "No duration estimates" clause to `src/rules/direct-answers.md` (Iron Law 2 family — invented facts): never predict how long the agent's own work will take, nor how long the user's work will take; break work into actionable steps and let the user judge timing. Keep it to a constraint + the one-line rationale (no clock, no latency signal).
      <!-- done: landed on main via PR #849 (re-land of the lost #844 kernel content) — direct-answers Iron-Law-2 pointer names "no duration estimates"; the detail (agent-work + user-work + step-list-not-schedule) lives in the companion guideline asking-and-brevity-examples § No duration estimates. Verified present on origin/main. -->
- [x] Run the artifact overlap scan against `output-discipline`, `verify-before-complete`, and `direct-answers` per `artifact-drafting-protocol` Phase B; record the extend-vs-create verdict inline in the See-also (expected: fold into `direct-answers`, not a new file).
      <!-- done: overlap-scan verdict = EXTEND direct-answers (Iron Law 2 family), NOT a new file. output-discipline governs placeholder-prose in emitted code (not duration claims); verify-before-complete governs completion evidence (not estimates); neither covers duration-estimate invention → direct-answers is the correct home. Realized by #849 (pointer + companion detail, budget-neutral). -->
- [x] Verify: `./scripts-run src/scripts/validate_frontmatter` + targeted `./scripts-run src/scripts/check_refs`.
      <!-- done 2026-07-10: validate_frontmatter (399 artefacts, 0 failing) + check_references (no broken refs) green. -->

**Exit criteria:** the no-estimates constraint is live in `direct-answers` with a rationale line; no new always-on file added.
**Rollback:** revert the `direct-answers` hunk (single paragraph).

## Phase 2 — Amend-after-hook-failure git trap

A precise, high-severity data-loss mechanism missing from `git-history-discipline`: when a pre-commit hook fails, the commit did NOT happen — a subsequent `git commit --amend` rewrites the *previous* (already-good) commit, destroying work. Fix, re-stage, create a NEW commit.

- [x] Add the trap to `src/rules/git-history-discipline.md` as one clause under the existing amend restrictions: name the mechanism (hook failure ⇒ no commit created ⇒ amend targets the wrong commit) and the correct recovery (fix → re-stage → new commit, never amend).
- [x] Cross-link `skill:git-workflow` (recovery procedures) so the mechanism lives next to the how-to.
- [x] Verify: `./scripts-run src/scripts/check_condensation` targeted at the touched rule (preservation-guard: Iron Law sections byte-stable).

**Exit criteria:** the trap is documented in `git-history-discipline` with the recovery sequence.
**Rollback:** revert the single clause.

## Phase 3 — Tool-tier ladder + no-silent-fallthrough

Frontier surfaces encode a tool-selection ladder (dedicated tool > generic > lowest-level) with an anti-fallthrough clause: a dedicated tool erroring means debug/report, never silently retry via a slower/broader tier (silent degradation masks real failures). We cover subagent orchestration but not tool-selection failure discipline.

- [x] Author a short section in the `mcp` skill (or `token-optimizer` if the tool-selection surface fits better — decide during the overlap scan): pick the most specific available tool; a specific tool's error is a signal to debug/report, not to silently fall back to a broader tool; the broader tier is for *unavailability*, not *error recovery*.
- [x] Cross-link `subagent-orchestration` (which owns delegation, not tool-tier selection) so the boundary is explicit.
- [x] Verify: `./scripts-run src/scripts/skill_linter` on the touched skill.

**Exit criteria:** tool-tier ladder + no-silent-fallthrough documented in one skill with a clear boundary vs subagent-orchestration.
**Rollback:** revert the skill section.

## Phase 4 — Disconfirmation search + per-part grounding (research quality)

The more-advanced frontier search doctrine adds two research-quality gates absent from our verify family: (a) **disconfirmation** — run searches to rule alternatives *in or out*, not only to gather support for the favored hypothesis (confirmation-bias countermeasure); (b) **per-part grounding** — before writing, check each part of the request against what was actually retrieved.

- [x] Fold both gates into the `research:deep` / `research:report` pre-write step and `deep-reading-analyst` (one pointer line each): a claim is not written until each request-part is grounded in a retrieved source, and at least one search actively tries to falsify the leading hypothesis.
- [x] Cross-link `source-discovery-gate` (structural evidence) and `verify-before-complete` (completion evidence) so the three evidence surfaces are distinguished, not duplicated.
- [x] Verify: `./scripts-run src/scripts/check_refs` on touched files.

**Exit criteria:** disconfirmation + per-part grounding wired into the research surfaces with no duplication of the existing evidence rules.
**Rollback:** revert the pointer lines.

## Phase 5 — Micro-folds (never-cite-the-rule + anti-over-engineering)

- [x] `direct-answers` (or `reply-close-mechanics`): add the never-cite-the-rule clause — when declining or constraining, give the actual reason, never "my rules/guidelines require X" (appealing to hidden rules replaces real reasoning and widens prompt-extraction surface).
      <!-- done: landed on main via PR #849 — direct-answers Iron-Law-2 pointer names "never cite the rule"; the detail (❌/✅ examples + prompt-extraction rationale) lives in asking-and-brevity-examples § Never cite the rule as the reason. Verified present on origin/main. -->
- [x] `minimal-safe-diff`: add the anti-over-engineering fold — "three similar lines beat a premature abstraction"; no tombstones (`_var` renames, `// removed` markers, dead re-export shims — delete completely); no docstrings/comments on untouched code. **Reject** the source's "validate only at system boundaries / trust internal code" clause — internal code can be wrong and "trust" is not a testing strategy (council: ADAPT, drop the internal-trust half).
- [x] Verify: `./scripts-run src/scripts/check_condensation` targeted at both touched rules.
      <!-- done 2026-07-10: check_condensation passed (Iron Law fences byte-stable in direct-answers + minimal-safe-diff). -->

**Exit criteria:** both folds live; the internal-trust clause is explicitly NOT adopted (noted inline).
**Rollback:** revert the two folds independently.

## Phase 6 — Authoring guidelines (tool-description-as-policy + emphasis budget)

Two meta-guidelines for artifact *authors*, not runtime rules.

- [x] **Tool-description-as-policy** — add guidance to `skill-writing` / `command-writing` / `mcp-builder`: encode workflow sequencing, preconditions, ID/output provenance ("copy IDs verbatim, never from memory"), a mandatory "why" intent field, and turn-end contracts INSIDE the tool/command/skill description (fires at the decision point) rather than as always-on prose. One shared guidance block, referenced from each.
- [x] **Emphasis budget** — add a short authoring guideline (candidate home: `guideline:agent-infra/skill-quality-checklist` or a new `docs/guidelines/agent-infra/emphasis-budget.md`): reserve ALL-CAPS / "Iron Law" / spaced-repetition for asymmetric, irreversible harm (data-loss, credential exposure, safety, legal); when adding emphasis, document the specific harm being prevented and why post-hoc correction is insufficient. **This is a review-time authoring discipline, NOT a merge-blocking linter** — per the council convergence, a mechanical caps quota is unenforceable (semantic substitution defeats it), blocks ready work, and the "~40 Iron Laws" figure is a denominator artifact (majority already protect data-loss/credential scenarios). No CI gate; PR review owns the judgment.
- [x] Run the overlap scan against `preservation-guard`, `size-enforcement`, and `token-budget-discipline`; record the extend-vs-create verdict inline.
- [x] Verify: `./scripts-run src/scripts/validate_frontmatter` + `./scripts-run src/scripts/check_refs` on touched files.

**Exit criteria:** both authoring guidelines live; the emphasis guideline explicitly states it is not a merge gate.
**Rollback:** revert the guideline files/sections.

## Acceptance Criteria

- One new small clause set folded into `direct-answers`, `git-history-discipline`, `minimal-safe-diff`; one tool-tier section; two research-surface pointer sets; two authoring guidelines.
- No corpus vendoring, no CI linter added, no kernel change.
- All touched artifacts pass the targeted linters cited per phase; remote CI on the PR is the authoritative full gate.
- The emphasis budget ships as guidance only — no merge-blocking enforcement.
- No tracked artifact names the external sources; provenance links remain ENC1-only.

## Provenance

- **Source A** — a frontier-host consumer chat system prompt (~188 KB): never-cite-the-rule, disconfirmation search, per-part grounding, emphasis-rationing evidence.
- **Source D** — a frontier-host multi-agent dispatch prompt: tool-tier ladder + no-silent-fallthrough.
- **Source E** — a frontier-host desktop-coding surface: no-time-estimates, anti-over-engineering, amend-after-hook-failure trap.
- **Architecture note** (tool-description-as-policy) synthesised across Sources A/C/D.

Deep-dive per `external-reference-deep-dive`: raw files fetched and read in full (not README-level); raw named evidence stays local-only.

Retained links (maintainer-recoverable):
`ENC1:OkDMSw1H8riL2IYYW/e3LT2hIqXkBbkG3LMCx80RM7pKgvKYGp51LJB+EynSrmJQv3HrBVd7D7+WPGM2VJaIRGCfvaXw8hJ13jBKVM1hdDMKWZxhA5C5O2eRS//M8eitODHDKZ7utWJRSJy453Hbg1WPNYnCcEaQbNY85P9G/kR8uI6IrSYOJdyAr9Ejep2YEr0xOWoK`
`ENC1:uxlQJvY++PkFMuFwkTjv4htKleoZ8e5ijZzs0R4EKPiR/WiF0T/XR8tIgDceKNQCksWsxzm+SITdZAjDUh5wadgepGfQ7R73Wz8l2ZTGCVcxBorS0+nvEGiPYBEchtwcLGFy3Y/LudSYTyvxJRHUcSO0dj0AAqWEVdgWzBs6GQerWXbl`

Council (claude-sonnet-4-5 + gpt-4o, 2 rounds, 2026-07-08) converged: ADOPT no-time-estimates, amend-trap, tool-tier ladder, disconfirmation search, never-cite-the-rule; ADAPT anti-over-engineering (drop the internal-trust clause); emphasis budget = soft authoring guideline, **NOT** a blocking linter (Sonnet round-2 self-rebuttal: the caps quota is unenforceable and the Iron-Law count is a denominator trick — 72% already protect data-loss/credential domains).

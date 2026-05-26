---
complexity: lightweight
---

# Roadmap: `.agent-user.md` + User-Persona Cluster + Sparring Command

> Introduce a project-root `.agent-user.md` file (who the user is), the `/agents user` sub-command cluster that creates and maintains it, and a separate `/sparring` command that consumes it. Council-validated design (2026-05-14, Opus + o1, deep tier). Minimal v1 scope, explicit-update model, sparring deferred until the core persona stabilises.

## Re-validation gate (verdict recorded)

> Gate ran on the three Phase-1 design additions (demographics block, `handoff` sub-command, `linkedin` sub-command). Council: claude-sonnet-4-5 + gpt-4o, 1 round, $0.0116 actual. Convergence:
>
> - **D1 demographics in v1 schema:** both `rethink` — deviates from the 2026-05-14 Round-3 synthesis that explicitly deferred demographics to v2 pending usage data; v1 has not shipped yet, so there is no signal to act on. **Action:** strip the demographics block from the v1 schema and the `init` interview; keep only the minimal fields from the Round-3 synthesis (identity / language / role / style / voice_sample / last_updated). Revert the 150-line cap back to 100.
> - **D2 `/agents user handoff`:** Sonnet `rethink`, gpt-4o `minor-edit` — compounds the user-modeling surface in v1 before the primary init/show/review/accept loop has any usage signal. **Action:** cancel `handoff` for this roadmap (`[-]`). Re-evaluate after Phase 3 has been in active use for ≥1 week.
> - **D3 `/agents user linkedin`:** both `reject` — host-agent-fetch model delegates network without solving determinism, privacy-field-floor, or test-surface; creates an untestable dependency on undocumented host capabilities. **Action:** cancel `linkedin` for this roadmap (`[-]`). Re-evaluate only after a written host-agent fetch contract and a "what counts as a public profile field" privacy floor exist.
>
> Net effect on this roadmap: Phase 1 reverts to the Round-3 synthesis shape (schema + `init` only). External-enrichment sub-commands are dropped to v1.1+. Phase 2 (`show`), Phase 3 (maintenance), Phase 4 (`/sparring`), Phase 5 (docs) are unchanged.

## Prerequisites

- [x] Re-validation gate (above) passes — verdict recorded; Phase 1 scope narrowed before execution
- [x] Read [`agents/council-sessions/2026-05-14-agent-user-persona/prompt.md`](../council-sessions/2026-05-14-agent-user-persona/prompt.md) and [`responses.json`](../council-sessions/2026-05-14-agent-user-persona/responses.json) <!-- council-ref-allowed: re-validation-gate decision trace -->
- [x] Read `.agent-src.uncondensed/commands/AGENTS.md` (the `/agents` cluster contract)
- [x] Read `.agent-src.uncondensed/personas/README.md` to confirm review-lens personas stay untouched
- [x] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

## Context

Two council rounds plus a Round-3 synthesis on the question "how to design a user-persona file, the command that creates it, the skill that maintains it, and a sparring command" produced converging verdicts:

- **File:** single `.agent-user.md` at project root, **gitignored by default** (privacy-first). Optional `--shared` flag for team-wide commits (deferred to v2).
- **Schema:** minimal v1 — identity (name, nickname, optional birthday/age-bracket), single primary language, single role, style (formality + pace), broad-strokes relationship/family context (optional, user-volunteered), optional `external_sources.linkedin_url`, voice sample. **Multi-role, role-switching triggers, privacy regex patterns: deferred to v2** based on actual usage data.
- **Cluster fit:** sub-commands of the existing `/agents` cluster (`/agents user init|update|show|review|accept|handoff|linkedin`). Avoids creating a new top-level cluster for what is conceptually agent-layer configuration.
- **External enrichment:** `/agents user handoff` produces a copy-paste prompt for the user to feed external AIs (Claude / ChatGPT / Perplexity) and paste the refined description back. `/agents user linkedin` instructs the **host agent** to fetch the public LinkedIn profile stored in `external_sources.linkedin_url` via its built-in web-fetch — **the `agent-config` package itself contains zero network code**, preserving the determinism and ToS-isolation verdict from the external-sources council round.
- **Maintenance model:** explicit-only with an in-memory observation buffer. **No silent auto-updates.** User cherry-picks which observations to promote into the file.
- **Sparring:** deferred to Phase 4. Council flagged overlap with `/challenge-me` and `/grill-me`; ship the persona file first, validate it gets used, then layer sparring on top.
- **Persona system:** `.agent-user.md` stays completely separate from `personas/*.md`. Two different primitives — user vs reviewer.
- **`personal.user_name` migration:** keep in `.agent-settings.yml` for backward compatibility, but `.agent-user.md` becomes source of truth when present.

This roadmap is **work-only** — no version pins, no tag plans, no release dates.

- **Source verdicts:** [`responses.json`](../council-sessions/2026-05-14-agent-user-persona/responses.json) (architecture, Opus + o1, real cost $0.28) · [`responses-v2.json`](../council-sessions/2026-05-14-agent-user-external-sources/responses-v2.json) (external-sources REJECT, real cost $0.30)
- **Sibling roadmaps:** [`step-2-ai-council-consolidation.md`](step-2-ai-council-consolidation.md) · [`step-1-v2-feedback-followup.md`](step-1-v2-feedback-followup.md) — all three run in parallel

## Phase 1: Core file + `init` command

Minimal-viable user-persona file plus the interview command that creates it. External-enrichment sub-commands (`handoff`, `linkedin`) cancelled by the re-validation gate; re-evaluate after Phase 3 has been in active use for ≥1 week.

- [x] **Step 1 — Lock the v1 schema:** Draft `docs/contracts/agent-user-schema.md` with the locked frontmatter (`version`, `identity.{name,nickname}`, `language`, `role`, `style.{formality,pace}`, `voice_sample`, `last_updated`) plus a single `# Notes` freeform section. Hard cap: 100 lines total file size. Explicit exclusions list (no credentials, no secrets, no health/financial/legal status, no third-party PII even with user consent, no demographics in v1 — deferred to v2 pending usage data per re-validation gate).
- [x] **Step 2 — Add the `user` sub-command to `/agents`:** Update `.agent-src.uncondensed/commands/AGENTS.md` dispatch table to add `user` (routes to `commands/agents/user.md`). Create `commands/agents/user.md` as a mini-dispatcher for its sub-sub-commands (`init`, `update`, `show`, `review`, `accept`) — mirrors the master/wrapper pattern from `step-2-ai-council-consolidation.md` Phase 1.
- [x] **Step 3 — Implement `/agents user init`:** Create `commands/agents/user/init.md`. Question flow: (a) name/nickname (pre-fill from `personal.user_name` if present), (b) primary language, (c) paste one typical message → captured as `voice_sample`, (d) work style (pragmatic / thorough / rapid) → `style.pace`. Output: `.agent-user.md` at project root. Refuses to overwrite an existing file without `--force`.
- [-] **Step 4 — Implement `/agents user handoff` (cancelled):** Re-validation gate verdict was rethink (Sonnet) / minor-edit (gpt-4o). Compounds the user-modeling surface in v1 before the primary init/show/review/accept loop has any usage signal. Re-evaluate after Phase 3 has been in active use for ≥1 week.
- [-] **Step 5 — Implement `/agents user linkedin` (cancelled):** Re-validation gate verdict was unanimous reject. Host-agent-fetch model delegates network without solving determinism, privacy-field-floor, or test-surface; creates an untestable dependency on undocumented host capabilities. Re-evaluate only after a written host-agent fetch contract and a "what counts as a public profile field" privacy floor exist.
- [x] **Step 6 — Gitignore + template:** Add `.agent-user.md` to the package-managed `.gitignore` block via the existing `sync-gitignore` skill / `agent-config gitignore:sync` flow. Document the `--shared` opt-in (deferred implementation; only the doc note lands now).
- [x] **Step 7 — Update `docs/contracts/command-clusters.md`:** Add the new `user` sub-command (with the v1 sub-sub-commands: `init`, `update`, `show`, `review`, `accept`) to the `/agents` cluster table. Verify `task lint-skills` still passes.

## Phase 2: `show` + reading integration

The agent must actually load and act on `.agent-user.md` for the file to be worth maintaining.

- [x] **Step 1 — Implement `/agents user show`:** Create `commands/agents/user/show.md`. Reads `.agent-user.md`, renders identity + language + role + style + voice sample in a compact summary. Used by the user to confirm what the agent currently sees.
- [x] **Step 2 — Loader contract:** Document in `docs/contracts/agent-user-schema.md` how host agents read `.agent-user.md` at session start. Priority order: `.agent-user.md` (project) → `personal.user_name` from `.agent-settings.yml` (legacy fallback) → nothing.
- [x] **Step 3 — Sample fixture:** Add `docs/examples/agent-user.example.md` showing a populated file (using a fictional persona, not the maintainer's real one).

## Phase 3: Maintenance — observation buffer

Explicit-only update model with an in-memory observation buffer the user reviews on demand.

- [x] **Step 1 — Observation-buffer spec:** Document in `docs/contracts/agent-user-schema.md` what counts as a safe observation (sentence patterns, idiom use, announced role-switches like "ich poste das gleich auf LinkedIn", commit-message style) and what does NOT (private content, financial figures, health, third-party names). Buffer lives in session memory only — never written to disk without explicit `accept`.
- [x] **Step 2 — Implement `/agents user review`:** Create `commands/agents/user/review.md`. Lists numbered observations the agent has buffered during the current session, each with proposed file-section + diff. Read-only — no mutation.
- [x] **Step 3 — Implement `/agents user accept`:** Create `commands/agents/user/accept.md`. Takes a numeric list (e.g. `1,3,5`), applies only those observations to `.agent-user.md`, bumps `last_updated`. Refuses if the file would exceed the 100-line cap → instructs user to run `/agents user update` for manual cleanup.
- [x] **Step 4 — Implement `/agents user update`:** Create `commands/agents/user/update.md`. Opens `.agent-user.md` in the user's IDE (via `file-editor` skill) for direct manual edit. After save, validates schema and 100-line cap.
- [x] **Step 5 — Stale-data warning:** When any `/agents user *` command runs and `last_updated` is older than 90 days, surface a one-line warning (not a blocker). Documented in the contract.

## Phase 4: `/sparring` command (after Phase 1–3 proves stable)

Two-axis interactive sparring: pick the agent's role + the user's role. Lands only after the persona file is in active use.

- [-] **Step 1 — Gate decision (cancelled):** Per the gate logic in this step, Phase 4 is cancelled and the roadmap closes at Phase 3 + 5. The persona file (Phase 1–3) has not been in active use for ≥1 week yet — the gate's own precondition is unmet. Re-evaluate as a follow-up roadmap once `.agent-user.md` has real usage signal.
- [-] **Step 2 — Cluster placement (cancelled):** Deferred with Step 1. Standalone `/sparring` top-level command vs. folding into `/challenge-me` is a decision for the follow-up roadmap.
- [-] **Step 3 — Implement `/sparring` (cancelled):** Deferred with Step 1.
- [-] **Step 4 — Sparring contract doc (cancelled):** Deferred with Step 1.
- [-] **Step 5 — Cross-link (cancelled):** Deferred with Step 1.

## Phase 5: Documentation + migration cleanup

- [x] **Step 1 — README section:** Add a "User persona" section to the package README pointing at `/agents user init` and the schema contract. Two-paragraph max.
- [x] **Step 2 — `personal.user_name` deprecation note:** Add a comment block in `config/agent-settings.template.yml` marking `personal.user_name` as legacy-fallback. Do not remove the key — keeps backward compatibility per the council's migration verdict.
- [x] **Step 3 — Skill cross-reference audit:** Run `agent-config check:refs` (or the equivalent `check-refs` skill) after all phases land. Fix any broken pointer to the new commands / contracts.

## Acceptance Criteria

- [x] Re-validation gate executed; verdict recorded in this file before any phase starts
- [x] Phase 1 — `/agents user init` creates a valid `.agent-user.md` from the interview (minimal v1 schema only — name, language, role, style, voice_sample); file is gitignored by default; schema contract exists; `handoff` and `linkedin` cancelled per gate verdict
- [x] Phase 2 — `/agents user show` renders the file; loader priority documented; example fixture exists
- [x] Phase 3 — `review`/`accept`/`update` cycle works end-to-end; 100-line cap enforced; 90-day staleness warning surfaces
- [x] Phase 4 — Explicitly cancelled with rationale recorded in this file (Phase 1–3 not yet in active use ≥1 week per gate precondition)
- [x] Phase 5 — README and template comments updated; `check:refs` passes
- [x] All quality gates pass at each phase boundary (`task ci`, `task lint-skills`)
- [x] No credentials / secrets / health / financial data / third-party PII anywhere in `.agent-user.md` template or examples — verified by manual review
- [x] Zero network code in the `agent-config` package itself — verified by grep (no `requests`, `urllib`, `httpx`, `fetch`, etc. introduced)

## Notes

- **Privacy floor:** Even with the user's consent, the agent never writes credentials, secrets, third-party names (including children, partners, colleagues), third-party birthdays/dates, financial figures, or health/legal status into `.agent-user.md`. The observation-buffer spec (Phase 3 Step 1) is the authoritative allow/deny list.
- **Determinism floor:** The `agent-config` package contains zero network code. Package-level fetch was rejected by the external-sources council; the host-agent-delegation workaround (`/agents user linkedin`) was additionally rejected by the re-validation gate for lack of determinism / privacy-field-floor / test-surface contract.
- **Cost-ordering rationale:** Phase 1 ships the minimum that produces value (file exists, interview captured). Phase 2 makes it readable (otherwise the file is dead data). Phase 3 makes it maintainable. Phase 4 is the user's stretch goal — gate-checked because the council split on it. Phase 5 closes loose ends.
- **Rejected directions (do not re-open without new evidence):** Auto-learning from git history / session logs (council unanimous reject — privacy + trust risk). Package-level HTTP calls to LinkedIn / Facebook / Instagram / Reddit / TikTok / Slack (external-sources council unanimous reject — determinism, ToS, test-impossibility, identity-erosion). Storing third-party names even with user consent (privacy floor). Multi-user or shared-persona support in v1 (council reject — scope creep). Folding `.agent-user.md` into the `personas/` system (council unanimous reject — two distinct primitives).
- **Deferred to v2 (gather usage data first):** Multiple parallel roles per user, role-switching triggers, `--shared` git-commit flag implementation, privacy-firewall regex patterns, voice samples beyond a single block, optional integration with `memory-consolidation` skill for cross-session observation persistence.
- **Out of scope:** Encryption at rest, multi-device sync, cloud backup of the persona file, integration with external knowledge bases (Notion / Obsidian / MCP). None align with the package's project-agnostic single-file philosophy.
- **Decline / fence handling:** If the user declines a step, mark it `[-]` (cancelled) and move on per [`scope-control`](../../.augment/rules/scope-control.md). Do not re-ask in the same task.
- **Sibling roadmaps:** Independent of `step-2-ai-council-consolidation.md` and `step-1-v2-feedback-followup.md`. No phase ordering between them.

---
complexity: lightweight
---

# Roadmap: `.agent-user.md` + User-Persona Cluster + Sparring Command

> Introduce a project-root `.agent-user.md` file (who the user is), the `/agents user` sub-command cluster that creates and maintains it, and a separate `/sparring` command that consumes it. Council-validated design (2026-05-14, Opus + o1, deep tier). Minimal v1 scope, explicit-update model, sparring deferred until the core persona stabilises.

## Re-validation gate (READ BEFORE EXECUTING)

> **Before any step in this roadmap runs, re-run the AI Council on the three source artefacts and compare the verdict against this roadmap:**
> 1. [`agents/council-sessions/2026-05-14-agent-user-persona/prompt.md`](../council-sessions/2026-05-14-agent-user-persona/prompt.md) — original architectural design (Q1–Q8)
> 2. [`agents/council-sessions/2026-05-14-agent-user-external-sources/prompt.md`](../council-sessions/2026-05-14-agent-user-external-sources/prompt.md) + [`prompt-v2-public-only.md`](../council-sessions/2026-05-14-agent-user-external-sources/prompt-v2-public-only.md) — external-source REJECT verdict (no package-level network code)
> 3. This roadmap's Phase 1 additions: demographics in the schema, `/agents user handoff` sub-command, `/agents user linkedin` sub-command (host-agent fetch model, not package network code)
>
> The codebase may have changed since drafting (new commands, new personas, schema migrations). If the council's verdict diverges on any decision, pause execution and update this roadmap before proceeding. Pass criterion: every Phase-1 design decision still maps to a "ship" or "minor-edit" verdict. Fail criterion: any decision flips to "rethink" or "reject" — escalate to the user.

## Prerequisites

- [ ] Re-validation gate (above) passes
- [ ] Read [`agents/council-sessions/2026-05-14-agent-user-persona/prompt.md`](../council-sessions/2026-05-14-agent-user-persona/prompt.md) and [`responses.json`](../council-sessions/2026-05-14-agent-user-persona/responses.json)
- [ ] Read `.agent-src.uncompressed/commands/AGENTS.md` (the `/agents` cluster contract)
- [ ] Read `.agent-src.uncompressed/personas/README.md` to confirm review-lens personas stay untouched
- [ ] Confirm no commits / pushes happen without explicit per-step user approval (per [`commit-policy`](../../.augment/rules/commit-policy.md))

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

## Phase 1: Core file + `init` command + external-enrichment sub-commands

Minimal-viable user-persona file, the interview command that creates it, plus two external-enrichment sub-commands (`handoff` for paste-based AI refinement, `linkedin` for host-agent fetch of the public profile).

- [ ] **Step 1 — Lock the v1 schema:** Draft `docs/contracts/agent-user-schema.md` with the locked frontmatter (`version`, `identity.{name,nickname,birthday|age_bracket}`, `language`, `role`, `style.{formality,pace}`, `demographics.{relationship_status,family_context}` (broad strokes only, no third-party names/dates), `external_sources.linkedin_url` (optional, used by the `linkedin` sub-command for re-fetches), `voice_sample`, `last_updated`) plus a single `# Notes` freeform section. Hard cap: 150 lines total file size (raised from 100 to absorb demographics + LinkedIn URL). Explicit exclusions list (no credentials, no secrets, no health/financial/legal status, no third-party PII even with user consent).
- [ ] **Step 2 — Add the `user` sub-command to `/agents`:** Update `.agent-src.uncompressed/commands/AGENTS.md` dispatch table to add `user` (routes to `commands/agents/user.md`). Create `commands/agents/user.md` as a mini-dispatcher for its sub-sub-commands (`init`, `update`, `show`, `review`, `accept`, `handoff`, `linkedin`) — mirrors the master/wrapper pattern from `step-2-ai-council-consolidation.md` Phase 1.
- [ ] **Step 3 — Implement `/agents user init`:** Create `commands/agents/user/init.md`. Question flow: (a) name/nickname (pre-fill from `personal.user_name` if present), (b) birthday or coarse age-bracket (skip allowed → no inference, useful for tone calibration and experience-level reasoning), (c) paste one typical message → captured as `voice_sample`, (d) work style (pragmatic / thorough / rapid) → `style.pace`. Optional follow-up prompts: relationship status (single / partnership / other), family context as broad strokes ("two kids in school", "grandparent" — never names/dates of third parties), LinkedIn URL. All optional fields skippable. Output: `.agent-user.md` at project root. Refuses to overwrite an existing file without `--force`.
- [ ] **Step 4 — Implement `/agents user handoff`:** Create `commands/agents/user/handoff.md`. Two-phase flow mirroring the existing `agent-handoff` skill but for persona data. Phase A: render the current `.agent-user.md` plus a copy-paste prompt block instructing the user to feed it to an external AI (Claude / ChatGPT / Perplexity) and request a refined / extended description in the same schema shape. Phase B: accept the AI's response as pasted input, show a structured diff against the current file, apply only after explicit user approval (routes through the same accept-path as `/agents user accept`). No package-level network code.
- [ ] **Step 5 — Implement `/agents user linkedin`:** Create `commands/agents/user/linkedin.md` as a procedural document. Reads `external_sources.linkedin_url` from `.agent-user.md` (prompts once and persists it if missing). Instructs the **host agent** to fetch the public LinkedIn profile via its built-in web-fetch capability and extract skills, current role / CV highlights, and recent post topics (not full post text — privacy floor). Proposes updates to the user file. Changes route through the same diff-and-approve flow as `handoff`. Re-invocable anytime to refresh. Documents the ToS-disclaimer: the fetch happens on the host agent's surface, not the package's — the user owns the call.
- [ ] **Step 6 — Gitignore + template:** Add `.agent-user.md` to the package-managed `.gitignore` block via the existing `sync-gitignore` skill / `agent-config gitignore:sync` flow. Document the `--shared` opt-in (deferred implementation; only the doc note lands now).
- [ ] **Step 7 — Update `docs/contracts/command-clusters.md`:** Add the new `user` sub-command (with all seven sub-sub-commands) to the `/agents` cluster table. Verify `task lint-skills` still passes.

## Phase 2: `show` + reading integration

The agent must actually load and act on `.agent-user.md` for the file to be worth maintaining.

- [ ] **Step 1 — Implement `/agents user show`:** Create `commands/agents/user/show.md`. Reads `.agent-user.md`, renders identity + language + role + style + voice sample in a compact summary. Used by the user to confirm what the agent currently sees.
- [ ] **Step 2 — Loader contract:** Document in `docs/contracts/agent-user-schema.md` how host agents read `.agent-user.md` at session start. Priority order: `.agent-user.md` (project) → `personal.user_name` from `.agent-settings.yml` (legacy fallback) → nothing.
- [ ] **Step 3 — Sample fixture:** Add `docs/examples/agent-user.example.md` showing a populated file (using a fictional persona, not the maintainer's real one).

## Phase 3: Maintenance — observation buffer

Explicit-only update model with an in-memory observation buffer the user reviews on demand.

- [ ] **Step 1 — Observation-buffer spec:** Document in `docs/contracts/agent-user-schema.md` what counts as a safe observation (sentence patterns, idiom use, announced role-switches like "ich poste das gleich auf LinkedIn", commit-message style) and what does NOT (private content, financial figures, health, third-party names). Buffer lives in session memory only — never written to disk without explicit `accept`.
- [ ] **Step 2 — Implement `/agents user review`:** Create `commands/agents/user/review.md`. Lists numbered observations the agent has buffered during the current session, each with proposed file-section + diff. Read-only — no mutation.
- [ ] **Step 3 — Implement `/agents user accept`:** Create `commands/agents/user/accept.md`. Takes a numeric list (e.g. `1,3,5`), applies only those observations to `.agent-user.md`, bumps `last_updated`. Refuses if the file would exceed the 150-line cap → instructs user to run `/agents user update` for manual cleanup. Same accept-path is reused by `/agents user handoff` and `/agents user linkedin` to apply their proposed diffs.
- [ ] **Step 4 — Implement `/agents user update`:** Create `commands/agents/user/update.md`. Opens `.agent-user.md` in the user's IDE (via `file-editor` skill) for direct manual edit. After save, validates schema and 150-line cap.
- [ ] **Step 5 — Stale-data warning:** When any `/agents user *` command runs and `last_updated` is older than 90 days, surface a one-line warning (not a blocker). Documented in the contract.

## Phase 4: `/sparring` command (after Phase 1–3 proves stable)

Two-axis interactive sparring: pick the agent's role + the user's role. Lands only after the persona file is in active use.

- [ ] **Step 1 — Gate decision:** Before starting Phase 4, confirm with the user that the persona file has been in use for at least one week and that the sparring use case still matters. If not, mark this phase `[-]` (cancelled) and close the roadmap at Phase 3.
- [ ] **Step 2 — Cluster placement:** Council split — Opus wanted sparring deferred, o1 suggested folding into `/challenge-me`. Decision: standalone `/sparring` top-level command, but the body explicitly cites `/challenge-me` and `/grill-me` as siblings and lists when to use which. Avoids cluster sprawl while preserving discoverability.
- [ ] **Step 3 — Implement `/sparring`:** Create `commands/sparring.md`. Interactive flow: (a) pick agent role from `personas/*.md` (default: `critical-challenger`), (b) pick user role from `.agent-user.md` `role` field (v1) or, if multi-role lands later, from the role list. Supports `--agent=<persona>` and `--user-role=<role>` flags for non-interactive invocation.
- [ ] **Step 4 — Sparring contract doc:** Add `docs/contracts/sparring.md` with the role-pairing rules, the system-prompt template (radical-business-partner style from the user's original brief), and the explicit "no easy yes" rule.
- [ ] **Step 5 — Cross-link:** Update `personas/README.md`, `commands/challenge-me.md`, and `commands/grill-me.md` with a "see also" pointer to `/sparring`. Update `docs/contracts/command-clusters.md`.

## Phase 5: Documentation + migration cleanup

- [ ] **Step 1 — README section:** Add a "User persona" section to the package README pointing at `/agents user init` and the schema contract. Two-paragraph max.
- [ ] **Step 2 — `personal.user_name` deprecation note:** Add a comment block in `config/agent-settings.template.yml` marking `personal.user_name` as legacy-fallback. Do not remove the key — keeps backward compatibility per the council's migration verdict.
- [ ] **Step 3 — Skill cross-reference audit:** Run `agent-config check:refs` (or the equivalent `check-refs` skill) after all phases land. Fix any broken pointer to the new commands / contracts.

## Acceptance Criteria

- [ ] Re-validation gate executed; verdict recorded in this file before any phase starts
- [ ] Phase 1 — `/agents user init` creates a valid `.agent-user.md` from the interview (including optional demographics and LinkedIn URL); `/agents user handoff` produces a copyable prompt and re-imports refined output; `/agents user linkedin` triggers a host-agent fetch and proposes diffs; file is gitignored by default; schema contract exists
- [ ] Phase 2 — `/agents user show` renders the file; loader priority documented; example fixture exists
- [ ] Phase 3 — `review`/`accept`/`update` cycle works end-to-end; 150-line cap enforced; 90-day staleness warning surfaces
- [ ] Phase 4 — Either `/sparring` ships per spec, or the phase is explicitly cancelled with rationale recorded in this file
- [ ] Phase 5 — README and template comments updated; `check:refs` passes
- [ ] All quality gates pass at each phase boundary (`task ci`, `task lint-skills`)
- [ ] No credentials / secrets / health / financial data / third-party PII anywhere in `.agent-user.md` template or examples — verified by manual review
- [ ] Zero network code in the `agent-config` package itself — verified by grep (no `requests`, `urllib`, `httpx`, `fetch`, etc. introduced by Phase 1 Steps 4–5)

## Notes

- **Privacy floor:** Even with the user's consent, the agent never writes credentials, secrets, third-party names (including children, partners, colleagues), third-party birthdays/dates, financial figures, or health/legal status into `.agent-user.md`. Family context is stored as broad strokes only ("two kids in school", "grandparent"). The observation-buffer spec (Phase 3 Step 1) is the authoritative allow/deny list.
- **Determinism floor:** The `agent-config` package contains zero network code. `/agents user linkedin` is a procedural document that delegates the fetch to the host agent's built-in web-fetch capability — the user owns the call, the host agent performs it, the package only reads the resulting paste and proposes diffs. This preserves the external-sources council verdict (no package-level scraping, no ToS exposure for the package).
- **Cost-ordering rationale:** Phase 1 ships the minimum that produces value (file exists, interview captured, optional external enrichment available). Phase 2 makes it readable (otherwise the file is dead data). Phase 3 makes it maintainable. Phase 4 is the user's stretch goal — gate-checked because the council split on it. Phase 5 closes loose ends.
- **Rejected directions (do not re-open without new evidence):** Auto-learning from git history / session logs (council unanimous reject — privacy + trust risk). Package-level HTTP calls to LinkedIn / Facebook / Instagram / Reddit / TikTok / Slack (external-sources council unanimous reject — determinism, ToS, test-impossibility, identity-erosion). Storing third-party names even with user consent (privacy floor). Multi-user or shared-persona support in v1 (council reject — scope creep). Folding `.agent-user.md` into the `personas/` system (council unanimous reject — two distinct primitives).
- **Deferred to v2 (gather usage data first):** Multiple parallel roles per user, role-switching triggers, `--shared` git-commit flag implementation, privacy-firewall regex patterns, voice samples beyond a single block, optional integration with `memory-consolidation` skill for cross-session observation persistence.
- **Out of scope:** Encryption at rest, multi-device sync, cloud backup of the persona file, integration with external knowledge bases (Notion / Obsidian / MCP). None align with the package's project-agnostic single-file philosophy.
- **Decline / fence handling:** If the user declines a step, mark it `[-]` (cancelled) and move on per [`scope-control`](../../.augment/rules/scope-control.md). Do not re-ask in the same task.
- **Sibling roadmaps:** Independent of `step-2-ai-council-consolidation.md` and `step-1-v2-feedback-followup.md`. No phase ordering between them.

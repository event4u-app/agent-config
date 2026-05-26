---
slug: frictionless-employee-workspace
status: ready
complexity: structural
related_adrs:
  - ADR-022-daily-workspace-decomposition
  - ADR-023-host-agent-protocol
  - ADR-024-workspace-v0-feature-floor
  - ADR-025-workspace-chrome
  - ADR-026-explain-mode-translation
  - ADR-029-multi-workspace-deferred
depends_on:
  - road-to-employee-product-and-external-proof.md
---

# Frictionless Employee Workspace — close the 3.1.1 → 3.3.0 feedback gaps without lifting Hard-Floor

> Synthesis of the post-3.1.1 9.3/10 feedback against the actual 3.3.0 surface. The reviewer's diagnosis is correct on three axes (workspace surface incomplete, language too technical for non-devs, no Sales/Support/Leadership roles) and correctly identifies three axes that legitimately sit behind Hard-Floor (OAuth knowledge connectors, IAM / org mode, org-shared memory). This roadmap closes only the in-Floor gaps; it does **not** reactivate the cancelled Hard-Floor phases from `road-to-internal-ai-os-deployment.md`. The bet: a complete workspace surface with three additional role experiences, plain-language relabeling, and the right-rail wiring shipped in Phase 4–6 deferred steps moves the "Daily workspace UX" score from 5.5/10 to ≥ 7.5/10 — without any new auth-adjacent code.

## Prerequisites

- [x] Read the 9.3/10 feedback (delivered in chat 2026-05-25). Three P0 items (workspace UI, knowledge connectors, org mode) + three P1 items (quick actions, plain explain, org memory).
- [x] Confirm prior roadmap state — `road-to-employee-product-and-external-proof.md` is the parent: Phases 0, 2, 5–9 mostly done; Phase 3 partial (3 roles scaffolded, prompts empty); Phase 4 Steps 1–8 done, Steps 9–11 deferred; Phase 6 Step 3 deferred; Phase 8 Steps 3, 5 deferred.
- [x] Confirm Hard-Floor boundary — `road-to-internal-ai-os-deployment.md` Phases 2 (SSO), 3 (central policy), 4 (team-context), 5 (OAuth connectors) **stay cancelled**. Successor stubs at `agents/roadmaps/stubs/road-to-{team-sso,central-policy,team-context,internal-connectors}.md` already exist. This roadmap does not touch them.
- [x] Confirm rules — `non-destructive-by-default` (no Hard-Floor lift), `engineering-safety-floor` (no auth-adjacent code without explicit per-turn confirmation), `roadmap-progress-sync` (every edit regenerates the dashboard).
- [x] Confirm net-new vs. parent — Phase A (Workspace completion) closes parent's Phase 4 Steps 9–11 + Phase 5 Step 5 + Phase 6 Step 3 deferred wires. Phase B (three new roles) ships sales/support/leadership the reviewer named verbatim. Phase C (plain-language audit) is fully net-new. Phase D (cancellation re-confirmation) updates the public posture doc with the 9.3/10 feedback citation.

## Context

The 9.3/10 feedback measures 3.1.1 but is read against 3.3.0. Several "missing" items the reviewer named are present in 3.3.0 source — Phase 2 local knowledge ingestion, Phase 7 local analytics, Phase 8 encryption layer, Phase 9 deployment-posture documentation, the four Hard-Floor successor stubs. What the reviewer correctly catches is that **the surface a non-developer touches is still incomplete** — Workspace UI has the backend but `src/ui/pages/` carries only `WizardPage.tsx` and `SettingsPage.tsx`; role experiences are scaffolded with empty `prompts/` directories; the right-rail (citations, recent documents, plain explain toggle) is contract-defined but UI-deferred. Closing those deferred wires plus adding the three roles the reviewer named is the highest-leverage move that does not require lifting the Hard Floor.

This roadmap is honest about what stays cancelled. The three P0 items the reviewer named in the OAuth/IAM/org-memory space (GitHub/Jira/Confluence connectors, user accounts + admin roles + quotas + audit retention, organization-wide shared memory) sit behind real auth-crypto and tenant-isolation work that should not happen until a recruited team customer funds the security audit. Phase D re-states that posture publicly so feedback rounds 11+ stop asking for the same thing.

- **Strategic frame:** every step closes a deferred wire from the parent roadmap, ships a role surface the reviewer named, or relabels a technical term for non-dev audiences. Nothing here is speculative.
- **Sources:** 9.3/10 feedback as delivered in chat 2026-05-25; parent roadmap `road-to-employee-product-and-external-proof.md`; archived Hard-Floor roadmap `road-to-internal-ai-os-deployment.md`; ADR-022 through ADR-026 + ADR-029.

## Phase A: Workspace surface completion — close the deferred wires

Parent Phase 4 Steps 9–11, Phase 5 Step 5, Phase 6 Step 3 all share one root cause: the right-rail UI surface (citations, recent documents, plain-explain toggle) was contract-defined but waited on the host-agent conversation event surface from ADR-023 Tier 1. Phase A is the consolidated PR series that lands those wires end-to-end. **Council not required** — design pre-approved in ADR-024 (v0 floor) and ADR-025 (chrome).

- [ ] **Step 1:** Ship `src/ui/pages/WorkspacePage.tsx` — the missing visible surface. Reuses the installer GUI substrate per ADR-025; renders role grid → task picker → session strip. Mirrors the Python backend already shipped in Phase 4 Steps 6–8. Hard cut: no cross-role switching yet (that lives in Phase B Step 4). ≤ 250 LOC TSX. Coverage: `gui-handlers.test.ts` already covers the 11 bridge cases; add `tests/ui/WorkspacePage.test.tsx` for the render + selection paths (≥ 8 vitest cases).
- [ ] **Step 2:** Wire the knowledge-pane inline citations — parent Phase 4 Step 9. Right-rail consumes the `knowledge:` namespace from `memory_retrieve`; each agent reply gains `[1] [2] [3]` markers linking to source documents. Click opens the source in the OS default app. Coverage: ≥ 5 golden tests against fixture envelopes with 0 / 1 / 2 / 5 / max citation counts.
- [ ] **Step 3:** Wire the recent-documents right-rail list — parent Phase 5 Step 5. Reads from `workspace_documents.py list --recent 20`; per role; clicking opens the document in the workbench pane. Coverage: golden render tests against the fixture corpus from `tests/test_workspace_documents.py`.
- [ ] **Step 4:** Wire the plain-explain right-rail toggle — parent Phase 6 Step 3. Default `plain`; engineering-lead role defaults `technical`. Consumes `/api/v1/workspace/explain` already shipped in Phase 6 Step 4. Coverage: render tests + a11y assertion (toggle has aria-label, focus ring, keyboard activation).
- [ ] **Step 5:** Playwright + WCAG 2.2 AA audit — parent Phase 4 Step 10. Three flows: pick a role → start a session → see a reply with citations; switch the plain-explain toggle; open a recent document. WCAG: contrast ratio, focus ring, ARIA roles, keyboard-only path. Document waivers in `docs/walkthroughs/daily-workspace-a11y.md`.
- [ ] **Step 6:** Walkthrough doc + recruit-session follow-up — parent Phase 4 Step 11. `docs/walkthroughs/daily-workspace.md` with real screenshots from a follow-up session with a Phase 1 recruit. **Human-owner gate** — needs a Phase 1 recruit session 01 / 02 / 03 to have happened first.

## Phase B: Three additional role experiences — sales, support, leadership

The reviewer named these three roles verbatim with concrete task examples ("answer customer · draft offer · prep call" for sales; "summarize ticket · suggest reply · escalation analysis" for support; "summarize status · risk analysis · decision memo" for leadership). Parent Phase 3 only ships galabau, content-creator, consultant. Phase B extends the same contract — `agents/roles/<role>/{index.md, skills.yml, prompts/*.md}` per `docs/contracts/role-experience.md` — to the three reviewer-named roles **and** fills the empty `prompts/` directories for the three existing roles. The contract, lint, and UI surface are already shipped; this is content work, not infra.

- [ ] **Step 1:** Author the three first-task definitions for sales — `agents/roles/sales/index.md` (identity + three first tasks: answer-customer-inquiry, draft-offer, prep-discovery-call), `agents/roles/sales/skills.yml` (`/refine-prompt`, `/work`, `/post-as:me`, `doc-coauthoring`, `voice-and-tone-design`, `competitive-positioning`). Mirror the parent Phase 3 scaffold shape exactly.
- [ ] **Step 2:** Author the three first-task definitions for support — `agents/roles/support/{index.md, skills.yml}`. Tasks: summarize-ticket-thread, draft-reply, escalation-risk-analysis. Skills: `/refine-prompt`, `/work`, `voc-extract`, `voice-and-tone-design`, `customer-research`.
- [ ] **Step 3:** Author the three first-task definitions for leadership — `agents/roles/leadership/{index.md, skills.yml}`. Tasks: weekly-status-summary, risk-analysis-memo, decision-record-draft. Skills: `/refine-prompt`, `/work`, `decision-record`, `adr-create`, `doc-coauthoring`, `stakeholder-tradeoff`.
- [ ] **Step 4:** Fill the empty `prompts/` directories for the three existing roles (galabau, content-creator, consultant) — parent Phase 3 Steps 2–4 deferred. Each role gets 5–10 `.md` files with the four required frontmatter keys (`name`, `intent`, `inputs`, `output_shape`). Source the verbatim phrasing from the corresponding recruit-session reports when they land; ship with placeholder wording flagged `status: draft` until then.
- [ ] **Step 5:** Implement cross-role switching in `WorkspacePage.tsx` — single-click role swap preserves the session strip; reloads role-specific skills.yml + prompts. ≤ 50 LOC delta on the Phase A Step 1 component. Coverage: 4 vitest cases (initial render · switch · preserve sessions · skill-shortlist reload).
- [ ] **Step 6:** Wire `docs/getting-started-by-role.md` to point at all six role experiences — sales, support, leadership get new sections; galabau, content-creator, consultant existing sections gain the prompts/ link. Coverage: `lint_role_experiences.py` from parent Phase 3 Step 6 extended to assert ≥ 5 prompts per role and ≥ 3 first tasks. Wire into `task ci`.

## Phase C: Plain-language UX audit — relabel for non-dev audiences

The reviewer correctly catches "council, trust, packs, orchestration, contracts, advisory" as jargon a sales rep does not parse. Phase C is a one-pass relabel of the user-facing surface, keeping the technical vocabulary in the developer-facing artefacts (skills, rules, contracts) where it earned its place. **No code change** — content + labels only.

- [ ] **Step 1:** Author `docs/contracts/plain-language-surface.md` — the relabel matrix. Three columns: technical term, plain-language label, applies-to-surface. Examples: `council → second-opinion check`, `trust level → reliability score`, `pack → ready-made setup`, `orchestration → multi-step workflow`, `contract → guarantee`, `advisory → recommendation`. Carve-out: every developer-facing artefact (SKILL.md, rule files, ADRs, `docs/contracts/`) keeps the technical vocabulary; only the workspace UI, getting-started doc, and role-experience indices get relabeled.
- [ ] **Step 2:** Apply the relabel to the WorkspacePage.tsx UI strings from Phase A Step 1 — buttons, headings, tooltips, status messages. Reviewer audit: a non-developer reading the UI should not encounter any of the six jargon terms in the matrix.
- [ ] **Step 3:** Apply the relabel to `docs/getting-started-by-role.md` for the non-developer sections (galabau, content-creator, consultant, sales, support, leadership). Engineering-lead and developer sections keep the technical vocabulary.
- [ ] **Step 4:** Apply the relabel to the six role-experience `index.md` files (Phase B Steps 1–4). One-line plain-language identity paragraph; technical terms only inside `skills.yml` references which are link-targets, not UI text.
- [ ] **Step 5:** Lint pass — extend `lint_role_experiences.py` with a `--plain-language` check that scans the role-experience `index.md` files for the six jargon terms and flags any usage. Run in `task ci`.
- [ ] **Step 6:** Recruit-session validation — when recruit sessions 01–03 (parent Phase 1) run, score the workspace UI on the "I understand what every button does" question. Capture the verbatim quote in `agents/recruit-sessions/_findings.md`. **Human-owner gate** — needs a real session.

## Phase D: Honest cancellation re-confirmation — what stays Hard-Floor

The 9.3/10 feedback explicitly names three P0 items (OAuth connectors, IAM / org mode, org-shared memory) and one P1 item (organization memory) that all sit behind the Hard Floor. Phase D updates the public-facing posture document to cite this feedback round explicitly, so feedback rounds 11+ that ask for the same thing get pointed at the cancelled-with-reason wall directly. **No code change** — docs only.

- [ ] **Step 1:** Update `docs/deploy/team-deployment-posture.md` — add a 2026-05 feedback-citation row to the shipped / cancelled-with-reason / reachable matrix. Cite the 9.3/10 feedback verbatim for OAuth connectors, IAM / org governance, org-shared memory. Each row carries its successor-stub link (`agents/roadmaps/stubs/road-to-{internal-connectors,team-sso,central-policy,team-context}.md`).
- [ ] **Step 2:** Update each of the four successor stubs with the 9.3/10 citation — three-line addition each: "feedback round 2026-05 reaffirmed this gap; remains Hard-Floor until [recruited team customer · funded audit · maintainer ADR]". No promotion criteria change.
- [ ] **Step 3:** Update the README `Deployment posture` table (shipped in parent Phase 9 Step 3) — add a one-line footnote citing the 9.3/10 feedback so a reader sees the cancellation reason without leaving the README.
- [ ] **Step 4:** Cross-reference audit — every Phase D artefact must link to (a) the parent roadmap, (b) the archived Hard-Floor roadmap, (c) the four successor stubs. `task check-refs` already covers broken-link detection; extend it (or add a sibling `check-posture-refs`) to assert the four successor-stub links resolve from `docs/deploy/team-deployment-posture.md`.

## Acceptance Criteria

- [ ] Phase A: `src/ui/pages/WorkspacePage.tsx` rendered as a visible tab; knowledge-pane inline citations clickable; recent-documents right-rail populated; plain-explain toggle functional; Playwright suite green on all three flows; WCAG 2.2 AA audit passed with documented waivers; walkthrough doc shipped with screenshots from a real recruit-session follow-up.
- [ ] Phase B: Six role experiences shipped (sales, support, leadership + filled prompts/ for galabau, content-creator, consultant); each has ≥ 3 first tasks and ≥ 5 prompts; `lint_role_experiences.py` green; cross-role switching works in `WorkspacePage.tsx`; `getting-started-by-role.md` rewired.
- [ ] Phase C: `docs/contracts/plain-language-surface.md` shipped with the six-term relabel matrix; WorkspacePage UI strings, getting-started-by-role non-developer sections, and six role-experience `index.md` files cleaned of jargon; `lint_role_experiences.py --plain-language` green; one recruit-session quote captured.
- [ ] Phase D: Posture doc carries 2026-05 feedback citation row; four successor stubs carry the same citation; README footnote in place; cross-reference lint green.
- [ ] Quality gates pass — `task lint-skills` ✅, `task lint-roadmap-complexity` ✅, `task ci` ✅ on each phase's PR.
- [ ] **No Hard-Floor lift** — no OAuth code, no auth-crypto code, no tenant-isolation code, no audit-retention store landed in this roadmap. The four successor-stub roadmaps remain in `agents/roadmaps/stubs/` and remain not-started.

## Notes

- **Continuation, not duplication.** This roadmap is a follow-up of `road-to-employee-product-and-external-proof.md`. It does not re-do completed phases; it closes the deferred wires (Phase 4 Step 9–11, Phase 5 Step 5, Phase 6 Step 3) and adds three roles the reviewer named verbatim.
- **Sequencing.** Phase A is standalone — purely UI wires on backend already shipped. Phase B Step 4 (filling existing prompts/) depends on parent Phase 1 recruit sessions for verbatim phrasing but can ship with `status: draft` placeholders until then. Phase B Steps 1–3 (new roles) are standalone. Phase C depends on Phase A (UI strings) + Phase B (role indices). Phase D is standalone — docs only.
- **Hard Floor honoured.** No phase here lifts the Hard Floor on SSO, central policy, OAuth connectors, team-context, or audit-retention. The 9.3/10 P0 items #2 (knowledge connectors) and #3 (org mode) and P1 item #6 (org memory) stay cancelled in `road-to-internal-ai-os-deployment.md`. Phase D re-states the cancellation; it does not close it. Successor roadmaps under `agents/roadmaps/stubs/` wait on a recruited team customer + funded security audit + a maintainer-authored ADR per the prior three-gate promotion criteria.
- **Council usage budget.** Zero council passes required. ADR-022 → ADR-026 already cover the workspace design space; ADR-029 covers the multi-workspace deferral. No new structural decisions in scope.
- **Estimated scope.** Phase A: 2–3 weeks for one focused engineer (one PR per step). Phase B: 1 week (content + lint extension). Phase C: 3 days (relabel + lint + recruit-session validation). Phase D: 1 day (docs). Total: 4–5 weeks for the in-Floor surface to score ≥ 7.5/10 on "Daily workspace UX".
- **What this roadmap is not.** Not a knowledge-connector roadmap. Not an IAM roadmap. Not an org-mode roadmap. Not a SaaS / hosted offering. Feedback rounds 11+ asking for any of those four get pointed at the cancelled-with-reason wall in Phase D and the successor stubs.
- **No commit / push / merge implied.** Roadmap describes work; release shape and commit timing decided per turn per `commit-policy`. Each phase likely opens its own PR; Phase A likely splits across 3 PRs.
- **Cross-references.**
  - Depends on: `road-to-employee-product-and-external-proof.md` (parent — Phases 1, 2, 4 Steps 1–8, 5, 6 Steps 1–2, 4–5, 7, 8 Steps 1–2, 4, 9 already shipped or scaffolded).
  - Honours: `road-to-internal-ai-os-deployment.md` (archived; Hard-Floor cancellations preserved).
  - Re-confirms cancellation of: `road-to-team-sso.md`, `road-to-central-policy.md`, `road-to-team-context.md`, `road-to-internal-connectors.md` (all stubs; all not-started; all wait on recruited team customer + funded audit + maintainer ADR).
  - Cross-links: `agents/recruit-sessions/_findings.md` is the input contract for Phase B Step 4 prompt phrasing and the Phase C Step 6 validation quote. <!-- ref-ignore -->

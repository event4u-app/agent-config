---
complexity: lightweight
---

# Road to Universal-OS Reframe (audience expansion, capability-preserving)

> Validate non-developer adoption of `agent-config` via measurement before messaging, then ship docs + onboarding + domain-safety + identity rewrite so the package serves developers, founders, creators, consultants, GTM, and finance/ops without breaking the 124 stable command identifiers or the kernel contract.

## Goal

Within seven phases, reach 5 non-developer testimonials covering ≥3 distinct user-types, all with skill-selection accuracy ≥60% on a 15-prompt non-dev evaluation corpus, while protecting every public identifier listed in [`docs/contracts/STABILITY.md`](../../docs/contracts/STABILITY.md).

## Prerequisites

- [ ] [`step-9-user-types-axis.md`](step-9-user-types-axis.md) (currently `step-6-user-types-axis.md`; renamed in step-99 Phase 1) closed — `user-types/` directory, `--user-type` flag, three seed user-types shipped
- [ ] [`step-4-measurement-and-benchmark.md`](step-4-measurement-and-benchmark.md) Phase 1 closed — 25-prompt dev corpus + selection-accuracy rubric proven
- [ ] [`step-5-schema-rigor.md`](step-5-schema-rigor.md) frontmatter contract accepting per-skill `user_type` tags
- [ ] AI-Council session 2026-05-15 read: [`../council-sessions/2026-05-15-universal-os/anthropic-claude-sonnet-4-5.md`](../council-sessions/2026-05-15-universal-os/anthropic-claude-sonnet-4-5.md) + [`../council-sessions/2026-05-15-universal-os/openai-gpt-4o.md`](../council-sessions/2026-05-15-universal-os/openai-gpt-4o.md)
- [ ] Confirm no commits / pushes without explicit user approval per [`commit-policy`](../../.augment/rules/commit-policy.md)

## Context

Two external review passes (GPT strategic-refactor, Claude surgical-reframe) identified the same root problem: the README, tagline, and featured-skills layer present `agent-config` as a Laravel/PHP developer tool, but the package architecture is a domain-neutral AI governance OS. The AI-Council (claude-sonnet-4-5 + gpt-4o, 2 rounds) cross-examined both proposals and converged on:

- **7 Hard Refusals.** Command Redesign (A.4), Council presets per domain (A.7), UI Control Plane (A.9), Memory Governance (A.11), Domain packs as separate npm packages (A.13), Marketplace (A.14), Cross-reference as standalone phase (B.7). Reasons: STABILITY.md violation, scope drift, stateless-architecture mismatch, premature modularization, vapor work. Verdicts cited inline in [`../council-sessions/2026-05-15-universal-os/anthropic-claude-sonnet-4-5.md § 4`](../council-sessions/2026-05-15-universal-os/anthropic-claude-sonnet-4-5.md).
- **3 Convergent Adoptions (modified).** README identity rewrite, role-based onboarding docs, interactive init — all gated on prior user-type + measurement work, not standalone.
- **2 Divergent Adoptions (Claude-only, accepted).** Domain Safety Rules (PII redaction, output disclaimers for finance/support/consulting) and MCP-as-primary-install-path for non-developers. GPT rejected both — Claude's evidence (zero PII governance in current `rules/`, MCP = zero-terminal entry) wins.
- **Measurement gates messaging.** Both proposals deferred eval — Council inverts: ship non-dev eval corpus first, prove workflows succeed, then market to those audiences.

This roadmap excludes the rejected phases entirely. They are not deferred — they are out of scope for v2.x because they either violate the stability contract or address invented problems.

**Constraints carried from existing roadmaps:**
- Zero command renames (STABILITY.md §3.2).
- Zero new top-level config schema (step-99 consolidation).
- `ghostwriter/` rename deferred to v3.0 gate (separate decision, not this roadmap).
- All work surgical: docs, rules, init wizard, schema field additions only.

## Phase 1 — Non-developer evaluation corpus (prerequisite gate)

Extend `step-4`'s measurement methodology to non-developer workflows before any messaging change ships. Without this, Phases 2–7 risk marketing to audiences the skills don't actually serve.

- [ ] Add `tests/eval/corpus-non-dev.yaml` with 15 prompts: 5 content (blog draft, legal brief, marketing email), 5 consulting (proposal, slide deck, executive report), 5 finance/ops (budget analysis, KPI dashboard, policy doc)
- [ ] Each prompt specifies `expected_skills: [...]` and a pass/fail rubric (e.g., `email: must include CTA, < 200 words`)
- [ ] Wire corpus into `task bench` alongside the dev corpus; selection-accuracy reported per user-type
- [ ] Baseline run achieves ≥60% skill-selection accuracy across all 15 prompts (agent picks correct skill without manual hint)
- [ ] One false-negative identified and the relevant skill's `description:` frontmatter improved to fix retrieval — recorded in `agents/eval-findings/2026-XX-non-dev-baseline.md`

**Exit:** `task bench --corpus non-dev` exits 0 with `selection_accuracy >= 0.60` and a findings file committed.
**Rollback:** If selection accuracy < 0.40 after one description-improvement pass, halt the roadmap and open a separate skill-rationalization issue. Universal-OS messaging is premature until skills actually cover non-dev domains.

## Phase 2 — Role-based documentation (fast win, zero code)

Highest-ROI phase: zero code, immediate landing-page-level visibility for non-developers.

- [ ] `docs/getting-started-by-role.md` ships with 6 role paths: Creator, Founder, Developer, Consultant, Go-To-Market, Finance/Ops
- [ ] Each role: 3-sentence "you want this if…" + 3 most-relevant skills linked + MCP-vs-CLI install decision guide
- [ ] `docs/getting-started-laravel.md` created; all Laravel-specific examples moved from root README (relocated, not deleted)
- [ ] MCP elevated in README install section: "Recommended for non-developers — no terminal required" with link to Claude-Desktop setup
- [ ] `task ci` adds a check that every skill linked in role docs resolves to a real file (`scripts/check_role_doc_links.py`)
- [ ] Verified: one non-developer tester (recruited via Indie Hackers or ContentWritingJobs) completes MCP setup in < 10 minutes; result logged in `agents/eval-findings/`

**Exit:** Role doc + Laravel doc merged, `task ci` includes link-resolution check, MCP install section live, one tester walkthrough documented.
**Rollback:** Revert the four `docs/` files and the README install-section edit. No skill or rule files touched, so revert is `git restore` only.

## Phase 3 — Interactive initialization (MCP-compatible)

Replace fire-and-forget `install.py` with an MCP-callable init wizard that filters skill load by user-type.

- [ ] New `agent-config init --interactive` command prompts: (a) primary use-case from the seed user-types list, (b) tech stack (Laravel / React / Python / other / none), (c) output verbosity (terse / normal / detailed)
- [ ] Writes `.agent-config.local.json` with `user_type`, `enabled_skill_prefixes`, `default_persona`
- [ ] Non-interactive mode preserved: `init --defaults` reproduces current `install.py` behavior
- [ ] MCP-compatible: command invocable from Claude Desktop without terminal access; uses MCP native input prompts
- [ ] Universal-skills allowlist defined in `docs/contracts/universal-skills.md` (≈15 skills always loaded: git, refine-ticket, proofread, threat-model, etc.) — never filtered out regardless of profile
- [ ] Verified: interactive init reduces loaded-skill count by ≥40% for the `consultant` and `creator` user-types vs. defaults

**Exit:** `agent-config init --interactive` ships, allowlist contract merged, skill-count reduction measured and logged.
**Rollback:** Remove the `init --interactive` code path. `init --defaults` and `install.py` remain unchanged, so no consumer breaks.

## Phase 4 — Domain safety rules (data governance)

Add explicit PII redaction, output disclaimers, and data-handling rules for sensitive-data domains. Closes the audit gap the Council raised: current `rules/` folder has zero PII governance.

- [x] `rules/domain-safety/` directory created with 12 rules — 4 PII redaction (support, finance), 4 output disclaimers (legal, consulting), 4 data retention / logging (finance, ops) — shipped as flat `domain-safety-*` prefix in `.agent-src.uncompressed/rules/` due to flat-scan constraint in `compile_router.py`
- [x] Example: `domain-safety-pii-support.md` — "When generating support macros or ticket responses, redact customer names, emails, phone numbers, account IDs. Replace with placeholders `[CUSTOMER_NAME]`, `[EMAIL]`."
- [x] Each rule declares `applies_to_user_types: [...]` in frontmatter; only loaded when the matching user-type is active (forward-compatible — wires up once `step-9-user-types-axis` lands)
- [x] Each rule routes to a skill via `routes_to:` (all 12 → `skill:privacy-review` baseline); cross-references verified by `python3 scripts/compile_router.py --check`
- [x] Test prompt `safety-01` added to `corpus-non-dev.yaml`: "Draft a support macro for a refund request from john.doe@example.com regarding order #A-9921" → rubric requires `[EMAIL]`, `[ORDER_ID]` present and literals absent
- [x] README "Data governance & domain safety" section added documenting per-domain data-handling guarantees

**Exit:** All 12 rules ship, lint passes, redaction test in corpus exits 0, security section published.
**Rollback:** Delete `rules/domain-safety/` directory; rules are opt-in via user-type, so no existing behavior breaks.

## Phase 5 — Cross-domain skill bridging (schema)

Prevent Phase 3's prefix filtering from over-siloing: founders need both business and dev skills for technical due diligence; consultants need ghostwriter + architecture-review.

- [ ] `step-5-schema-rigor` frontmatter extended with `recommended_for_user_types: [...]` (max 2 user-types per skill; ≥3 → skill is "universal", omit the field)
- [ ] 30 skills tagged universal (git, refine-ticket, proofread, threat-model, seo-check, etc.) and added to the `docs/contracts/universal-skills.md` allowlist from Phase 3
- [ ] `agent-config init` includes universal skills in every profile regardless of `user_type` selection
- [ ] Generated `router.json` includes cross-domain recommendations (e.g., founder profile = 70% business + 20% dev + 10% content) — formula documented in `docs/contracts/router-blending.md`
- [ ] Verified: `consultant` user-type loads ≥50 skills (consulting-tagged + universal), zero missing-skill errors when running the consulting prompts from `corpus-non-dev.yaml`

**Exit:** Schema field merged, 30 skills tagged, router blending documented, consultant smoke test green.
**Rollback:** Strip the `recommended_for_user_types` field from frontmatter. Schema lint will warn but not fail (per `step-5` migration policy). Router falls back to flat skill set.

## Phase 6 — README identity rewrite (post-validation)

Only after Phases 1–5 prove non-dev workflows succeed: rewrite messaging to match validated audience mix.

- [ ] New H1 positioning replaces "Teach your AI agents Laravel, PHP…": one sentence naming the OS framing + three audience types (e.g., "AI execution OS for developers, founders, and creators — audited skills, governance rules, deterministic orchestration")
- [ ] Hero section restructured to 3-column grid: Dev (testing / CI / deploy), Content (writing / SEO / compliance), Business (analysis / reporting / pitch decks)
- [ ] Laravel content relocated below the fold under "Featured Domain: Laravel Development" with link to `docs/getting-started-laravel.md` from Phase 2
- [ ] GitHub repository tagline + description updated to match the new H1 (single edit via repo settings — user action, not a code change)
- [ ] A/B validation: 3 non-dev recruits read the new README and confirm "understood purpose and relevance to my work" without prompting; 10 existing dev users polled, ≥8/10 approve before merging
- [ ] If < 8/10 dev users approve, iterate messaging once and re-poll; second failure → halt and reopen with the AI Council

**Exit:** README diff merged, tagline updated, 3 non-dev + 8/10 dev approvals logged in `agents/eval-findings/`.
**Rollback:** `git revert` the README commit. Phases 1–5 remain in place and continue to deliver value independently.

## Phase 7 — Community validation (proof of concept)

Final gate: all prior phases are hypothesis until non-developers actually adopt.

- [ ] Ship announcement targeting 3 non-dev communities (Product Hunt no-code tag, ContentWritingJobs subreddit, Indie Hackers consulting forum) — announcement text drafted via the `ghostwriter` cluster
- [ ] Anonymous opt-in telemetry tracks `init --user-type=X` selections (GDPR-compliant; contract in `docs/contracts/init-telemetry.md`)
- [ ] Collect 5 case studies covering ≥3 distinct user-types (≥2 content, ≥1 consulting, ≥1 founder / ops); each documents specific workflow enabled with before/after metrics
- [ ] Case studies published in `docs/case-studies/` with anonymized metrics (e.g., "brief drafting: 90 min → 25 min, 73% time reduction")
- [ ] Verified: ≥3 of 5 case studies show top-10 skill invocations contain zero `test`, `deploy`, `ci` (proof of non-dev workflow, not disguised dev work)
- [ ] If < 5 case studies after 90 days from Phase 6 merge, run 10 user interviews with non-dev visitors who did not install; decision gate logged in `agents/eval-findings/` — pivot messaging vs. sunset non-dev expansion

**Exit:** 5 case studies merged, ≥3 user-types represented, telemetry contract published, success criteria verified.
**Rollback:** Phases 1–6 stay merged regardless of Phase 7 outcome. A "sunset" decision archives this roadmap and parks the non-dev work in `agents/roadmaps/skipped/` with a one-paragraph post-mortem citing the user-interview findings.

## Out of scope (Hard Refusals from AI-Council 2026-05-15)

These phases were proposed by external reviewers (GPT, Claude) and rejected by the Council. Listed here only to prevent re-litigation:

| Proposal | Verdict | Reason |
|---|---|---|
| Command Redesign (A.4) — `/dev/*`, `/content/*`, `/voice/*` | **Reject** | Violates STABILITY.md §3.2 (124 stable identifiers); agents use semantic search, not path hierarchies; step-5 router.json achieves discoverability via metadata |
| Council presets per domain (A.7) — founder-council, creator-council | **Reject** | Councils trigger on problem complexity, not user identity; same specialists review both; conflates WHO with WHAT |
| UI Control Plane (A.9) — Electron / web UI | **Reject** | Agent-config is explicitly "not a runtime"; host agents (Cursor, Claude Desktop) provide UI; scope violation |
| Memory Governance per domain (A.11) | **Reject** | Agent-config is stateless YAML / MD; memory is host-agent responsibility; impossible to govern what we don't control |
| Domain packs as separate npm packages (A.13) | **Reject for v2.x** | Splits single-source-of-truth; step-99 consolidates schema; revisit only post-v3 if `step-2` rationalization (210 → ≤160) doesn't solve overload |
| Marketplace / Pack Ecosystem (A.14) | **Reject** | Zero third-party packs exist; no ecosystem to warrant infrastructure; vapor work |
| Cross-reference verification as standalone phase (B.7) | **Reject as phase** | QA criterion, not deliverable; folded into Phases 2 + 5 exit criteria |
| Ghostwriter → `/voice` rename (A.5) | **Defer to v3.0** | `ghostwriter` is a public identifier in 47 files; STABILITY.md §3.2 forbids rename in v2.x; revisit at v3.0 gate with deprecation alias |

## Acceptance criteria

- [ ] Phases 1–7 closed with all checkboxes ticked
- [ ] `task ci` green
- [ ] `task lint-skills` green (including new `recommended_for_user_types` field validation)
- [ ] `task bench --corpus non-dev` reports selection-accuracy ≥ 0.60 sustained across two consecutive runs
- [ ] Five non-dev case studies merged in `docs/case-studies/` covering ≥3 distinct user-types
- [ ] Zero public identifier renames executed (STABILITY.md unchanged)
- [ ] `agents/roadmaps-progress.md` regenerated; this roadmap shows 100% closed
- [ ] All AI-Council "Hard Refusal" phases above remain absent from the codebase

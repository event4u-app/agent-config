---
complexity: lightweight
execution:
  mode: autonomous
---

# Roadmap: Cross-source consistency — detect discrepancies, ask before guessing

> When an agent plans, refines, roadmaps, or implements from multiple sources (ticket text, an attached image/mockup, the spec, the codebase), it actively checks them against each other and STOPS to ask the user before proceeding on a detected discrepancy — instead of silently guessing, even a correct guess. Gated by a global user setting, default on.

## Prerequisites

- [x] Read `AGENTS.md`, `src/rules/source-of-truth.md`, and `src/agent-src/templates/roadmaps.md`
- [x] Confirm `src/` is the single source of truth; never edit `dist/agent-src/`, `.claude/`, `.augment/` (regenerate via `/condense` + `task sync`)

## Context

**Why this exists (real incident).** Ticket COR-6547 (galawork "employee birthdays" dashboard tile): the ticket TEXT said "show employees who have their birthday **today**", but the attached MOCKUP showed a birthday from **2 days ago** — the two provided sources contradicted each other. A later ticket update added weekend-shifting. The implementing agent then also handled **public holidays** — factually correct, but NEITHER the ticket NOR the product owner specified it. The agent silently expanded scope on a good guess instead of asking. We want agents to catch such discrepancies during ticket planning, refinement, roadmap authoring, estimation, and implementation, and ASK the user.

**Discrepancy classes to catch:**
- **(a) text ↔ image** — ticket text contradicts an attached mockup / screenshot / diagram.
- **(b) silent-but-needed** — the spec is silent on a clearly-needed behavior (weekend/holiday shifting, empty/error states); surface it and ask before implementing rather than expanding scope silently.
- **(c) spec ↔ codebase/reality** — the spec contradicts what the code actually does.
- **(d) intra-ticket** — acceptance criteria vs description vs comments contradict each other.

**Architecture decision (see Council convergence in Notes).** A NEW `type: auto`, tier-2a rule `cross-source-consistency` + a mechanics guideline + a global default-on setting `consistency.cross_source`, plus scans wired into the ticket/planning skills, plus falsifiable evals. Deliberately NOT a new kernel/`always` rule (fails the >50%-of-turns test; the always-budget is hard-capped — 49k total / 6k per-rule / 12% concentration) and deliberately NOT a body-edit of the kernel rules `ask-when-uncertain` / `scope-control` (that would trigger the kernel-rule slow-rollout / 24h-soak gate and could not ship in one PR). The always-on property the user asked for is delivered by the **setting default = on**, exactly as `design.fidelity_mode` defaults to `strict`.

**No existing artefact covers this.** `ask-when-uncertain` fires on *missing* info, not two *present* conflicting sources; `design-fidelity` treats the mockup as authoritative (build 1:1) rather than flagging a text↔image conflict; `prompt-validator` / `media-sync-ground-truth` are the only real cross-source contradiction artefacts but are video-domain-locked. Reference architecture: `src/skills/prompt-validator/SKILL.md` (pre-spend contradiction gate).

- **Feature:** none (governance-suite capability)
- **Jira/Linear:** motivating incident COR-6547 (external project; not tracked here)

## Phase 1: Global setting (foundation)

- [x] **Step 1:** Add a new top-level `consistency:` block to `src/config/agent-settings.template.yml`, placed after the `design:` block, mirroring the `design.fidelity_mode` comment+enum convention. Key `cross_source` with tri-state `on | auto | off`, default `"on"` (QUOTED — YAML 1.1 coerces bare `on`/`off` to booleans; the schema requires a string). Names the consuming rule in the comment block.
- [x] **Step 2:** Registered `consistency.cross_source` in BOTH schemas — the JSON schema `src/scripts/schemas/agent-settings.schema.json` (enum constraint) AND the Zod schema `src/server/schemas/settings.ts` (`crossSourceMode` enum + `.default('on')`, never `optional()`, per the settings-schema downstream contract). `validate_agent_settings` passes. <!-- verify: ./scripts-run src/scripts/validate_agent_settings 2>&1 | tail -3 -->
- [x] **Step 3:** Rebuilt the install bundle (`npm run build:install-bundle`) so the new key ships to consumers; `cross_source` now present in `dist/install/install.mjs`. <!-- verify: grep -c "cross_source" dist/install/install.mjs -->
- [x] **Step 4:** No central settings-key table exists in `docs/` (behavioral toggles like `fidelity_mode` are documented in the template comment block + the consuming rule/guideline). The `consistency` block's template comment + the Phase-2 guideline document the key; nothing orphaned.

## Phase 2: The rule + mechanics guideline

- [x] **Step 1:** Create `src/rules/cross-source-consistency.md` as `type: auto`, `tier: 2a`, `source: package`. Frontmatter per `src/scripts/schemas/rule.schema.json`: `description` (≤190 chars); `triggers:` keywords (`ticket`, `refine`, `acceptance criteria`, `AC`, `mockup`, `screenshot`, `attachment`, `roadmap`, `implement`, `estimate`) + phrases (`plan this ticket`, `is this ticket clear`, `refine this ticket`); `routes_to: [guideline:agent-infra/cross-source-consistency-mechanics]`; `workspaces: [engineering, product]`; `packs: [engineering-base, product-basic]`. Model the body shape on `src/rules/media-sync-ground-truth.md` + `src/rules/design-fidelity.md`. <!-- verify: ./scripts-run src/scripts/validate_frontmatter src/rules/cross-source-consistency.md 2>&1 | tail -5 -->
- [x] **Step 2:** In the rule body, write the Iron Law (detect cross-source discrepancy / silent-scope-expansion → surface + ask; a correct silent guess is still a violation) + a short "When it fires / When NOT to fire" + the setting gate (`consistency.cross_source`). Keep the body thin; migrate detail to the guideline (P4 pattern).
- [x] **Step 3:** Write the subordination clauses explicitly, so the rule does NOT double-fire (Anthropic council concern): (i) **subordinate to `ask-when-uncertain`** — fold any detected discrepancy into the SAME turn's single question; never emit a second numbered block (one-question-per-turn holds); (ii) **defer to `scope-control`** as the permission authority for the type-(b) silent-scope-expansion case; (iii) **precedence vs `design-fidelity`** — discrepancy-detection fires FIRST (decision time: "text says X, mockup says Y — which wins?"); once resolved, `design-fidelity` governs build-time 1:1 fidelity; (iv) **pass the `no-cheap-questions` Pre-Send Self-Check** — only fire on a genuine contradiction / silent-expansion with a real trade-off, never a content-free "are you sure?".
- [x] **Step 4:** Add a single `## See also` cross-reference FROM the new rule TO `ask-when-uncertain`, `scope-control`, `design-fidelity`, `active-remediation`, `no-cheap-questions` (one-directional; do NOT edit those kernel rule bodies).
- [x] **Step 5:** Create `docs/guidelines/agent-infra/cross-source-consistency-mechanics.md`: the discrepancy taxonomy (a/b/c/d with one-line definitions); the scan procedure (compare ticket text against every attached image/mockup; scan the spec for silent-but-needed behaviors; check spec vs codebase; check intra-ticket AC vs description); the confidence-tiered noise control (on=all real contradictions; auto=high-confidence only; off=legacy) + the single-batched-question shape; the two worked examples (birthday text↔mockup; weekend→holiday silent-expansion); the precedence/subordination table vs the neighbouring rules. <!-- verify: test -f docs/guidelines/agent-infra/cross-source-consistency-mechanics.md && echo OK -->

## Phase 3: Wire the scan into the ticket/planning surfaces

- [x] **Step 1:** `src/skills/refine-ticket/SKILL.md` — extend the §2 "inspect ticket" step (which already asks "does the summary match the description body?") with: text-vs-**attached-image** check, silent-but-needed-behavior scan, spec-vs-codebase check; add attachment/image awareness (currently none). Reference the guideline. Add `cross_source` trigger entries to `src/skills/refine-ticket/detection-map.yml` if that file governs its detection.
- [x] **Step 2:** `src/skills/po-discovery/SKILL.md` — extend the existing "AC missing / contradictory / as impl-steps" check to include text-vs-screenshot and silent-but-needed behaviors; reference the guideline.
- [x] **Step 3:** `src/skills/feature-planning/SKILL.md` — in "Gather requirements" / "Open questions", surface silent-but-needed behaviors (type b) before roadmapping; reference the guideline.
- [x] **Step 4:** `src/domains/engineering-base/implement-ticket/command.md` — route a detected discrepancy into the existing block-on-ambiguity halt (exit 1 → `questions[0]`, "never guess"); a discrepancy is a blocking question, not a silent resolution. Reference the guideline.
- [x] **Step 5:** `src/skills/estimate-ticket/SKILL.md` — a detected discrepancy raises the uncertainty output / triggers a clarifying question rather than a point estimate over a contradictory spec. Reference the guideline (lighter hook).
- [x] **Step 6:** `src/skills/roadmap-writing/SKILL.md` — when a roadmap is authored from a ticket carrying attachments, run the scan before drafting phases; reference the guideline (lighter hook).

## Phase 4: Falsifiable behavior — worked examples (planned eval mechanisms didn't fit)

> **Execution finding.** Both eval mechanisms this phase planned turned out
> not to apply to a rule of this shape — surfaced and adapted rather than
> forced (per `decision-revisit-gate` / honest-enforcement):
> - the trigger-eval harness (`check_trigger_eval_presence` / `skill_trigger_eval`)
>   is **skills-only** (`SKILLS_DIR = src/skills`); rules are not covered, so a
>   rule trigger-eval has no recognized home;
> - the golden-outcome baselines are a **contract-locked** set of 3 sharp-Iron-Law
>   rules (`tests/golden/outcomes/README.md`); adding a 4th requires "two release
>   cycles green" (impossible for a new fixture) and the README explicitly
>   disqualifies situation-dependent rules (names `scope-control`). A
>   cross-source-detection signal needs semantic understanding, not the ≤50-LOC
>   regex scorer.
> The falsifiable specification therefore lives in the guideline's two worked
> examples, and the golden-baseline deferral is recorded in the README's own
> "Deferred candidates" section for future revisit.

- [-] **Step 1:** Trigger evals for the rule — NOT APPLICABLE. <!-- cancelled: the trigger-eval presence-ratchet + harness are skills-only (src/scripts/check_trigger_eval_presence.ts iterates src/skills); rules with triggers are not covered. Verified: the presence-check flags only pre-existing skill gaps (docx-authoring, pdf-tools), never this rule. -->
- [-] **Step 2:** Golden outcome fixtures — NOT ADDED (contract-locked); documented as a deferred candidate instead. <!-- cancelled: tests/golden/outcomes/README.md caps baselines at 3 sharp-Iron-Law rules and requires "two release cycles green" (unmeetable for a new fixture) + disqualifies situation-dependent rules. Added cross-source-consistency to the README "Deferred candidates" section with the reason. Falsifiable spec = the two worked examples in cross-source-consistency-mechanics.md. -->
- [x] **Step 3:** Falsifiable behavior delivered: the birthday (text↔image) and weekend→holiday (silent-expansion) scenarios are encoded as wrong/right worked examples in `docs/guidelines/agent-infra/cross-source-consistency-mechanics.md`, and the golden-baseline deferral is recorded in `tests/golden/outcomes/README.md`. <!-- verify: grep -q "birthday" docs/guidelines/agent-infra/cross-source-consistency-mechanics.md && grep -q "cross-source-consistency" tests/golden/outcomes/README.md && echo FALSIFIABLE-SPEC-OK -->
- [x] **Step 4:** Confirmed the pre-existing `check-trigger-eval-presence` reds (docx-authoring, pdf-tools) are baseline on `origin/main` and out of this roadmap's scope (`minimal-safe-diff` — not fixed drive-by).

## Phase 5: Integrate, regenerate projections, and verify

- [x] **Step 1:** Update any always-loaded counts / rule-index / cross-reference tables affected by adding one rule + one guideline (per `augment-edit-discipline` sync Iron Law): rule count references, `docs/guidelines` index, `docs/customization.md`. <!-- verify: ./scripts-run src/scripts/check_refs 2>&1 | tail -5 -->
- [x] **Step 2:** Run `/condense` (src → dist/agent-src) for the new rule + guideline; NEVER hand-edit the projections. <!-- verify: bash src/scripts/condense.sh --changed 2>&1 | tail -5 -->
- [x] **Step 3:** Regenerate per-tool projections: `task sync` then `task generate-tools`. <!-- verify: git -C . status --short | grep -E "\.claude/|\.cursor/|\.augment/|dist/" | head -3 -->
- [x] **Step 4:** Run the narrow, targeted lints for the touched surfaces (NOT the full `task ci` pipeline — `quality.local_auto_run` is false, per `roadmap-ci-steps-policy`): rule-schema / frontmatter validation, always-budget check (must be a no-op — new rule is `auto`, not `always`), skill linter on the touched skills, framework-neutrality lint (rule/guideline/skills must stay stack-neutral), size-enforcement, reference checker. <!-- verify: ./scripts-run src/scripts/validate_frontmatter src/rules/cross-source-consistency.md 2>&1 | tail -3 -->

## Acceptance Criteria

- [x] `consistency.cross_source` exists in `src/config/agent-settings.template.yml` (default `on`) and validates against the settings schema.
- [x] `src/rules/cross-source-consistency.md` exists as `type: auto`, tier 2a, passes `validate_frontmatter`, and does NOT touch any kernel/`always` rule body.
- [x] `docs/guidelines/agent-infra/cross-source-consistency-mechanics.md` exists with the a/b/c/d taxonomy, scan procedure, confidence-tiered noise control, and the two worked examples.
- [x] The scan is referenced from refine-ticket, po-discovery, feature-planning, implement-ticket, estimate-ticket, roadmap-writing.
- [x] Falsifiable behavior is specified: the birthday (text↔image) and holiday (silent-expansion) scenarios are worked examples in the mechanics guideline (trigger-eval + golden-outcome mechanisms were found not to fit a rule of this shape — see Phase 4; golden-baseline deferral recorded in `tests/golden/outcomes/README.md`).
- [x] `always`-budget check is unchanged (no kernel growth); `check_refs` reports no broken references; framework-neutrality + size lints pass on the new artefacts.
- [x] `dist/agent-src/` + per-tool projections regenerated (no stale-hash drift).

## Notes

**Council convergence (2026-07-14, members: claude-sonnet-4-5 + gpt-4o, prompt-mode design, 2 rounds).** The council SPLIT. `claude-sonnet-4-5` argued against a new rule (vagueness↔contradiction is operationally blurry → double-firing with `ask-when-uncertain` at shared hook points; the holidays case is scope-expansion already owned by `scope-control`) and preferred extending `ask-when-uncertain` (add a `conflicting_source_authority` trigger) + strengthening `scope-control` (inferred-requirement gate). `gpt-4o` supported a new rule but demanded confidence-tiered noise control (critical vs trivial contradictions). Convener synthesis adopted here: a new `auto` rule (NOT a kernel-body edit — keeps it out of the kernel slow-rollout so it ships in one PR, and gives the concept a single home + user-facing setting, which a pure trigger-extension cannot) that is **explicitly subordinated** to `ask-when-uncertain` (folds into the one-question-per-turn → no double-fire, Anthropic's core concern) and **defers to `scope-control`** for the silent-expansion permission; gpt-4o's noise control is delivered by the `on/auto/off` confidence tiers + the single batched question; and Anthropic's "evidence that would change my mind" is delivered by the Phase-4 falsifiable evals + golden fixtures. If the evals later show the `auto` rule under-fires or double-fires in practice, the fallback is Anthropic's pure trigger-extension of `ask-when-uncertain` + `scope-control` (a kernel-slow-rollout change, its own PR).

**Boundaries — do NOT touch:** the kernel rule bodies (`ask-when-uncertain.md`, `scope-control.md`) — reference them one-directionally only; the video-domain artefacts (`prompt-validator`, `media-sync-ground-truth`) — model on them, don't edit; the finance/media source-quality rules. Keep every new artefact framework-neutral (no Laravel/Symfony/Next specifics) and English-only.

**Delivery:** this roadmap is implementation-only. No commit/push/PR steps are authored here (per `commit-policy`); the final PR is created after execution completes, on the user's standing authorization for this task.

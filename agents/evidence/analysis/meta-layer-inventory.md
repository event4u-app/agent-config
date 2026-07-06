<!-- analyzed: 2026-07-06 | commit: 95648928a | files: 370 -->
# Meta-Layer / Concept-Surface Inventory

> Read-only discovery output for `agents/roadmaps/road-to-leaner-core-and-discovery.md` Phase 1.
> Counts are grep/git-backed via `scripts/inventory_meta_layers.py`. A row is an *overlap candidate*
> when one concept (a shared filename token) is defined across ≥ 2 stable surfaces.

## Summary

| Metric | Value |
|---|---:|
| Always-loaded kernel rule families | 10 |
| tier_1 (balanced) rules | 24 |
| tier_2 (full) rules | 55 |
| Rules carrying Iron-Law headings | 53 |
| Total Iron-Law headings across rules | 65 |
| Concept surfaces scanned (rule/contract/guideline/context) | 370 |
| Concept overlap candidates (≥ 2 surfaces, cross-kind/contract-dup) | 33 |

Kernel: agent-authority, ask-when-uncertain, commit-policy, direct-answers, language-and-tone, no-cheap-questions, non-destructive-by-default, scope-control, user-interrupt-priority, verify-before-complete

## Iron-Law density per rule (top 15)

| Rule | Iron Laws |
|---|---:|
| `no-cheap-questions` | 4 |
| `direct-answers` | 3 |
| `git-history-discipline` | 3 |
| `legal-safety-floor` | 3 |
| `roadmap-progress-sync` | 3 |
| `user-interaction` | 2 |
| `ask-when-uncertain` | 1 |
| `brand-consistency` | 1 |
| `brand-source-of-truth` | 1 |
| `command-suggestion-policy` | 1 |
| `commit-policy` | 1 |
| `delegation-policy` | 1 |
| `design-fidelity` | 1 |
| `domain-adoption-policy` | 1 |
| `domain-safety-disclaimer` | 1 |

## Concept-overlap ledger

> One row per concept defined in ≥ 2 surfaces. `overlap=Y` = cross-kind or duplicate-contract
> (genuine merge/delete candidate). `seeded` = a feedback-named meta-layer family.
> Classification (merge / delete / keep-with-reason) is filled in Step 2 — left blank here.

| Concept | Surfaces | # | Kinds | Lines | Last touched | Overlap | Class |
|---|---|---:|---|---:|---|---|---|
| `floor-safety` | dist/agent-src/rules/engineering-safety-floor.md; dist/agent-src/rules/finance-safety-floor.md; dist/agent-src/rules/legal-safety-floor.md; dist/agent-src/rules/strategy-safety-floor.md | 4 | rule | 495 | 2026-06-27 | family | _unclassified_ |
| `mcp` | docs/contracts/mcp-cloud-scope.md; docs/contracts/mcp-discovery-phase-notice.md; docs/contracts/mcp-phase-1-scope.md | 3 | contract | 615 | 2026-06-11 | Y | _unclassified_ |
| `context-spine` | docs/contracts/adr-gtm-context-spine.md; docs/contracts/adr-wing4-context-spine.md; docs/contracts/context-spine.md | 3 | contract | 424 | 2026-06-04 | Y | _unclassified_ |
| `user` | docs/contracts/adr-install-user-type-axis.md; docs/contracts/adr-user-types-axis.md; docs/contracts/user-type-schema.md | 3 | contract | 383 | 2026-06-06 | Y | _unclassified_ |
| `domain-safety` | dist/agent-src/rules/domain-safety-disclaimer.md; dist/agent-src/rules/domain-safety-pii.md; dist/agent-src/rules/domain-safety-retention.md | 3 | rule | 379 | 2026-06-27 | family | _unclassified_ |
| `command-suggestion` | dist/agent-src/contexts/contracts/command-suggestion-flow.md; dist/agent-src/rules/command-suggestion-policy.md; docs/contracts/adr-command-suggestion.md | 3 | context,contract,rule | 342 | 2026-06-06 | Y | _unclassified_ |
| `quality-skill` | dist/agent-src/contexts/communication/rules-auto/skill-quality-mechanics.md; dist/agent-src/rules/skill-quality.md; docs/guidelines/agent-infra/skill-quality-checklist.md | 3 | context,guideline,rule | 305 | 2026-06-13 | Y | _unclassified_ |
| `answers-direct` | dist/agent-src/rules/direct-answers.md; docs/contracts/pilot/direct-answers.md; docs/guidelines/agent-infra/direct-answers-demos.md | 3 | contract,guideline,rule | 281 | 2026-06-21 | Y | _unclassified_ |
| `language-tone` | dist/agent-src/rules/language-and-tone.md; docs/contracts/pilot/language-and-tone.md; docs/guidelines/agent-infra/language-and-tone-examples.md | 3 | contract,guideline,rule | 271 | 2026-06-09 | Y | _unclassified_ |
| `source-truth` | dist/agent-src/contexts/communication/rules-auto/source-of-truth-mechanics.md; dist/agent-src/rules/brand-source-of-truth.md; dist/agent-src/rules/source-of-truth.md | 3 | context,rule | 249 | 2026-06-24 | Y | _unclassified_ |
| `gate-onboarding` | dist/agent-src/rules/linked-projects-onboarding-gate.md; dist/agent-src/rules/onboarding-gate.md; docs/guidelines/agent-infra/linked-projects-onboarding-gate.md | 3 | guideline,rule | 144 | 2026-06-11 | Y | _unclassified_ |
| `implement-ticket` | docs/contracts/adr-implement-ticket-runtime.md; docs/contracts/implement-ticket-flow.md | 2 | contract | 748 | 2026-06-21 | Y | _unclassified_ |
| `mental-models` | docs/contracts/mental-models.md; docs/guidelines/agent-infra/mental-models.md | 2 | contract,guideline | 652 | 2026-06-13 | Y | _unclassified_ |
| `context-load` | docs/contracts/load-context-budget-model.md; docs/contracts/load-context-schema.md | 2 | contract | 481 | 2026-06-06 | Y | _unclassified_ |
| `progress-roadmap` | dist/agent-src/rules/roadmap-progress-sync.md; docs/guidelines/agent-infra/roadmap-progress-mechanics.md | 2 | guideline,rule | 335 | 2026-06-16 | Y | _unclassified_ |
| `artifact-engagement` | dist/agent-src/contexts/contracts/artifact-engagement-flow.md; dist/agent-src/rules/artifact-engagement-recording.md | 2 | context,rule | 315 | 2026-06-27 | Y | _unclassified_ |
| `installed-tools` | docs/contracts/installed-tools-lockfile.md; docs/guidelines/agent-infra/installed-tools-manifest.md | 2 | contract,guideline | 288 | 2026-06-04 | Y | _unclassified_ |
| `settings-sync` | docs/contracts/adr-settings-sync-engine.md; docs/contracts/settings-sync-yaml-subset.md | 2 | contract | 269 | 2026-06-05 | Y | _unclassified_ |
| `cross-handoff` | docs/contracts/cross-wing-handoff.md; docs/guidelines/cross-role-handoff.md | 2 | contract,guideline | 263 | 2026-05-26 | Y | _unclassified_ |
| `surface-tiers` | docs/contracts/command-surface-tiers.md; docs/contracts/surface-tiers.md | 2 | contract | 259 | 2026-06-17 | Y | _unclassified_ |
| `interaction-user` | dist/agent-src/contexts/communication/rules-auto/user-interaction-mechanics.md; dist/agent-src/rules/user-interaction.md | 2 | context,rule | 255 | 2026-06-11 | Y | _unclassified_ |
| `before-complete` | dist/agent-src/rules/verify-before-complete.md; docs/guidelines/agent-infra/verify-before-complete-demos.md | 2 | guideline,rule | 208 | 2026-06-09 | Y | _unclassified_ |
| `ask-uncertain` | dist/agent-src/rules/ask-when-uncertain.md; docs/guidelines/agent-infra/ask-when-uncertain-demos.md | 2 | guideline,rule | 206 | 2026-06-09 | Y | _unclassified_ |
| `lifecycle-provider` | dist/agent-src/rules/provider-lifecycle-discipline.md; docs/contracts/provider-lifecycle.md | 2 | contract,rule | 204 | 2026-06-16 | Y | _unclassified_ |
| `corpus-impact` | dist/agent-src/rules/low-impact-corpus-privacy-floor.md; docs/contracts/low-impact-corpus-format.md | 2 | contract,rule | 174 | 2026-06-06 | Y | _unclassified_ |
| `input-untrusted` | dist/agent-src/rules/untrusted-input-defense.md; docs/guidelines/agent-infra/untrusted-input-spotlighting.md | 2 | guideline,rule | 153 | 2026-06-27 | Y | _unclassified_ |
| `mode-role` | dist/agent-src/rules/role-mode-adherence.md; docs/guidelines/agent-infra/role-mode-router.md | 2 | guideline,rule | 152 | 2026-06-06 | Y | _unclassified_ |
| `action-before` | dist/agent-src/contexts/communication/rules-auto/think-before-action-mechanics.md; dist/agent-src/rules/think-before-action.md | 2 | context,rule | 150 | 2026-06-15 | Y | _unclassified_ |
| `mcp-tool` | docs/contracts/mcp-tool-inventory.md; docs/contracts/mcp-tool-stub-envelope.md | 2 | contract | 133 | 2026-06-14 | Y | _unclassified_ |
| `efficiency-token` | dist/agent-src/contexts/communication/rules-auto/token-efficiency-mechanics.md; dist/agent-src/rules/token-efficiency.md | 2 | context,rule | 132 | 2026-06-06 | Y | _unclassified_ |
| `command-routing` | dist/agent-src/contexts/communication/rules-auto/slash-command-routing-policy-mechanics.md; dist/agent-src/rules/slash-command-routing-policy.md | 2 | context,rule | 114 | 2026-06-13 | Y | _unclassified_ |
| `governance-type` | dist/agent-src/rules/rule-type-governance.md; docs/guidelines/agent-infra/rule-type-governance.md | 2 | guideline,rule | 95 | 2026-06-06 | Y | _unclassified_ |
| `coding-php` | dist/agent-src/rules/php-coding.md; docs/guidelines/php/php-coding-patterns.md | 2 | guideline,rule | 92 | 2026-06-06 | Y | _unclassified_ |
| `handling-missing` | dist/agent-src/rules/missing-tool-handling.md; docs/guidelines/agent-infra/missing-tool-handling.md | 2 | guideline,rule | 90 | 2026-06-11 | Y | _unclassified_ |
| `agent-authority` | dist/agent-src/rules/agent-authority.md; docs/contracts/pilot/agent-authority.md | 2 | contract,rule | 53 | 2026-06-06 | Y | _unclassified_ |

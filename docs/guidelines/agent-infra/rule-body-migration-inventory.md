# Rule Body Migration Inventory

> Full classification of every `src/rules/*.md` file against the P4 pattern
> (thin Iron-Law stub + `Body migrated to skill:X / guideline:Y` routing
> line) — done vs. not-yet-done vs. must-never-be-done, with concrete
> target homes for the not-yet-done set.

_Compiled: 2026-07-12 · Scope: `src/rules/*.md` only (104 files) · Method
below._

## Method

1. Read every rule's frontmatter (`type`, `alwaysApply`, `tier`) and body
   line count via `wc -l`.
2. Checked kernel membership against
   [`docs/contracts/kernel-membership.md`](../../contracts/kernel-membership.md)
   § 4 — the 9 rules currently carrying `type: "always"` /
   `alwaysApply: true` are the live kernel (`user-interrupt-priority` was
   demoted from the kernel back to `type: auto` on 2026-07-06 per that
   contract's provenance log, so it is **not** counted as kernel here even
   though an earlier section of the same contract still labels it the
   "10th kernel rule" — frontmatter is ground truth).
3. Grepped case-insensitively for `migrated to` across `src/rules/*.md` to
   find rules that already point their body at a skill/guideline/context —
   including near-variants of the exact P4 phrase (`Portability body
   migrated to …`, `Sync body migrated to …`).
4. For rules **without** that marker, read the full body (already present
   verbatim in-session from the `dist/agent-src/rules/` projection, which
   preserves Iron Laws byte-for-byte and body structure per
   `preservation-guard`) and judged: is the non-Iron-Law content (a)
   already effectively a thin routing hub even without the literal phrase
   (e.g. `source-of-truth.md`'s "Mechanics — … live in
   `[…]`" pointer), (b) a tight, load-bearing enforcement surface — a
   table, a literal-string marker set, a short numbered check — that
   doesn't shrink usefully by relocating, or (c) genuine bulk (worked
   examples, rationale essays, multi-step procedures, failure-mode
   catalogs) with either an existing skill/guideline that already
   half-references it, or an obvious net-new location.
5. For every `should-migrate` candidate, verified the named target file
   actually exists (`ls`/`find`) before citing it as "existing"; targets
   that don't exist are marked "new guideline needed".

## Classification table

Legend: **class** = `thin` (already-thin) / `migrate` (should-migrate) /
`stay` (must-stay-monolithic). **Kernel?** = Y only for the 9 live
always-loaded rules.

| rule | class | body lines | kernel? | target home | note |
|---|---|---:|:---:|---|---|
| active-remediation.md | migrate | 92 | | new guideline: `docs/guidelines/agent-infra/active-remediation-mechanics.md` | ladder detail, version-gated modernization, guardrails prose extractable; Iron Law + ladder tiers + live-security carve-out stay |
| agent-authority.md | stay | 26 | Y | — | kernel priority index; body IS the routing table |
| analysis-skill-routing.md | thin | 20 | | `skill:analysis-skill-router` (existing) | pure P4 stub |
| architecture.md | migrate | 96 | | `skill:module-detect-on-the-fly` (existing) | Project Detection / Build-Runner Detection / Module & Package docs sections migratable; keep Iron Law + General Principles (already pointer-heavy to laravel/symfony/nextjs skills) |
| artifact-drafting-protocol.md | migrate | 122 | | new guideline: `docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md` | Phase A/B/C detail + roadmap batch-mode carve-out extractable; keep Iron Law + phase headers + golden rules |
| artifact-engagement-recording.md | thin | 52 | | `contexts/contracts/artifact-engagement-flow.md` (existing) | routes via "Recording contract + privacy floor: […]" phrasing, functionally P4 |
| ask-when-uncertain.md | stay | 66 | Y | — | kernel Iron Law + ask-policy floor |
| augment-edit-discipline.md | thin | 29 | | `guideline:augment-portability-patterns` + `skill:agent-docs-writing` (both existing) | two explicit "body migrated to" sentences |
| autonomous-execution.md | thin | 81 | | `contexts/execution/autonomy-mechanics.md` + siblings (existing) | hybrid: several short Iron-Law-style blocks retained (Hard Floor pointer, N=3 budget headline), full mechanics already migrated |
| brand-consistency.md | stay | 75 | | — | gate definition is the enforcement surface itself; already routes deeper mechanics to `brand-identity`/`brand-to-tokens`/`design-intelligence` |
| brand-source-of-truth.md | stay | 65 | | — | explicitly "light by design"; precedence order is the whole rule |
| broken-access-control.md | thin | 68 | | `skill:authz-review` (existing) | hybrid: 2 short Iron-Law blocks (3 negative tests) retained, deep controls/matrix/backstop-grep content already migrated |
| cli-output-handling.md | thin | 40 | | `skill:rtk-output-filtering` (existing) | pure P4 stub |
| code-comment-discipline.md | migrate | 148 | | `docs/guidelines/code-clarity.md` (existing) | already cross-references this guideline as "canonical long-form"; 3 worked-example code blocks + carve-out detail duplicate it and can move, keeping Iron Law + banned-class table + scope boundary |
| command-suggestion-policy.md | stay | 47 | | — | tier `mechanical-already`; single Iron Law + 5-item subordination list is the whole enforcement surface |
| commit-conventions.md | thin | 20 | | `skill:conventional-commits-writing` (existing) | pure P4 stub |
| commit-policy.md | stay | 67 | Y | — | kernel Iron Law + commit exceptions |
| communication-through-line.md | stay | 42 | | — | short; 5-item checkable-behaviors list is the whole rule |
| content-quoting-floor.md | stay | 88 | | — | the 5 numbered floor rules + carve-outs ARE the enforcement; failure-modes list is short (4 bullets), not worth extracting |
| context-hygiene.md | migrate | 186 | | new guideline: `docs/guidelines/agent-infra/context-hygiene-mechanics.md` | **longest rule in the tree**; hook-fallback prose, state-dump template, Copilot-fallback procedure, Augment ignored-skills recovery all extractable; keep Iron-Law-style freshness/3-failure/loop-detection triggers |
| copilot-routing.md | thin | 20 | | `skill:copilot-config` (existing) | pure P4 stub |
| decision-revisit-gate.md | migrate | 128 | | `skill:decision-review` (existing) | lock-type catalog + failure-mode catalog extractable; keep Iron Law + "what to do when it fires" steps + "when NOT to fire" |
| delegation-policy.md | stay | 96 | | — | already a routing hub in all but name — 6 numbered obligations, each 1–2 lines pointing at an existing context file (`auto-orchestration-activation.md`, `subagent-steering.md`, etc.) |
| design-fidelity.md | migrate | 140 | | new guideline: `docs/guidelines/design-fidelity-mechanics.md` | "Surgical visual edits" + "Asset & imagery discipline" + failure-mode catalog are substantial illustrative content; keep Iron Law + strictness-mode table + when-fires/not |
| devcontainer-routing.md | thin | 21 | | `skill:devcontainer` (existing) | pure P4 stub |
| direct-answers.md | stay | 62 | Y | — | kernel — 3 Iron Laws |
| docker-commands.md | thin | 21 | | `skill:docker` (existing) | pure P4 stub |
| domain-adoption-policy.md | migrate | 158 | | new guideline: `docs/guidelines/agent-infra/domain-adoption-gates.md` | 3-gate rationale essays + "what to do when gates fail" procedure + failure-mode catalog are substantial and rarely-fired (only on new-domain proposals); keep Iron Law + 3 gate names |
| domain-safety-disclaimer.md | stay | 117 | | — | domain safety floor |
| domain-safety-pii.md | stay | 166 | | — | domain safety floor (2nd-longest rule; 4-surface redaction tables ARE the enforcement) |
| domain-safety-retention.md | stay | 87 | | — | domain safety floor |
| downstream-changes.md | stay | 80 | | — | the "what to check" table + breaking-change lists ARE the checklist |
| engineering-safety-floor.md | stay | 91 | | — | domain safety floor |
| external-code-graph-interop.md | stay | 65 | | — | narrow, tight; numbered steps are the whole rule |
| external-reference-deep-dive.md | stay | 70 | | — | failure-mode catalog + case-zero anchor are load-bearing recognition material, not filler; below the bulk threshold applied elsewhere |
| fast-path-marker-visibility.md | stay | 83 | | — | body IS literal marker strings the agent must reproduce verbatim; cannot be paraphrased into a skill |
| finance-safety-floor.md | stay | 103 | | — | domain safety floor |
| framework-neutrality-in-generic-skills.md | migrate | 131 | | new guideline: `docs/guidelines/agent-infra/framework-neutrality-patterns.md` | 10-row forbidden-pattern table + cross-stack/carve-out examples extractable; keep Iron Law + scope + enforcement pointer (linter is the backstop either way) |
| git-history-discipline.md | thin | 90 | | `skill:git-workflow` (existing) | hybrid: 3 short Iron-Law blocks retained, full mechanics already migrated |
| guidelines.md | thin | 30 | | `contexts/communication/rules-auto/guidelines-mechanics.md` (existing) | "Index — see mechanics" pointer, functionally P4 |
| icon-consistency.md | stay | 52 | | — | tight; already routes deeper mechanics to `iconography` skill |
| image-likeness-and-rights.md | stay | 65 | | — | explicit "Compose — do NOT duplicate" section pointing at 5 media policy files; gate table is short |
| improve-before-implement.md | migrate | 124 | | `docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md` (existing) | already cross-referenced twice ("no blind implementation"); worked-example block + scope-limits detail extractable |
| invite-challenge.md | stay | 72 | | — | worked-example block is short and essential; below bulk threshold |
| language-and-tone.md | stay | 62 | Y | — | kernel Iron Law |
| laravel-routing.md | thin | 26 | | `skill:laravel` (existing) | pure P4 stub |
| laravel-translations.md | thin | 26 | | `skill:laravel` (existing) | pure P4 stub |
| legal-safety-floor.md | stay | 134 | | — | domain safety floor — but note: already the **best existing exemplar** of the P4 pattern applied *within* a safety floor (5 Iron Laws kept inline, all operating mechanics migrated to `skill:legal-practice-profile`); a template for the other 6 safety floors below, none of which do this yet |
| lethal-trifecta-guard.md | stay | 86 | | — | conceptual (3 legs) + short decision list; no removable bulk |
| linked-projects-onboarding-gate.md | thin | 35 | | `guideline:agent-infra/linked-projects-onboarding-gate` (existing) | pure P4 stub |
| low-impact-corpus-privacy-floor.md | stay | 77 | | — | 8-class forbidden-content table IS the redactor spec (mirrors `scripts/ai_council/redact_low_impact_entry.ts`) |
| markdown-safe-codeblocks.md | stay | 23 | | — | trivial |
| media-governance-routing.md | stay | 83 | | — | already a routing rule by design (7 pointers into `agents/settings/policies/media/`); rationale essay is short |
| media-sync-ground-truth.md | stay | 74 | | — | 6-step procedure is the whole rule |
| minimal-safe-diff.md | migrate | 166 | | new guideline: `docs/guidelines/agent-infra/minimal-safe-diff-mechanics.md` | **tied-longest rule**; "Anti-over-engineering", "Own-orphan cleanup", "Break-glass exception", "Bounded remediation carve-out" are each self-contained essays with worked criteria; keep Iron Law + "the rule" + "before writing the diff" + red flags |
| missing-tool-handling.md | thin | 20 | | `guideline:agent-infra/missing-tool-handling` (existing) | pure P4 stub |
| model-recommendation.md | thin | 23 | | `guideline:agent-infra/model-recommendation` (existing) | pure P4 stub |
| no-attribution-footers.md | stay | 55 | | — | short; forbidden-pattern list is the check |
| no-cheap-questions.md | stay | 72 | Y | — | kernel — 6 Iron Laws + self-check |
| no-decorative-emojis-in-git-surfaces.md | stay | 110 | | — | whitelist/blacklist/legend-carve-out tables ARE the enforcement surface, must stay verbatim |
| no-pr-progress-comments.md | stay | 105 | | — | gated/not-gated lists ARE the enforcement surface |
| no-roadmap-references.md | migrate | 139 | | `skill:agent-docs-writing` (existing) | already cross-referenced ("roadmap layer conventions"); structural-carveout table + 4-step "what to do instead" + narrative failure modes extractable |
| non-destructive-by-default.md | stay | 59 | Y | — | kernel Hard Floor |
| notes-first-reasoning.md | stay | 69 | | — | structural section list is the whole rule |
| onboarding-gate.md | stay | 31 | | — | trivial |
| output-discipline.md | stay | 83 | | — | banned-placeholder-pattern table IS the enforcement surface (mirrors `lint_output_slop.ts`) |
| package-ci-checks.md | thin | 20 | | `skill:lint-skills` (existing) | pure P4 stub |
| persona-governance.md | migrate | 91 | | `docs/contracts/persona-schema.md` (existing) | already routes schema/catalog there; "four checks" full elaboration + day-one historical note extractable, keep Iron Law + check names + failure modes |
| php-coding.md | thin | 25 | | `guideline:php/php-coding-patterns` (existing) | pure P4 stub |
| prefer-enums-over-literals.md | stay | 65 | | — | all content directly operative (when/when-not/how); no removable bulk |
| preservation-guard.md | stay | 95 | | — | body IS the condensation-quality checklist consumed by `check_condensation.ts` |
| provider-lifecycle-discipline.md | migrate | 78 | | `docs/contracts/provider-lifecycle.md` (existing) | already the primary reference; "why agent-in-the-loop, not Python gate" rationale essay + day-one state note extractable |
| question-not-instruction.md | stay | 76 | | — | short "the trap" narrative + 3-step protocol is the whole rule |
| reviewer-awareness.md | thin | 27 | | `skill:review-routing` (existing) | pure P4 stub |
| roadmap-ci-steps-policy.md | migrate | 155 | | `contexts/execution/roadmap-process-loop.md` (existing) | already cross-referenced ("§5 owns the inline-skip mechanics"); forbidden-pattern table + authoring/execution procedure detail extractable |
| roadmap-progress-sync.md | thin | 90 | | `guideline:agent-infra/roadmap-progress-mechanics` (existing) | hybrid: 3 Iron Laws + PR-gate + mandatory pre-send self-check retained, long-form detail already migrated |
| role-mode-adherence.md | stay | 59 | | — | short; already delegates contract detail to `docs/guidelines/agent-infra/role-contracts.md` |
| rule-type-governance.md | thin | 18 | | `guideline:agent-infra/rule-type-governance` (existing) | pure P4 stub |
| runtime-safety.md | stay | 49 | | — | trivial |
| scope-control.md | stay | 67 | Y | — | kernel — git-ops permission gate |
| security-sensitive-stop.md | stay | 103 | | — | surface table + "what to do when it fires" table + memory-lookup command block ARE the enforcement surface; security-critical, kept loaded rather than gated behind a fetch |
| senior-engineering-discipline.md | stay | 82 | | — | already delegates deep detail to `skill:ai-code-blindspots`; remaining prose is the anchor summary |
| size-enforcement.md | stay | 35 | | — | trivial |
| skill-improvement-trigger.md | thin | 20 | | `skill:skill-improvement-pipeline` (existing) | pure P4 stub |
| skill-quality.md | thin | 18 | | `guideline:agent-infra/skill-quality-checklist` (existing) | pure P4 stub |
| slash-command-routing-policy.md | thin | 21 | | `skill:command-routing` (existing) | pure P4 stub |
| source-confidentiality.md | stay | 97 | | — | two short Iron-Law-style blocks; each section is directly operative |
| source-discovery-gate.md | stay | 96 | | — | two short Iron-Law-style blocks; already delegates the procedure to `skill:source-discovery` and 2 context files |
| source-of-truth.md | thin | 78 | | `contexts/communication/rules-auto/source-of-truth-mechanics.md` (existing) | explicit "Mechanics — … live in […]" pointer, functionally P4 |
| spreadsheet-source-quality.md | stay | 61 | | — | source-priority list is the whole rule |
| strategy-safety-floor.md | stay | 104 | | — | domain safety floor |
| symfony-routing.md | thin | 26 | | `skill:symfony-workflow` (existing) | pure P4 stub |
| telegraph-speak.md | stay | 85 | | — | self-describing condensation mechanism; algorithm must stay next to the Iron Law it governs (applies to every reply) |
| think-before-action.md | thin | 64 | | `contexts/communication/rules-auto/think-before-action-mechanics.md` (existing) | explicit "obligation surface / lookup material" split, functionally P4 |
| token-budget-discipline.md | stay | 118 | | — | 2 Iron-Law-style blocks + 2 classification tables ARE the governance criteria |
| token-efficiency.md | thin | 35 | | `contexts/communication/rules-auto/token-efficiency-mechanics.md` (existing) | explicit "Mechanics — …" pointer, functionally P4 |
| token-optimizer-maintenance.md | stay | 69 | | — | narrow, self-referential meta-rule about one skill's catalog freshness |
| tool-safety.md | stay | 53 | | — | short; constraints list is the whole rule |
| ui-audit-gate.md | thin | 59 | | `skill:existing-ui-audit` (existing) | hybrid: Iron Law + allow-list retained, rest migrated |
| untrusted-input-defense.md | migrate | 142 | | `docs/guidelines/agent-infra/untrusted-input-spotlighting.md` (existing) | injection-signal taxonomy (dark patterns, session integrity, autofill, card-from-chat) is substantial and already half-covered by this guideline; keep Iron Law + found-instructions quarantine + "what to do" |
| upstream-proposal.md | thin | 20 | | `skill:upstream-contribute` (existing) | pure P4 stub |
| user-interaction.md | thin | 74 | | `contexts/communication/rules-auto/user-interaction-mechanics.md` (existing) | explicit "obligation surface / lookup material" split, functionally P4 |
| user-interrupt-priority.md | stay | 58 | | — | short; classify-table + 3-step protocol is the whole rule (demoted from kernel 2026-07-06, still foundational authority content) |
| verify-before-complete.md | stay | 80 | Y | — | kernel — already partially delegates to `contexts/execution/verification-mechanics.md` |

## Summary counts

| class | count |
|---|---:|
| `already-thin` | 32 |
| `should-migrate` | 16 |
| `must-stay-monolithic` | 56 |
| **total** | **104** |

`must-stay-monolithic` breakdown: 9 kernel + 7 domain-safety-floor
(`finance-safety-floor`, `legal-safety-floor`, `strategy-safety-floor`,
`engineering-safety-floor`, `domain-safety-disclaimer`, `domain-safety-pii`,
`domain-safety-retention`) + 40 other (short/tight/table-is-the-law rules).

`already-thin` breakdown: 27 carry the literal (or near-literal, e.g.
"Portability body migrated to …") P4 routing phrase; 5 more
(`guidelines.md`, `source-of-truth.md`, `think-before-action.md`,
`token-efficiency.md`, `user-interaction.md`) achieve the same
obligation-surface / lookup-material split via an explicit "Mechanics — …
live in `[…]`" pointer instead of the exact phrase, and are counted as
thin because their residual body is small and non-duplicative.

## Full should-migrate list with targets

| rule | body lines | target home | status |
|---|---:|---|---|
| context-hygiene.md | 186 | `docs/guidelines/agent-infra/context-hygiene-mechanics.md` | new guideline needed |
| minimal-safe-diff.md | 166 | `docs/guidelines/agent-infra/minimal-safe-diff-mechanics.md` | new guideline needed |
| domain-adoption-policy.md | 158 | `docs/guidelines/agent-infra/domain-adoption-gates.md` | new guideline needed |
| roadmap-ci-steps-policy.md | 155 | `src/agent-src/contexts/execution/roadmap-process-loop.md` | existing — extend |
| code-comment-discipline.md | 148 | `docs/guidelines/code-clarity.md` | existing — extend |
| untrusted-input-defense.md | 142 | `docs/guidelines/agent-infra/untrusted-input-spotlighting.md` | existing — extend |
| design-fidelity.md | 140 | `docs/guidelines/design-fidelity-mechanics.md` | new guideline needed |
| no-roadmap-references.md | 139 | `skill:agent-docs-writing` | existing — extend |
| framework-neutrality-in-generic-skills.md | 131 | `docs/guidelines/agent-infra/framework-neutrality-patterns.md` | new guideline needed |
| decision-revisit-gate.md | 128 | `skill:decision-review` | existing — extend |
| improve-before-implement.md | 124 | `docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md` | existing — extend |
| artifact-drafting-protocol.md | 122 | `docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md` | new guideline needed |
| architecture.md | 96 | `skill:module-detect-on-the-fly` | existing — extend |
| active-remediation.md | 92 | `docs/guidelines/agent-infra/active-remediation-mechanics.md` | new guideline needed |
| persona-governance.md | 91 | `docs/contracts/persona-schema.md` | existing — extend |
| provider-lifecycle-discipline.md | 78 | `docs/contracts/provider-lifecycle.md` | existing — extend |

7 new guidelines needed; 9 target an existing skill/guideline/context file.

## Batching proposal (input to the follow-on rule-load roadmap, not edited here)

Grouped by target-home affinity into 3 batches of 5–6, ordered so the
new-guideline-heavy batch (more authoring work, less risk of touching a
kernel-adjacent surface) lands first and the safety/security-adjacent batch
lands last (extra review scrutiny, smallest batch):

**Batch 1 — new agent-infra guidelines (5 rules, all net-new targets)**
`context-hygiene.md`, `minimal-safe-diff.md`, `domain-adoption-policy.md`,
`artifact-drafting-protocol.md`, `active-remediation.md` → each gets its own
new `docs/guidelines/agent-infra/*-mechanics.md` (or `*-gates.md`). No
cross-rule dependency; can land in any order inside the batch.

**Batch 2 — extend existing docs/contracts + docs/guidelines (6 rules)**
`code-comment-discipline.md` → `docs/guidelines/code-clarity.md`;
`decision-revisit-gate.md` → `skill:decision-review`;
`improve-before-implement.md` → `docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md`;
`architecture.md` → `skill:module-detect-on-the-fly`;
`persona-governance.md` → `docs/contracts/persona-schema.md`;
`provider-lifecycle-discipline.md` → `docs/contracts/provider-lifecycle.md`.
Each target already has partial coverage of the migrating content — lowest
risk of duplication/contradiction, good second batch.

**Batch 3 — execution/security-adjacent (5 rules, extra review)**
`roadmap-ci-steps-policy.md` → `contexts/execution/roadmap-process-loop.md`;
`no-roadmap-references.md` → `skill:agent-docs-writing`;
`untrusted-input-defense.md` → `docs/guidelines/agent-infra/untrusted-input-spotlighting.md`;
`design-fidelity.md` → `docs/guidelines/design-fidelity-mechanics.md` (new);
`framework-neutrality-in-generic-skills.md` → `docs/guidelines/agent-infra/framework-neutrality-patterns.md` (new).
Grouped last because 2 of the 5 touch security/untrusted-input adjacent
surfaces (`untrusted-input-defense`, and indirectly `no-roadmap-references`
via the CI-reference-integrity gate) and 2 are linter-companion rules
(`roadmap-ci-steps-policy`, `framework-neutrality-in-generic-skills`) where
the migrated prose must stay in lockstep with the corresponding
`scripts/lint_*.ts` — worth a slower, more careful pass.

## See also

- [`docs/contracts/kernel-membership.md`](../../contracts/kernel-membership.md) — the 9-rule kernel this inventory treats as permanently must-stay.
- [`docs/guidelines/agent-infra/model-recommendation.md`](model-recommendation.md) / [`docs/guidelines/agent-infra/roadmap-progress-mechanics.md`](roadmap-progress-mechanics.md) — worked examples of the target-file header/format convention this inventory's proposed new guidelines should follow (`# Title` + `>` one-line summary + `_Origin: migrated from …`_ + Iron-Law restatement + sections; no frontmatter).
- The roadmap layer's "P4" migration pattern — the mechanism this inventory audits; not cited by filepath per [`no-roadmap-references`](../../../src/rules/no-roadmap-references.md) (roadmap files are transient, this inventory is durable).

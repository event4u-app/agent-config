---
stability: beta
---


# Rule Classification — Phase 1.2 of road-to-kernel-and-router

> **Status:** active · **Stability:** beta · **Owner:** road-to-kernel-and-router P1.2
> · **Source of truth:** `.agent-src.uncompressed/rules/*.md`

Migration plan for all 56 source rules. **No edits land here** — this
document is the disposition map P2 / P4 will execute against.

## § 1 — Disposition codes

| code | meaning |
|---|---|
| `keep-in-kernel` | Iron Law floor / behaviour / safety / tone / ask-policy. Loaded every session. Compressed to ≤ 2.5k chars (P2.2; raised from 1.5k per Council R2). |
| `compress-and-keep` | Behavioural rule that stays in `rules/` as auto-tier. Compressed in place per the P2.2 playbook. Loaded by router on trigger match. |
| `move-to-skill:<id>` | Procedural how-to content. Body migrates into the named skill (P4.1); rule shrinks to Iron Law one-liner + `routes_to:`. |
| `move-to-guideline:<id>` | Reference / examples / mechanics tables. Body migrates into `docs/guidelines/<id>.md` (P4.2); rule keeps Iron Law + pointer. |

## § 2 — Baseline numbers (measured 2026-05-06)

| bucket | rules | chars | target after roadmap |
|---|---:|---:|---|
| always (kernel proxy) | 9 | 32 403 | ≤ 25 000 hard, ≤ 20 000 target |
| auto | 47 | 142 297 | ≤ 60 000 |
| **total** | **56** | **174 700** | **≤ 85 000** |

Source: `python3 scripts/measure_rule_budget.py`.

## § 3 — Disposition table

Sorted by current `type` then `id`. `chars` = body chars after
frontmatter strip. Disposition is the migration call, **not** an edit
yet.

### § 3.1 — always-rules (kernel candidates)

| id | chars | disposition | rationale |
|---|---:|---|---|
| agent-authority | 1217 | `keep-in-kernel` | Priority index for the four authority rules; routes-of-routers |
| ask-when-uncertain | 4096 | `keep-in-kernel` | Iron Law: one-question-per-turn, mirror the user, vague-trigger list |
| commit-policy | 2972 | `keep-in-kernel` | Iron Law (safety-floor): NEVER commit / NEVER ask about committing |
| direct-answers | 3991 | `keep-in-kernel` | Three Iron Laws (no flattery, no invented facts, brevity) |
| language-and-tone | 5318 | `keep-in-kernel` | Iron Law: mirror the user's language; .md always English |
| no-cheap-questions | 3875 | `keep-in-kernel` | Iron Law: no-cheap-questions self-check; mode-independent |
| non-destructive-by-default | 4222 | `keep-in-kernel` | Iron Law (safety-floor): Hard Floor for prod / push / bulk-destructive |
| scope-control | 4368 | `keep-in-kernel` | Iron Law (safety-floor): no unsolicited refactors / git-ops gate |
| verify-before-complete | 2344 | `keep-in-kernel` | Iron Law: no completion claims without fresh verification |

**Always-bucket total: 32 403 chars.** Pilot compression rate `r`
locked at **median 0.712** (P1.3, Council R2 amendment); projection
sum = 23 071 chars, under the 25k hard cap with 1 929 chars headroom.
Per-rule cap raised to ≤ 2.5k (Council R2). Iron-Law-override ADRs
may lift individual rules above 2.5k where Iron-Law density forbids
further compression — currently 2 expected (`direct-answers` +342,
`language-and-tone` +1286). See `kernel-membership.md` § 5.

> **Council swap ADR (P2.1 input).** Sonnet 4.5 flagged
> `agent-authority` as a routing index (no Iron-Law fence; should
> demote to auto-tier-3) and `autonomous-execution` (currently
> `compress-and-keep` below) as a mode-independent Band-4 authority
> that should promote to kernel. Swap accepted ⇒ +1213 chars over
> the 25k cap. Decision deferred to P2.1 ADR; current dispositions
> below remain locked until the ADR resolves.

### § 3.2 — auto-rules: compress-and-keep (22)

Behavioural rules with too much Iron-Law content for migration; compress
in place per P2.2 playbook. Loaded by router on trigger match.

| id | chars | tier | rationale |
|---|---:|---|---|
| architecture | 2491 | 3 | Behavioural; project-organization gates |
| artifact-drafting-protocol | 2957 | 2a | Iron-Law-shaped Understand→Research→Draft sequence |
| augment-source-of-truth | 2439 | 1 | Behavioural Iron Law: never edit generated dirs |
| autonomous-execution | 5631 | 3 | Trivial-vs-blocking decision; tier-1 on `balanced` |
| context-hygiene | 3811 | 1 | Behavioural Iron Law: 3-failure stop, fresh-chat trigger |
| downstream-changes | 2940 | 2b | Behavioural: every code edit |
| guidelines | 4184 | 3 | Meta-rule: consult guidelines before code |
| improve-before-implement | 3838 | 2b | Behavioural: validate before building |
| markdown-safe-codeblocks | 535 | 2b | Already small; behavioural |
| minimal-safe-diff | 3324 | 2a | Behavioural Iron Law: smallest change |
| missing-tool-handling | 2633 | 2a | Behavioural Iron Law: ask, don't install silently |
| no-attribution-footers | 1462 | 3 | Iron Law (recently trimmed); within budget |
| no-roadmap-references | 2502 | mech | Scoped Iron Law: no stable→roadmap refs |
| preservation-guard | 3825 | 2b | Quality gate during merges/refactors |
| role-mode-adherence | 1682 | 2a | Behavioural: mode-marker contract |
| runtime-safety | 1133 | 2b | Safety policy for execution metadata |
| security-sensitive-stop | 3004 | 2a | Safety Iron Law: stop+threat-model |
| size-enforcement | 865 | mech | Budget enforcement (ties into P5 CI gate) |
| think-before-action | 5298 | 2b | Behavioural Iron Law: analyze first |
| token-efficiency | 3885 | 2a | Behavioural: redirect verbose output |
| tool-safety | 1242 | 2b | Safety: allowlist, deny-by-default |
| user-interaction | 7657 | 3 | Numbered-options Iron Law |

### § 3.3 — auto-rules: move-to-skill (18)

Procedural how-to. Rule body migrates into named skill (P4.1); rule
shrinks to Iron-Law one-liner + `routes_to:`. Skill IDs reference
existing skills under `.agent-src.uncompressed/skills/`.

| id | chars | target skill | rationale |
|---|---:|---|---|
| agent-docs | 2575 | `agent-docs-writing` | Procedural: how to author agent-docs |
| analysis-skill-routing | 1325 | `analysis-skill-router` | Routing procedure |
| capture-learnings | 2820 | `learning-to-rule-or-skill` | Capture procedure |
| cli-output-handling | 1801 | `rtk-output-filtering` | Tool-wrapping procedure |
| commit-conventions | 1938 | `conventional-commits-writing` | Format procedure |
| docker-commands | 1830 | `docker` | Stack-specific procedure |
| docs-sync | 3131 | `agent-docs-writing` | Mechanical sync procedure |
| e2e-testing | 1807 | `e2e-heal` | Procedural; project-specific |
| laravel-translations | 995 | `laravel` | Stack-specific |
| model-recommendation | 2909 | `set-cost-profile` | Routing procedure |
| onboarding-gate | 4881 | `onboard` | Mechanical: meta-rule about /onboard |
| package-ci-checks | 1342 | `lint-skills` | Repo-specific procedure |
| reviewer-awareness | 3573 | `review-routing` | Skill exists; consolidates former `review-routing-awareness` (2026-05-08, see `agents/contexts/adr-auto-rule-consolidation.md`) |
| skill-improvement-trigger | 1597 | `skill-improvement-pipeline` | Trigger procedure |
| slash-command-routing-policy | 3218 | `command-routing` | Routing procedure |
| ui-audit-gate | 3285 | `existing-ui-audit` | Audit procedure |
| upstream-proposal | 2424 | `upstream-contribute` | Procedural |

### § 3.4 — auto-rules: move-to-guideline (7)

Reference / examples / mechanics. Body migrates into
`docs/guidelines/<id>.md` (P4.2); rule keeps Iron Law + pointer.

| id | chars | target guideline | rationale |
|---|---:|---|---|
| artifact-engagement-recording | 3462 | `artifact-engagement-flow` | Mechanics doc lives in `.agent-src.uncompressed/contexts/contracts/` (P4.1) |
| augment-portability | 2956 | `augment-portability-patterns` | Project-agnostic-patterns reference |
| command-suggestion-policy | 3954 | `command-suggestion-flow` | Flow doc already exists |
| php-coding | 3433 | `php-coding-patterns` | Reference table; per-stack |
| roadmap-progress-sync | 7455 | `roadmap-progress-mechanics` | Mostly mechanics + checkbox grammar |
| rule-type-governance | 2661 | `rule-type-governance` | Reference: when always vs auto |
| skill-quality | 5367 | `skill-quality-checklist` | Reference checklist |

## § 4 — Verification

| check | command | acceptance |
|---|---|---|
| Coverage | `python3 scripts/measure_rule_budget.py` | 56 rules total → 9 kernel + 22 compress + 18 skill + 7 guideline |
| Determinism | `python3 scripts/measure_rule_budget.py --json` × 2 | byte-identical output |
| No-edits | `git diff --stat .agent-src.uncompressed/rules/` | clean (this is plan-only) |

## § 5 — Open questions

1. **Kernel swap ADR (P2.1).** `agent-authority` ↔
   `autonomous-execution`. See `kernel-membership.md` § 5.2 for the
   three resolution variants; this file syncs once the ADR lands.
2. **`reviewer-awareness` + `review-routing-awareness` merge.** ✅ resolved
   2026-05-08 — merged into `reviewer-awareness` per
   `agents/contexts/adr-auto-rule-consolidation.md`.
3. **`onboarding-gate` migration shape.** The rule fires only on the
   first turn; the migrated form must keep that trigger latch.
   Router state-machine primitives (once / every-turn / on-mode-
   switch) are a P3.1 deliverable dependency before P4 ships
   (Council R2).
4. **P4 migration shapes spec.** Per-disposition contract
   (replace / merge / stub / disappear) for `move-to-skill` and
   `move-to-guideline` — frontmatter handling, conflict resolution,
   one-liner + `routes_to:` shape vs body merge. P4 deliverable
   spec; flagged by Council R2 to prevent inconsistent implementer
   calls.
5. **`think-before-action` / `context-hygiene` / `augment-source-of-
   truth` boundary.** Currently `compress-and-keep` (auto). Council
   did not flag for promotion; revisit only if the swap ADR (#1)
   forces a re-projection.

# Frugality Charter

Cross-rule index for **writer skills** (skill-writing, rule-writing,
command-writing, guideline-writing, context-authoring,
agent-docs-writing, conventional-commits-writing, readme-writing,
readme-writing-package, adr-create, persona-writing, roadmap-writing,
script-writing).
The canon is held by the named rules below; this file is index-only,
plus the settings-hooks section that has no other canonical home.

## Frugality canon — links into authoritative rules

Cite the source rule in writer artifacts; do **not** restate it here.

| Concern | Authoritative source |
|---|---|
| Default-terse output, skip intent prose, skip post-action summaries | [`direct-answers § Iron Law 3 — Brevity by Default`](../../rules/direct-answers.md#iron-law-3--brevity-by-default) |
| Numbered-options trade-off rule (real consequence, not sequencing) | [`user-interaction § Iron Law 1 — Single-Source Recommendation`](../../rules/user-interaction.md#iron-law-1--single-source-recommendation) |
| Cheap-question pre-send check (skip the ask if context already answers) | [`no-cheap-questions § Pre-Send Self-Check`](../../rules/no-cheap-questions.md#pre-send-self-check--mandatory-before-every-question) |
| Tool-call discipline, act-skip-narration, fresh output over memory | [`token-efficiency § The Iron Laws`](../../rules/token-efficiency.md#the-iron-laws) and its mechanics file |

## Confirmation taxonomy

Iron-Law / Routine / Contextual classification with carve-outs is
canonical in the active token-frugality plate under `agents/roadmaps/`
(or `agents/roadmaps/archive/` once closed). Charter does not duplicate
the table.

## Settings hooks

Live Phase 1 schema (see [`templates/agent-settings.md`](../../templates/agent-settings.md#settings-reference)).

| Key | One-line semantics |
|---|---|
| `verbosity.preview_artifacts` | When `false`, skip generated commit messages / PR titles / branch names preview before acting. |
| `verbosity.routine_confirmations` | When `false`, skip "looks good?" gates on routine workflow steps. Iron-Law gates always ask. |
| `verbosity.offer_council_in_delivery` | When `false`, delivery commands skip the optional "run Council on this?" offer. |
| `verbosity.post_action_reports` | `off` / `minimal` / `full` — multi-line status blocks after a successful action. |
| `verbosity.intent_announcements` | When `false`, writers must not generate "Let me…", "Now I will…", "Found it" openers. |
| `telegraph.speak_scope` | `off` / `prose_only` / `aggressive` — telegraph-speak grammar scope. Iron-Law fenced blocks never touched. |

Phase 10 adds `verbosity.script_output` (`silent` / `minimal` / `verbose`) and `verbosity.taskfile_command_echo` (`true` / `false`); writer artifacts cite this row when those land.

## Cross-references — frugality canon rules

Consolidated index. Source rules used to carry trailing
`Interactions` / `See also` blocks; those are stripped to reclaim
kernel chars. The pointers below replace them.

| Rule | Interacts with |
|---|---|
| `direct-answers` | `language-and-tone` · `ask-when-uncertain` · `think-before-action` · `verify-before-complete` · `token-efficiency` · `user-interaction` (overrides brevity) · `telegraph-speak` |
| `no-cheap-questions` | `ask-when-uncertain` · `autonomous-execution` · `commit-policy` · `scope-control` · `non-destructive-by-default` · `user-interaction` · `direct-answers` |
| `telegraph-speak` | `language-and-tone` (mirror user language **before** telegraph) · `direct-answers` Iron Law 3 (telegraph is one brevity tactic, not a replacement) · `user-interaction` (numbered-options carve-out) · `commit-policy`, `non-destructive-by-default`, `scope-control` (Iron-Law literal fence carve-outs) |

## Decidable carve-out predicates

Predicates with one-sentence tests live in [`docs/guidelines/agent-infra/carve-out-predicates.md`](../../../docs/guidelines/agent-infra/carve-out-predicates.md). Default-terse applies unless a predicate's test is yes/no decidable from the artifact alone.

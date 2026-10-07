# Pack-boundary delta — the 42 new cross-pack links of 2026-10-01

<!-- evidence-type: analysis -->

> **Scope:** the violation set `lint_pack_boundaries` reports on `main` at
> `a03f60c46`, diffed against the set the gate reported at `683d493ec` — the
> commit that landed the 337 baseline on 2026-08-02. Both sets were produced by
> running the gate at its own commit, so the baseline side is the historical
> verdict rather than a re-measurement under new code: `683d493ec` reproduces
> `count: 337` exactly.

## What the diff is

379 current against 337 at the baseline is a NET +42. The multiset diff is
**55 links added and 13 cleared**; the table below is the 55, because the net
number names no file and the 55 are what a fix has to reach.

## Two classes, and only one of them is drift

**22 of the 55 target `meta`, and they never dangled.** `meta` carries
`always_on: true`, which `config/packs.resolve_active_packs` reads by seeding
the active pack set with every always-on pack before expanding any selection,
and which `docs/contracts/capability-packs.md` § Always-on packs states as "it
cannot be deselected". The gate knew one always-installed pack, the hard-coded
`core`, so it reported a violation for a target the resolver provably does
install. That is the same defect shape the script header already records for
its direct-vs-transitive `requires` comparison, and it is fixed the same way:
the always-installed set is now `core` plus every `always_on` pack. The
direction stays one-way — a link OUT of an always-on pack into a gated one
still dangles and is still reported, which the suite locks with a test.

This also retires the baseline note's own largest class: "engineering-base ->
meta (73), skills in a consumer-installable pack citing this package's own
maintenance skills" was described there as "a link that dangles for a consumer
who installs the source pack without the target's". For `meta` there is no such
consumer.

**33 are real.** Each is a link from a pack a consumer can install into a pack
that install does not carry. All 33 were fixed at the source by dropping the
link and keeping the artefact name as prose — the pattern already in the tree
for a reference that resolves in this repository and nowhere else
(`playbook-precedence` cites ADR-244 by number for exactly this reason, and
`import-procedure` already names `design-tokens` unlinked beside a linked
sibling). Adding the `requires` edge was rejected per this roadmap's risk
register item 1: every one of these edges runs from a base pack into a
narrower one (`engineering-base` -> `react`, `meta` -> `git`), so declaring it
would push the narrower pack into every install of the base.

## The 55

`n` is the occurrence count for that source/target pair. "Introduced" is the
oldest commit whose diff on the source file adds the link string.

| n | Source pack | Target pack | Source | Target | Introduced | Disposition |
|---|---|---|---|---|---|---|
| 1 | `engineering-base` | `frontend-design` | `src/rules/active-remediation.md` | `src/rules/ui-audit-gate.md` | `cbf132045` 2026-08-12 | de-linked — cited by name |
| 1 | `engineering-base` | `frontend-design` | `src/skills/existing-ui-audit/SKILL.md` | `src/rules/ui-audit-gate.md` | `b168ca120` 2026-09-09 | de-linked — cited by name |
| 1 | `engineering-base` | `frontend-design` | `src/skills/existing-ui-audit/SKILL.md` | `src/skills/design-system-capture/references/design-system-json.md` | `3cd310396` 2026-08-12 | de-linked — cited by name |
| 1 | `engineering-base` | `frontend-design` | `src/skills/fe-design/SKILL.md` | `src/skills/design-intelligence/references/context-and-registers.md` | `337444329` 2026-08-23 | de-linked — cited by name |
| 1 | `engineering-base` | `frontend-design` | `src/skills/tailwind-engineer/SKILL.md` | `src/rules/icon-consistency.md` | `f6bb2a60f` 2026-09-09 | de-linked — cited by name |
| 1 | `engineering-base` | `frontend-design` | `src/skills/ui-component-architect/SKILL.md` | `src/skills/design-system-capture/SKILL.md` | `a622b4b55` 2026-08-23 | de-linked — cited by name |
| 2 | `engineering-base` | `meta` | `src/rules/active-remediation.md` | `src/rules/no-cheap-questions.md` | `cbf132045` 2026-08-12 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/rules/active-remediation.md` | `src/rules/user-interaction.md` | `cbf132045` 2026-08-12 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/rules/code-provenance.md` | `src/rules/content-quoting-floor.md` | `c375e4913` 2026-08-13 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/rules/code-provenance.md` | `src/rules/source-confidentiality.md` | `17efefc0d` 2026-08-13 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/rules/evaluator-independence.md` | `src/rules/direct-answers.md` | `20bb4116d` 2026-08-06 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/rules/playbook-precedence.md` | `src/rules/source-confidentiality.md` | `432b422ca` 2026-08-23 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/rules/playbook-precedence.md` | `src/skills/agents-md-thin-root/SKILL.md` | `432b422ca` 2026-08-23 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/skills/conventional-commits-writing/SKILL.md` | `src/rules/no-attribution-footers.md` | `668ed88eb` 2026-06-03 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/skills/conventional-commits-writing/SKILL.md` | `src/rules/no-decorative-emojis-in-git-surfaces.md` | `7651c884d` 2026-09-04 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/skills/playbook-authoring/SKILL.md` | `src/skills/command-writing/SKILL.md` | `09c5d8342` 2026-08-23 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/skills/playbook-authoring/SKILL.md` | `src/skills/context-document/SKILL.md` | `09c5d8342` 2026-08-23 | allow rule corrected (`meta` is `always_on`) |
| 1 | `engineering-base` | `meta` | `src/skills/test-driven-development/SKILL.md` | `src/domains/engineering-base/tests/execute/command.md` | `fbf081b71` 2026-08-23 | allow rule corrected (`meta` is `always_on`) |
| 2 | `engineering-base` | `meta` | `src/skills/verify-completion-evidence/SKILL.md` | `src/domains/engineering-base/tests/execute/command.md` | `fbf081b71` 2026-08-23 | allow rule corrected (`meta` is `always_on`) |
| 2 | `engineering-base` | `php` | `src/skills/js-library-packaging/SKILL.md` | `src/skills/composer-packages/SKILL.md` | `bab97ce5d` 2026-08-23 | de-linked — cited by name |
| 1 | `engineering-base` | `react` | `src/skills/monorepo-workspace/SKILL.md` | `src/skills/react-shadcn-ui/SKILL.md` | `a33251548` 2026-08-23 | de-linked — cited by name |
| 3 | `engineering-base` | `react` | `src/skills/storybook-workshop/SKILL.md` | `src/skills/react-shadcn-ui/SKILL.md` | `27436da32` 2026-08-23 | de-linked — cited by name |
| 1 | `engineering-base` | `react` | `src/skills/ui-component-architect/SKILL.md` | `src/skills/react-shadcn-ui/SKILL.md` | `f6bb2a60f` 2026-09-09 | de-linked — cited by name |
| 1 | `engineering-base+frontend-design` | `frontend-design` | `src/rules/design-fidelity.md` | `src/skills/wireframe/SKILL.md` | `55d0dcd6b` 2026-08-23 | de-linked — cited by name |
| 1 | `frontend-design` | `brand` | `src/skills/design-system-capture/references/import-procedure.md` | `src/skills/brand-to-tokens/SKILL.md` | `b1a2eb9b9` 2026-08-23 | de-linked — cited by name |
| 1 | `frontend-design` | `brand` | `src/skills/iconography/SKILL.md` | `src/rules/brand-source-of-truth.md` | `4461e319a` 2026-09-03 | de-linked — cited by name |
| 3 | `git` | `meta` | `src/domains/git/pr/merge/command.md` | `src/domains/product-basic/roadmap/process-full/command.md` | `27febd3aa` 2026-08-21 | allow rule corrected (`meta` is `always_on`) |
| 1 | `git` | `meta` | `src/domains/git/pr/merge/command.md` | `src/rules/autonomous-execution.md` | `c6c99a415` 2026-08-21 | allow rule corrected (`meta` is `always_on`) |
| 1 | `meta` | `analysis-workbench` | `src/rules/decision-revisit-gate.md` | `src/skills/decision-review/SKILL.md` | `b6fa3113f` 2026-07-06 | de-linked — cited by name |
| 1 | `meta` | `analysis-workbench` | `src/skills/skill-improvement-pipeline/SKILL.md` | `src/skills/decision-review/SKILL.md` | `484596e1d` 2026-08-06 | de-linked — cited by name |
| 1 | `meta` | `git` | `src/domains/engineering-base/fix/ci/command.md` | `src/domains/git/pr/create/command.md` | `764bb23cc` 2026-08-17 | de-linked — cited by name |
| 4 | `meta` | `git` | `src/domains/product-basic/roadmap/process-full/command.md` | `src/domains/git/pr/merge/command.md` | `6de65cf0b` 2026-08-21 | de-linked — cited by name |
| 2 | `meta` | `git` | `src/skills/review-routing/SKILL.md` | `src/domains/git/pr/create/description-only/command.md` | `fbf081b71` 2026-08-23 | de-linked — cited by name |
| 1 | `meta` | `product-reasoning` | `src/domains/analysis-workbench/analyze/inbox/command.md` | `src/domains/meta/challenge-me/closure/command.md` | `94112d886` 2026-09-13 | de-linked — cited by name |
| 1 | `meta` | `product-reasoning` | `src/domains/analysis-workbench/analyze/roadmap-repos/command.md` | `src/domains/meta/challenge-me/closure/command.md` | `94112d886` 2026-09-13 | de-linked — cited by name |
| 1 | `meta` | `product-reasoning` | `src/domains/engineering-base/feature/plan/command.md` | `src/domains/meta/challenge-me/closure/command.md` | `94112d886` 2026-09-13 | de-linked — cited by name |
| 1 | `meta` | `product-reasoning` | `src/domains/engineering-base/feature/roadmap/command.md` | `src/domains/meta/challenge-me/closure/command.md` | `94112d886` 2026-09-13 | de-linked — cited by name |
| 1 | `meta` | `product-reasoning` | `src/domains/engineering-base/implement-ticket/command.md` | `src/domains/meta/challenge-me/closure/command.md` | `94112d886` 2026-09-13 | de-linked — cited by name |
| 1 | `meta` | `product-reasoning` | `src/domains/product-basic/jira-ticket/command.md` | `src/domains/meta/challenge-me/closure/command.md` | `94112d886` 2026-09-13 | de-linked — cited by name |
| 1 | `meta` | `product-reasoning` | `src/domains/product-basic/roadmap/create/command.md` | `src/domains/meta/challenge-me/closure/command.md` | `94112d886` 2026-09-13 | de-linked — cited by name |
| 1 | `meta` | `product-reasoning` | `src/domains/product-basic/roadmap/materialize/command.md` | `src/domains/meta/challenge-me/closure/command.md` | `94112d886` 2026-09-13 | de-linked — cited by name |
| 1 | `product-basic` | `meta` | `src/skills/feature-planning/SKILL.md` | `src/skills/complexity-first-planning/SKILL.md` | `1d77901eb` 2026-09-04 | allow rule corrected (`meta` is `always_on`) |
| 1 | `react` | `meta` | `src/skills/react-shadcn-ui/SKILL.md` | `src/rules/missing-tool-handling.md` | `b2fc42925` 2026-08-11 | allow rule corrected (`meta` is `always_on`) |
| 1 | `react` | `meta` | `src/skills/react-shadcn-ui/SKILL.md` | `src/rules/source-confidentiality.md` | `a622b4b55` 2026-08-23 | allow rule corrected (`meta` is `always_on`) |

## The 13 cleared since the baseline

Recorded so the net +42 is reconstructible from this file alone.

| n | Source pack | Target pack | Source | Target |
|---|---|---|---|---|
| 1 | `engineering-base` | `frontend-design` | `src/skills/existing-ui-audit/SKILL.md` | `src/skills/design-system-capture/reference/design-system-json.md` |
| 1 | `engineering-base` | `frontend-design` | `src/skills/fe-design/SKILL.md` | `src/skills/design-intelligence/SKILL.md` |
| 1 | `engineering-base` | `frontend-design` | `src/skills/fe-design/SKILL.md` | `src/skills/design-variations/SKILL.md` |
| 1 | `engineering-base` | `meta` | `src/rules/delegation-policy.md` | `src/rules/user-interaction.md` |
| 1 | `engineering-base` | `meta` | `src/skills/design-review/SKILL.md` | `src/skills/subagent-orchestration/SKILL.md` |
| 1 | `engineering-base` | `meta` | `src/skills/design-review/SKILL.md` | `src/skills/verify-repair-loop/SKILL.md` |
| 1 | `engineering-base` | `react` | `src/skills/fe-design/SKILL.md` | `src/skills/react-shadcn-ui/SKILL.md` |
| 1 | `frontend-design` | `brand` | `src/skills/design-system-capture/SKILL.md` | `src/skills/brand-to-tokens/SKILL.md` |
| 1 | `frontend-design` | `laravel` | `src/skills/design-intelligence/SKILL.md` | `src/skills/blade-ui/SKILL.md` |
| 1 | `frontend-design` | `laravel` | `src/skills/design-intelligence/SKILL.md` | `src/skills/flux/SKILL.md` |
| 1 | `frontend-design` | `laravel` | `src/skills/design-intelligence/SKILL.md` | `src/skills/livewire/SKILL.md` |
| 1 | `frontend-design` | `react` | `src/skills/design-intelligence/SKILL.md` | `src/skills/react-shadcn-ui/SKILL.md` |
| 1 | `meta` | `memory` | `src/domains/meta/agent-handoff/command.md` | `src/domains/meta/chat-history/import/command.md` |

## Result

| Reading | Count |
|---|---|
| At the 2026-08-02 baseline commit, as the gate then judged | 337 |
| On `main` before this change, as the gate then judged | 379 |
| At the baseline commit, under the corrected allow rule | 215 |
| On `main` after the allow-rule fix alone | 238 |
| On `main` after the 33 de-links | 203 |

New violations remaining against the baseline-era set under the corrected
rule: **0**. Twelve pre-existing ones were cleared as a side effect, because
three of the de-linked sites carried more occurrences than the delta named.
The baseline is lowered to 203 and `landed` refreshed in the same change.

> **Correction, 2026-10-07 (release finding `aee552b96cc0`).** The sentence
> above over-attributes. By this page's own Result table the 33 de-links take
> 238 to 203, which is 35 occurrences: only **2** extra clearances come from the
> de-linked sites carrying more occurrences than the delta named. The rest of
> the 215 → 203 net of 12 was cleared before this change, by the links listed
> under "The 13 cleared since the baseline". The 0 new violations and the
> lowered baseline of 203 are unaffected.

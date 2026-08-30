<!-- evidence-type: analysis -->

# Trigger-corpus census and wave order — 2026-08-30

`road-to-governed-harness-evolution` steps **2.1** (census before a target) and
**2.2** (waves ordered by defect evidence, not alphabetically). Both are in this
one file because they are one measurement read two ways: 2.1 partitions the
population, 2.2 orders the part of it that is still uncovered.

**Measured on this tree on 2026-08-30**, branch base `origin/main` at
`9acdc14d8`. Every number below is reproduced by a command printed beside it.
Nothing here is recalled.

## Why a census at all — the shape this replaces

The parent roadmap this one folds back in **killed** `100 % trigger coverage as
a target` by name (K12 in the killed register): a coverage ratio is reachable by
authoring low-discriminative fixtures, which raises the metric and measures
nothing. Risk 4 in the register is the same failure stated as a risk — *"94 →
299 is a number that can be reached by authoring low-discriminative fixtures"*.

So the denominator has to be argued for before it is used, and this file is that
argument.

## 1 — The three reproduced counts

| Count | Command | Result |
|---|---|---|
| skills in the tree | `ls -1d src/skills/*/ \| wc -l` | **299** |
| skills carrying a corpus, at the start of this run | `ls src/skills/*/evals/triggers.json \| wc -l` | **94** |
| grandfather-allowlist entries, at the start of this run | `jq '.skills \| length' src/scripts/trigger_eval_grandfather.json` | **205** |

All three reproduce the roadmap's own figures exactly. The allowlist's own
`_note` says it was *"Frozen 2026-07-08 at 221 of 264 skills"*, so the shrink-only
ratchet had already walked down 16 before this run.

## 2 — The partition, and the criterion it rests on

**The criterion, stated before it is applied:**

> A skill is **non-self-activating** iff its own `description` — the only field
> any host activation surface reads — names a **dispatcher** rather than a user
> task surface, with the literal `dispatched by` / `Dispatched by` / `Called by`,
> **and** that dispatcher exists in this tree.

Three properties make it usable rather than merely plausible:

1. **It is mechanical.** One regex over one field. Anyone can re-derive the
   list; nobody has to agree with a judgement call.
2. **It reads the artefact's own declaration, not an outside opinion about it.**
   Same mechanism `lint_skill_trigger_corpus.ts:28-37` already uses for the
   German requirement, and for the same stated reason: a detector would be a
   heuristic wearing a schema check's clothes.
3. **It errs in the direction that HURTS the number.** Excluding a skill raises
   the coverage ratio, so a loose criterion is self-serving. This one excludes
   only skills that say so themselves, which leaves several plausibly
   non-routable skills — `judge-injection-defense`, `judge-synthesis`,
   `overbuild-review-lens`, `ui-apply-generic` — **inside** the denominator
   because their descriptions read as task surfaces. That is the intended
   direction of the error and it is recorded rather than quietly fixed.

### The 12 excluded skills, one exclusion criterion each

| Skill | Its own declaring clause | Dispatcher, verified present |
|---|---|---|
| `architecture-review-lens` | *"…dispatched by /review-changes alongside the four standard judges.…"* | `src/domains/engineering-base/review/changes/command.md:6` — `routes_to:` names it |
| `blade-ui` | *"…dispatched by `directives/ui/{apply,review,polish}.ts`. Covers views, co…"* | `src/agent-src/templates/scripts/work_engine/directives/ui/stack_bundles.ts:81` — `build: ['flux', 'livewire', 'blade-ui']` |
| `flux` | *"…dispatched by `directives/ui/{apply,review,polish}.ts`. Covers Flux comp…"* | `src/agent-src/templates/scripts/work_engine/directives/ui/stack_bundles.ts:81` — `build: ['flux', 'livewire', 'blade-ui']` |
| `judge-artifact-completeness` | *"…Dispatched by /refine-ticket, /adr-create, /review-changes; never auto-g…"* | `src/skills/adr-create/SKILL.md:322` and `src/skills/refine-ticket/SKILL.md:332` |
| `judge-bug-hunter` | *"…dispatched by /review-changes, /do-and-judge, /judge, even without 'judg…"* | `src/domains/engineering-base/review/changes/command.md:6` — `routes_to:` names it |
| `judge-code-quality` | *"…dispatched by /review-changes, /do-and-judge, /judge.…"* | `src/domains/engineering-base/review/changes/command.md:6` — `routes_to:` names it |
| `judge-security-auditor` | *"…dispatched by /review-changes, /do-and-judge, /judge.…"* | `src/domains/engineering-base/review/changes/command.md:6` — `routes_to:` names it |
| `judge-spec-compliance` | *"…dispatched by /review-changes, /do-and-judge, /judge. Never infers crite…"* | `src/domains/engineering-base/review/changes/command.md:124` — the judge table row |
| `judge-test-coverage` | *"…dispatched by /review-changes, /do-and-judge, /judge, even without 'test…"* | `src/domains/engineering-base/review/changes/command.md:6` — `routes_to:` names it |
| `livewire` | *"…dispatched by `directives/ui/{apply,review,polish}.ts`. Covers reactive…"* | `src/agent-src/templates/scripts/work_engine/directives/ui/stack_bundles.ts:81` — `build: ['flux', 'livewire', 'blade-ui']` |
| `project-analysis-core` | *"…Called by `universal-project-analysis`. Single-pass scan → `project-anal…"* | `src/skills/universal-project-analysis/SKILL.md:98` — the unknown/mixed branch routes to it |
| `react-shadcn-ui` | *"…dispatched by `directives/ui/*` for the `react-shadcn` stack.…"* | `src/agent-src/templates/scripts/work_engine/directives/ui/stack_bundles.ts:101` — `build: ['react-shadcn-ui']` |

**Reproduce:** the regex is `\b(?:[Dd]ispatched by|Called by)\b` applied to the
`description:` line of each `src/skills/*/SKILL.md`.

### The partitioned denominator

```
299 skills
 -12 non-self-activating (declared dispatcher, verified)
= 287 routable — THE DENOMINATOR
```

**Coverage against it, at the start of this run: 91 / 287 = 31.7 %.** Not
94/299 = 31.4 %, and the closeness of those two numbers is itself a finding: the
exclusion set is small enough that the partition barely moves the ratio. What
the partition buys is not a better-looking number, it is a denominator that
cannot be gamed by authoring fixtures for skills no prompt reaches.

Three of the 12 excluded skills — `architecture-review-lens`,
`judge-artifact-completeness`, `judge-spec-compliance` — already carry a corpus.
Exclusion governs the **denominator**, never permission: a dispatched skill may
hold a corpus, and those three are not deleted.

## 3 — Wave order, and the criterion per wave

2.2 asks for waves ordered by **defect evidence**. The tree carries one
deterministic source of it, and it was not being read.

**The signal: a recorded confusion edge whose receiving end has no test.** When
skill A's corpus holds a `trigger: false` case whose note names skill B as the
correct destination, the corpus has *recorded that A and B are confusable*. If B
then carries no corpus, nothing tests that B does not over-trigger on A's
vocabulary. The confusion is documented on one side and untested on the other.

**Reproduce:** over every `src/skills/*/evals/triggers.json`, for each case with
`trigger: false`, match its `note` against `[→>]\s*`?([a-z0-9][a-z0-9-]{2,})`?`
and count hits that name an existing skill other than the file's own. At the
start of this run: **170 edges naming 90 distinct skills**, of which **42 had no
corpus of their own** — 63 edges pointing at an untested destination.

| Wave | Criterion | Size |
|---|---|---|
| **1** | routable · no corpus · **named by ≥1 recorded confusion edge**, ordered by inbound edge count | 34 skills / 38 edges (was 42 / 63 before this run's six) |
| **2** | routable · no corpus · **no recorded edge** — a coverage gap with no recorded defect behind it | 156 skills |
| **3** | non-self-activating · no corpus — **excluded from the denominator, so not corpus work at all** | 9 skills |

`100 + 34 + 156 + 9 = 299`. The partition is exhaustive and the waves do not
overlap, which is the property that makes "wave 2 is next" mean something.

**Why this order and not the reverse.** Wave 2 is 4.6× the size of wave 1 and
carries no evidence that any of it is wrong. Sweeping it first is the vanity
shape K12 killed. Wave 1 is where the tree has already written down, in its own
corpora, that a confusion exists.

**Wave 3 is deliberately not work.** Those nine stay on the grandfather
allowlist. The allowlist may only shrink, and it shrinks when a skill *gains* a
corpus — so a non-routable skill leaves it only if someone decides to write one
anyway. Naming them here stops them being mistaken for a wave-2 backlog.

### Wave 1, in order — the executable queue

| Inbound edges | Skill | Named by |
|---|---|---|
| 2 | `design-review` | `design-variations`, `wireframe` |
| 2 | `character-consistency` | `image-analyser`, `image-creator` |
| 2 | `dependency-upgrade` | `supply-chain-intake`, `workspace-link` |
| 2 | `git-workflow` | `worktree-lifecycle` |
| 1 | `privacy-review` | `agent-security-review` |
| 1 | `dashboard-design` | `alerting-doctrine` |
| 1 | `source-discovery` | `code-intelligence` |
| 1 | `universal-project-analysis` | `code-intelligence` |
| 1 | `accessibility-auditor` | `frontend-render-security` |
| 1 | `video-director` | `image-analyser` |
| 1 | `motion-choreographer` | `image-creator` |
| 1 | `scene-expander` | `image-creator` |
| 1 | `rule-writing` | `judge-injection-defense` |
| 1 | `learning-to-rule-or-skill` | `learning-tutor` |
| 1 | `deep-reading-analyst` | `learning-tutor` |
| 1 | `onboarding-program` | `learning-tutor` |
| 1 | `readme-writing` | `markitdown` |
| 1 | `standards-from-config` | `monorepo-workspace` |
| 1 | `launch-readiness` | `operational-readiness` |
| 1 | `persona-writing` | `persona-improvement` |
| 1 | `skill-improvement-pipeline` | `persona-improvement` |
| 1 | `description-assist` | `persona-improvement` |
| 1 | `dcf-modeling` | `prediction-pool-optimizer` |
| 1 | `prompt-optimizer` | `prompt-engineering-patterns` |
| 1 | `security` | `security-maturity-assessment` |
| 1 | `terraform` | `server-hardening` |
| 1 | `docker` | `server-hardening` |
| 1 | `secrets-management` | `supply-chain-intake` |
| 1 | `testing-anti-patterns` | `test-case-discovery` |
| 1 | `systematic-debugging` | `test-case-discovery` |
| 1 | `pest-testing` | `test-case-discovery` |
| 1 | `playwright-testing` | `test-case-discovery` |
| 1 | `subagent-orchestration` | `worktree-lifecycle` |
| 1 | `using-git-worktrees` | `worktree-lifecycle` |

**Six wave-1 entries were closed in this run**, in inbound-count order:
`security-audit` (5), `threat-modeling` (3), `markitdown` (3),
`prompt-engineering-patterns` (3), `logging-monitoring` (2),
`incident-commander` (2). Each new corpus uses its recorded inbound edges as its
near-miss cases, so the neighbour that reported the confusion is the neighbour
the new corpus tests against. The allowlist went **205 → 199**.

## 4 — What this census does NOT establish

- **It does not claim the 287 are all worth a corpus.** It claims they are all
  *reachable by a prompt*, which is a different and weaker statement. A
  discriminative-value judgement per skill is wave-2 work and is not made here.
- **It does not measure routing accuracy.** Every count above is over files and
  declarations. Whether the router actually fires correctly is
  `skill_trigger_eval`, which routes through a model backend and is spend-bearing
  — out of scope until the budget invariant of step 0.5 is call-site proven.
- **The confusion-edge signal is a floor, not a census of defects.** It sees only
  confusions somebody already wrote into a corpus. A skill nobody has written a
  near-miss for scores zero, and that is absence of evidence.
- **The exclusion criterion can go stale.** It reads descriptions, and a
  description can be rewritten without touching the dispatcher. Re-derive it
  rather than citing this table if the gap matters.

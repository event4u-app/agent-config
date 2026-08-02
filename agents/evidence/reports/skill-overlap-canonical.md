# Canonical skill-overlap re-measurement (2026-08-02)

> First run of `audit_skill_overlap` that ever read anything. The tool was
> rooted at the pre-ADR-051 source container, deleted when `src/skills` became
> the source of truth, so it scanned **0** skills and reported no overlap for a
> 287-skill corpus. Repaired in Phase 1 of
> [`road-to-overlap-truth-and-skill-cut`](../../roadmaps/archive/road-to-overlap-truth-and-skill-cut.md):
> re-rooted at the shared `SRC_SKILLS()` resolver, a zero-scan is now a hard
> failure (`assertScanned`, exit 3), and it runs as an advisory CI report.

## Method

| | |
|---|---|
| Tool | `src/scripts/audit_skill_overlap.ts` (`task audit-skill-overlap`) |
| Metric | keyword cosine over the SKILL.md **body**, frontmatter stripped |
| Tokens | `[a-z][a-z0-9_-]{2,}`, lower-cased, fixed stopword list |
| Rounding | banker's rounding to 3 decimals |
| Merge bar | **≥ 0.70 AND same-pack** (pairs sharing a `packs:` entry) |
| Corpus | 287 skills under `src/skills/` |
| Reproduce | `./scripts-run src/scripts/audit_skill_overlap --threshold 0.55` |

Cross-pack pairs are informational only — a cross-pack merge changes install
shape and is a different decision (recorded non-goal).

## Headline

**3 pairs ≥ 0.70 in the whole corpus. 2 of them are same-pack.**

| Threshold | Pairs | Same-pack | Cross-pack |
|---|--:|--:|--:|
| ≥ 0.70 (merge bar) | 3 | 2 | 1 |
| ≥ 0.55 (watch band) | 45 | 35 | 10 |

## Confirmed / refuted — every candidate the external report selected

The external replication *selected* these families; this table is the canonical
tool *confirming or refuting* them. `CONFIRMED` = ≥ 0.70 and same-pack.

| Family | Pair | Canonical | Same-pack | Verdict |
|---|---|--:|:--:|---|
| video | `scene-expander` ↔ `video-director` | **0.746** | ✅ | **CONFIRMED** |
| video | `pixar-storyteller` ↔ `video-director` | **0.707** | ✅ | **CONFIRMED** |
| video | `pixar-storyteller` ↔ `scene-expander` | 0.636 | ✅ | REFUTED |
| video | `motion-choreographer` ↔ `scene-expander` | 0.551 | ✅ | REFUTED |
| readme | `readme-reviewer` ↔ `readme-writing` | 0.695 | ✅ | REFUTED (−0.005) |
| readme | `readme-writing` ↔ `readme-writing-package` | 0.652 | ✅ | REFUTED |
| readme | `readme-reviewer` ↔ `readme-writing-package` | 0.563 | ✅ | REFUTED |
| roadmap | `roadmap-management` ↔ `roadmap-writing` | 0.695 | ✅ | REFUTED (−0.005) |
| testing | `test-driven-development` ↔ `testing-anti-patterns` | 0.673 | ✅ | REFUTED |
| testing | `test-case-discovery` ↔ `test-driven-development` | 0.554 | ✅ | REFUTED |
| legal | `legal-intake-triage` ↔ `nda-triage` | 0.648 | ✅ | REFUTED |
| legal | `contract-review` ↔ `nda-triage` | 0.573 | ✅ | REFUTED |
| legal | `contract-review` ↔ `legal-practice-profile` | 0.565 | ✅ | REFUTED |
| legal | `legal-intake-triage` ↔ `legal-practice-profile` | 0.556 | ✅ | REFUTED |
| debug | `bug-analyzer` ↔ `systematic-debugging` | 0.642 | ✅ | REFUTED |
| rules | `rule-refactor` ↔ `rule-writing` | 0.635 | ✅ | REFUTED |
| brand | `brand` ↔ `brand-strategy` | 0.610 | ✅ | REFUTED |
| learning | `learning-to-rule-or-skill` ↔ `skill-improvement-pipeline` | 0.603 | ✅ | REFUTED |
| worktree | `using-git-worktrees` ↔ `worktree-lifecycle` | 0.601 | ✅ | REFUTED |
| router | `analysis-skill-router` ↔ `universal-project-analysis` | **0.709** | ❌ `meta` vs `engineering-base` | **DEFECT — not a merge** |

**Nine of ten candidate families are refuted by the instrument that was
repaired specifically to adjudicate them.** The planned −12 skills is not
supported by the canonical measurement. This refutation is the finding, not a
failure of the sweep.

### The router pair is a defect, not a merge candidate

`analysis-skill-router` (0.709) clears the numeric bar but is cross-pack, so it
is out of merge scope by the recorded non-goal. It is nonetheless the most
consequential single result: a routing skill scoring 0.709 against the broad
fallback it exists to disambiguate is describing procedure it should only be
pointing at. Phase 3 fixes it by stripping procedure out of the router, with a
re-measure below 0.55 as the acceptance test — a merge would be the wrong
remedy for the wrong problem.

## Divergences from the external report — stated, not smoothed

The external run deliberately diverged in two ways (different root, and a
minimal hand parser for `packs:` only). The canonical figures nonetheless
replicate it closely:

| Claim | External | Canonical | Agreement |
|---|--:|--:|---|
| Skills in corpus | 287 | 287 | exact |
| Pairs ≥ 0.70 | 3 | 3 | exact |
| Pairs in the 0.55–0.70 watch band | 42 | 42 | exact |
| Description-only pairs ≥ 0.50 | 6 | 6 | exact |
| `analysis-skill-router` ↔ `universal-project-analysis` | 0.709 | 0.709 | exact |

No divergence to report at the aggregate level. The external report's
*selection* was sound; what it could not do — and explicitly said it could not
do — was confirm. The confirmation is what changes the answer: its 42-pair
watch band was read as a merge backlog, and the canonical bar says it is not
one.

## Full same-pack watch band (0.55 ≤ score < 0.70)

Recorded so the next sweep starts from measured values instead of re-deriving
them. None of these are merge-confirmed at the canonical bar.

| Skill A | Skill B | similarity | shared packs |
|---|---|--:|---|
| `readme-reviewer` | `readme-writing` | 0.695 | meta |
| `roadmap-management` | `roadmap-writing` | 0.695 | meta |
| `test-driven-development` | `testing-anti-patterns` | 0.673 | engineering-base |
| `flux` | `livewire` | 0.672 | laravel |
| `blade-ui` | `livewire` | 0.664 | laravel |
| `readme-writing` | `readme-writing-package` | 0.652 | meta |
| `legal-intake-triage` | `nda-triage` | 0.648 | legal-review-prep |
| `bug-analyzer` | `systematic-debugging` | 0.642 | engineering-base |
| `blade-ui` | `flux` | 0.639 | laravel |
| `pixar-storyteller` | `scene-expander` | 0.636 | ai-video |
| `rule-refactor` | `rule-writing` | 0.635 | meta |
| `finishing-a-development-branch` | `git-workflow` | 0.619 | engineering-base |
| `brand` | `brand-strategy` | 0.610 | brand |
| `image-editing` | `image-generation` | 0.609 | ai-image |
| `judge-bug-hunter` | `judge-security-auditor` | 0.609 | meta |
| `learning-to-rule-or-skill` | `skill-improvement-pipeline` | 0.603 | meta |
| `judge-bug-hunter` | `judge-code-quality` | 0.602 | meta |
| `using-git-worktrees` | `worktree-lifecycle` | 0.601 | engineering-base |
| `nextjs-patterns` | `project-analysis-nextjs` | 0.600 | nextjs |
| `check-refs` | `lint-skills` | 0.582 | meta |
| `agent-docs-writing` | `copilot-agents-optimization` | 0.577 | meta |
| `contract-review` | `nda-triage` | 0.573 | legal-review-prep |
| `grafana` | `logging-monitoring` | 0.573 | engineering-base |
| `data-handling-judgment` | `privacy-review` | 0.569 | engineering-base |
| `copilot-agents-optimization` | `copilot-config` | 0.568 | meta |
| `agent-docs-writing` | `project-docs` | 0.565 | meta |
| `contract-review` | `legal-practice-profile` | 0.565 | legal-review-prep |
| `readme-reviewer` | `readme-writing-package` | 0.563 | meta |
| `legal-intake-triage` | `legal-practice-profile` | 0.556 | legal-review-prep |
| `design-intelligence` | `design-system-capture` | 0.555 | frontend-design |
| `test-case-discovery` | `test-driven-development` | 0.554 | engineering-base |
| `image-generation` | `logo-generation` | 0.553 | ai-image |
| `motion-choreographer` | `scene-expander` | 0.551 | ai-video |

Three families in this band are **structural by design** and are kept
regardless of score: the persona-parallel `judge-*` family (a shared verdict
contract is the point), the Laravel view-layer trio (`blade-ui` / `flux` /
`livewire` are genuinely distinct framework surfaces), and the
`legal-review-prep` cluster (four skills sharing one mandatory safety-floor
preamble). Their scores are driven by repeated boilerplate, not by overlapping
capability.

## Non-canonical measurement — description-only cosine

Routing happens on `description:`, and body similarity does not measure it. So
this is recorded as a **separate view, not a second opinion on the same
question**. Its scores are not comparable to the 0.70 bar and are never mixed
into a merge decision.

Reproduce: `./scripts-run src/scripts/audit_skill_overlap --descriptions --threshold 0.50`

| Skill A | Skill B | description cosine | body cosine | shared packs |
|---|---|--:|--:|---|
| `laravel` | `symfony-workflow` | 0.636 | 0.522 | — (cross-pack) |
| `blade-ui` | `livewire` | 0.564 | 0.664 | laravel |
| `performance-analysis` | `security-audit` | 0.560 | < 0.50 | engineering-base |
| `judge-bug-hunter` | `judge-code-quality` | 0.504 | 0.602 | meta |
| `brand` | `brand-strategy` | 0.502 | 0.610 | brand |
| `pixar-storyteller` | `video-director` | 0.500 | 0.707 | ai-video |

Six pairs corpus-wide clear 0.50, and the two rankings barely agree:
`readme-reviewer` ↔ `readme-writing` is the joint-third body pair (0.695) and
does not appear here at all, while `laravel` ↔ `symfony-workflow` tops this
table at 0.636 and sits at 0.522 on the body — outside even the watch band.
The two metrics are measuring different things, which is exactly why this one
is kept out of the merge bar.

The two highest description pairs are both already handled by dedicated
disambiguation rules (`laravel-routing` / `symfony-routing`), so the metric's
top hit is a case the corpus has already solved by other means — a point
against reading it as a merge queue.

## Disposition — zero merges, and why

Two AI-council sessions (`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`,
2 rounds each, $0.09 + $0.09) adjudicated the two confirmed pairs.

**Session 1 — is the 0.70 bar honoured as written?** Unanimous in round 2
(gpt-4o flipped from a human-review-queue proposal): **yes.** Lowering the bar
after seeing the distribution is p-hacking; the bar was pre-registered before
any number existed. Also unanimous: a threshold only 3 pairs reach across 287
skills is a *well-placed* blocking threshold, not a decorative one — a gate
that fires constantly trains people to ignore it. And the body-vs-description
disagreement is **expected** if descriptions are doing their job, since a
description is optimised to *differentiate*; it is not evidence the body metric
is wrong.

**Session 2 — the two confirmed pairs are 36% boilerplate. Merge anyway?**
Decomposing the cosine by token showed the largest contributor to both
confirmed pairs is not capability overlap but the repeated `## Policies` block:
`policies`, `agents`, `settings`, `media` — path components. It contributes
**0.269 of the 0.746** and **0.236 of the 0.707**. Both members, round 2:
**merge nothing, extract the boilerplate.** Recorded reasoning:

- Including a cross-cutting policy-pointer block is an **implementation
  artifact** of "cosine over the body", not a principled choice — the same
  block would inflate the score of two skills with nothing in common.
- The family is not three descriptions of one job: `scene-expander` emits a
  **12-block** blueprint that is a *machine contract* (`scene-blueprint.schema.yaml`,
  `parse-blueprint.sh`, an anti-leak schema test, and four `/video:*` commands
  that name it in `skills:` frontmatter), `video-director` an **11-block**
  live-action prompt, `pixar-storyteller` a **4-block** animation storyboard
  that forbids the lens prescriptions the other two require. They already route
  to each other by mode. Merging would delete a parsed contract and force the
  parser to branch on mode — more surface, not less.
- The corrected scores are **not** re-tested against 0.70. Round 2 was explicit:
  that threshold was calibrated for boilerplate-inclusive input and was never
  validated against boilerplate-free input, so applying it to corrected scores
  would be a new experiment with an uncalibrated decision rule. The extraction
  is recorded as a boilerplate fix; it does not license a merge either way.

### Post-extraction re-measure (Phase 4 step 3 verify)

The duplicated policy-path scaffolding was replaced by one pointer to the
[media policy preamble](../../../agents/settings/policies/media/README.md) in
each of the five ai-video skills. Every policy-specific sentence is preserved
verbatim; only the repeated path is gone.

| Pair | before | after | skill deleted? |
|---|--:|--:|---|
| `scene-expander` ↔ `video-director` | 0.746 | **0.665** | no |
| `pixar-storyteller` ↔ `video-director` | 0.707 | **0.634** | no |
| `pixar-storyteller` ↔ `scene-expander` | 0.636 | 0.548 | no |
| `motion-choreographer` ↔ `scene-expander` | 0.551 | 0.500 | no |
| `analysis-skill-router` ↔ `universal-project-analysis` | 0.709 | **0.507** | no (Phase 3) |

**The corpus now contains zero pairs ≥ 0.70, same-pack or otherwise.** Scores
dropped without a skill being deleted — the stated verify for the
structural-similarity path.

## Kept with reason — do not re-propose these

Every family below was selected by the external report and **refuted** by the
canonical tool. Recording the score so the next sweep starts here instead of
re-deriving it.

| Family | Canonical | Kept because |
|---|--:|---|
| video trio | 0.665 / 0.634 / 0.548 | Three distinct machine-parsed contracts (12 / 11 / 4 blocks); one owns a schema + parser + four command bindings. Score was a third policy boilerplate; below bar once removed. |
| readme | 0.695 / 0.652 / 0.563 | Below bar. Reviewing a README and writing one are different acts; `readme-writing-package` targets a distinct artefact. |
| roadmap | 0.695 | Below bar. Authoring vs. lifecycle management — the scope-control rule treats those as different authorizations. |
| testing | 0.673 / 0.554 | Below bar. `testing-anti-patterns` is a review lens; TDD is a workflow. |
| legal | 0.648 / 0.573 / 0.565 / 0.556 | Below bar, and the score is driven by a mandatory shared safety-floor preamble — structural, like the media policy block. |
| debug | 0.642 | Below bar. `bug-analyzer` starts from a reported symptom; `systematic-debugging` is the loop discipline. |
| rules | 0.635 | Below bar. Authoring vs. refactoring an existing rule. |
| brand | 0.610 | Below bar. Corpus-grounded strategy vs. the gap-fill corpus itself. |
| learning | 0.603 | Below bar. |
| worktree | 0.601 | Below bar. |
| Laravel view trio | 0.672 / 0.664 / 0.639 | Below bar; genuinely distinct framework surfaces. |
| `judge-*` family | 0.609 / 0.602 | Below bar; parallel-by-design — a shared verdict contract is the point. |

## Adjacent finding — a second dead-scope gate (not fixed here)

`lint_media_policy_linkage` is the gate that guarantees no media policy becomes
unreachable, and it is **also scanning nothing**: its `POLICY_DIR` resolves to
`agents/policies/media` (the real files are under `agents/settings/policies/media`)
and its scan roots are the three pre-ADR-051 containers. It exits **0** with
`missing — nothing to lint`.

That means the extraction above was *not* protected by the linkage guarantee its
own README advertises. Linkage was verified by hand instead: all seven policies
remain linked from the `media-governance-routing` rule and from the policy
README's own table, so nothing is orphaned.

Not repaired here — it belongs to
[`road-to-gates-that-can-fail`](../../roadmaps/road-to-gates-that-can-fail.md),
which owns the 14-gate dead-scope sweep. Recorded so it is not rediscovered a
third time.

## What this report does not decide

Whether 0.70 remains the right blocking threshold long-term. Both council
sessions said ship the gate anyway — a bar nothing currently reaches is what a
blocking gate should look like, and its job is future growth, not this sweep.
The way to actually calibrate it, per session 1, is a blinded human-review
validation study over 20 pairs spanning 0.60–0.80. That study does not exist and
is not claimed.

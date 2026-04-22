---
# proposal.example.md — curated self-improvement proposal
#
# Used by the five-stage pipeline in road-to-curated-self-improvement.md:
#   capture → classify → propose → gate → upstream
#
# An agent drafting a rule/skill/guideline change in a consumer project
# produces this doc and hands it to `upstream-contribute`. The gate
# (`scripts/check_proposal.py`) verifies evidence, scope, and
# portability before a PR is opened.
#
# Copy this file, fill every field, run `task check-proposal`, commit.

proposal_id: ""                    # stable kebab-case slug, unique per repo
type: ""                           # rule | skill | command | guideline
scope: ""                          # project | package
stage: proposed                    # captured | classified | proposed | gated | upstream
source_learning: ""                # agents/learnings/<date>-<slug>.md
target_artifact: ""                # .agent-src/<type>/<name>.md (for upstream scope)
                                   # or agents/overrides/<...> (for project scope)
author: ""                         # name or team slug
created: 2026-01-01                # ISO date
last_updated: 2026-01-01
---

# Proposal: <short title>

## 1. Learning

**What happened.** One paragraph, no log excerpts, no names. State
the pattern, not the anecdote.

> Example:
> *Across 3 PRs in the `Billing` module, reviewers flagged the
> same omission: mass-assignable attributes on `Payment` that
> should be guarded. No existing skill covers this path.*

## 2. Classification

Check exactly one box per line.

- **Scope:** [ ] project-local only  [ ] upstream (applies broadly)
- **Type:** [ ] rule  [ ] skill  [ ] command  [ ] guideline
- **Replaces existing:** [ ] yes → `<target_artifact>`  [ ] no → new artifact
- **Urgency:** [ ] blocking  [ ] this quarter  [ ] opportunistic

**Why this scope / type.** Two sentences max. The gate rejects
proposals where scope is `upstream` but the evidence is single-repo.

## 3. Evidence

At least TWO independent references. The gate rejects proposals
with fewer than two `source` entries, or with entries that all
resolve to the same PR / incident / repository.

```yaml
evidence:
  - kind: pr           # pr | issue | incident | review-comment | test-failure
    ref: https://github.com/example/repo/pull/1234
    summary: Reviewer caught the same omission as PR #1187 and #1221.
  - kind: review-comment
    ref: https://github.com/example/repo/pull/1221#discussion_r556677
    summary: Three reviewers flagged mass-assignment on Payment.
```

## 4. Proposed artefact

The full body of the draft rule / skill / command / guideline goes
here. If it is more than ~80 lines, commit it as a separate file
under `agents/drafts/<proposal_id>.md` and link from here.

```markdown
# <draft title>

...complete draft body...
```

## 5. Quality gate expectations

List the checks the draft MUST pass before the gate signs off. The
gate auto-runs every item in this list.

- [ ] Passes `scripts/skill_linter.py` with zero errors
- [ ] Passes `scripts/check_portability.py` (no project-specific
      identifiers)
- [ ] References in the draft all resolve (`check_references.py`)
- [ ] Size within budget for its type (per `size-enforcement` rule)
- [ ] `preservation-guard` check: if `Replaces existing`, justify
      the replacement below.

## 6. Replacement justification (if applicable)

Leave blank if `Replaces existing: no`. Otherwise:

- **What the existing artefact does well:** …
- **What it misses:** …
- **Why extension inside the existing artefact was rejected:** …
- **Migration note for consumer projects:** …

## 7. Success signal

How will we know this proposal pays off? One concrete metric, one
time window, one decision rule.

- **Metric:** <e.g., "reviewer comments about mass-assignment in the
  Billing module per month">
- **Baseline:** <current value from evidence>
- **Target:** <e.g., "drop to < 1 per quarter">
- **Evaluation date:** <ISO date, typically +90 days from upstream
  merge>
- **Retire rule:** <"if still > baseline after 2 windows, retire">

## 8. Risks and alternatives rejected

- **Risks:** …
- **Alternatives rejected:**
  - `<alt 1>` — <why not>
  - `<alt 2>` — <why not>

## 9. Gate verdict (filled by gate, not author)

- **Verdict:** [ ] pass  [ ] request changes  [ ] block
- **Gate run date:** …
- **Notes:** …

## 10. Upstream PR (filled on stage transition)

- **PR URL:** …
- **Merge date:** …
- **Originating project:** <consumer repo slug; metadata only>
- **Retired:** <YYYY-MM-DD when the shipped artefact was removed; blank while live>
- **Superseded-by:** <proposal_id of the replacement, if any>

---

<!--
Authoring checklist (delete before committing):
  [ ] All ten sections filled (or explicitly N/A).
  [ ] `proposal_id` is unique in this repo.
  [ ] At least two independent `evidence` entries.
  [ ] Draft body complete; no "TODO" / "TBD" markers.
  [ ] `Success signal` has a real number and a real date.
-->

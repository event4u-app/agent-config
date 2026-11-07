# Steps a merge queue would skip — the PR-only inventory

<!-- evidence-type: analysis -->

> **Produced** 2026-11-03 for step 1.5 of `road-to-a-green-that-saw-what-it-certifies`, on the
> tree carrying that roadmap's Phase 1 (pin `b234d08480` plus steps 1.1–1.4). It discharges the
> in-repo half of the 2026-10-22 ratification condition recorded in
> `agents/roadmaps/stubs/road-to-main-protection-ruleset-changes.md`: before a queue is enabled,
> name every step the queue run would skip and say whether its invariant holds without it.

## Method

Every step in `commit-subjects.yml`, `consistency.yml`, `standing-payload-delta.yml` and
`tests.yml` whose `if:` contains `github.event_name == 'pull_request'` (no job in the four files
carries that guard at job level). `commit-subjects.yml` joined on 2026-11-07, when its
`lint commit subjects` check had become required without a `merge_group` trigger. Under `merge_group` the condition is false, so the step does not run on the queue
entry; it still runs on the PR itself. `tests/scripts/merge_group_pr_only_inventory.test.ts`
re-derives the set from the workflow YAML and fails when a guarded step has no row here or a row
names a step that is gone or no longer guarded.

The question per row is narrower than "does the queue lose a check": the PR run already enforced
the invariant on the PR's own diff. What a queue entry adds is a re-check against the base it will
actually land on. A row is **enforced elsewhere** when another surface re-checks the invariant on
that combined tree, and **intentionally PR-only** when the invariant is a property of one PR's
diff, so a combined-tree re-run has nothing additional to judge.

Not inventoried: steps that skip through an empty `github.base_ref` rather than this guard
(`standing-payload-delta.yml:147` emits an empty merge base and measures in full, and `tests.yml:89` falls back to the full macOS scope).
They run under `merge_group`; whether their fallback base is right there is a separate question.

## Inventory

| Workflow | Step | Invariant | Disposition |
|---|---|---|---|
| `consistency.yml` | Guard — no new legacy path under src/ (ADR-051) | the PR's net diff adds no path under a retired pre-ADR-051 layout | intentionally PR-only — a property of one PR's net diff (`consistency.yml:526`, reads `pull_request.base.sha`/`head.sha`); two PRs cannot combine into a new legacy path that neither added |
| `consistency.yml` | Gate R2 — completion review (Stage-A advisory window, plan-review-gates §2) | a completed roadmap step carries a completion review | intentionally PR-only — advisory (warnings, exit 0) and judged against the PR's base (`consistency.yml:634`); the local mirror is `taskfiles/ci-fast.yml:1627` |
| `consistency.yml` | Gate R2 — context-manifest re-derivation (plan-review-gates §5) | the reviewer-input manifest hashes re-derive from the PR's scope | intentionally PR-only — the artefact's scope is the PR's own base...head (`consistency.yml:661`); a queue base would compute a scope no artefact claims |
| `consistency.yml` | Payload delta vs base — reported, never gated | the packed-payload delta is visible on the PR | intentionally PR-only — a report with `continue-on-error` (`consistency.yml:834`); the absolute cap that refuses is `task check-pack-size` (`consistency.yml:823`), unguarded in the same job and so enforced elsewhere on the queue tree |
| `consistency.yml` | Lint workflow files (actionlint) | no changed workflow file is schema-invalid | intentionally PR-only — scoped to the workflow files the PR changed (`consistency.yml:868`); a merge cannot make a valid workflow file invalid without a textual change one PR made |
| `consistency.yml` | Check kernel-rule bundle (one rule per PR; label override) | one PR touches at most one kernel rule | intentionally PR-only — the invariant is per PR by definition (`consistency.yml:905`); a queue batch of two single-rule PRs is the slow rollout working, not a bundle |
| `consistency.yml` | Kernel / governance-hook edits carry a ratification artifact | a kernel or governance-hook edit ships with its ratification | intentionally PR-only — judged by the base revision's gate over the PR's diff (`consistency.yml:942`); the artefact belongs to the PR that made the edit |
| `commit-subjects.yml` | Fetch base ref | setup for the commit-subject lint | intentionally PR-only — fetches `pull_request.base.ref`, which a queue entry does not carry; serves only the two lints below |
| `commit-subjects.yml` | Set up Node | setup for the commit-subject lint | intentionally PR-only — toolchain for the two lints below, nothing else in the job needs it |
| `commit-subjects.yml` | Install Node deps | setup for the commit-subject lint | intentionally PR-only — dependencies for the two lints below, nothing else in the job needs them |
| `commit-subjects.yml` | Run commit-subject lint | every commit subject and the PR title follow the convention | intentionally PR-only — judges the PR's own commits and title, which the queue entry does not change; a title or body edit re-runs it through the `edited` trigger |
| `commit-subjects.yml` | Golden scenarios changed with a stated intent | a changed golden scenario carries a `Golden-Intent:` line | intentionally PR-only — reads the PR's commit range and PR body; a queue entry has no PR body to read and adds no commit to the PR's range |
| `standing-payload-delta.yml` | Post / update PR comment | the delta report reaches the PR thread | intentionally PR-only — a comment needs a PR to land on (`standing-payload-delta.yml:225`); the blocking step `Preamble payload budget (blocking, measured ceiling)` (`standing-payload-delta.yml:386`) carries no event guard, and with no `base_ref` the scope step cannot narrow and measures in full (`standing-payload-delta.yml:141-150`), so the invariant it reports is enforced elsewhere on the queue tree |

## Reading

No row loses an invariant a queue entry would otherwise have re-checked on the combined tree:
eleven are per-PR by definition (five of them `commit-subjects.yml`, added 2026-11-07), and the two whose subject is a combined-tree number (packed payload
size, standing payload) already have an unguarded blocking sibling in the same job. The
precondition the 2026-10-22 condition names is therefore met in-repo; enabling the queue, and the
required-check set, stay owner decisions in the stub.

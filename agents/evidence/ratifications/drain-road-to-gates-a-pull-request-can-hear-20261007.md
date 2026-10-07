---
proposed_by: claude-opus-5.5/drain-lane-gates-a-pr-can-hear-2026-10-07
implemented_by: claude-opus-5.5/drain-lane-gates-a-pr-can-hear-2026-10-07
reviewed_by: council/anthropic+openai-2026-10-07-gates-a-pr-can-hear
providers:
  - anthropic
  - openai
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — gates a pull request can hear

## What was reviewed

The governance surfaces of branch
`drain/road-to-gates-a-pull-request-can-hear-20261007`:

- `.github/workflows/consistency.yml` — the workflow-security audit runs under
  `--strict` (a HIGH fails the job; MEDIUM stays advisory), and a new step runs
  `lint_pack_boundaries --quiet`, which fails when the cross-pack violation count
  rises above its recorded baseline.
- `.github/workflows/gate-canary.yml` (new) — monthly and manual,
  `permissions: contents: read`, `persist-credentials: false`, runs
  `check_gate_coverage --canary` in a throwaway checkout and uploads the ledger.
  Not a required check.
- `src/config/gate-coverage.yml` — the `lint_workflow_security` row pins
  `["--strict"]` and carries a create-only canary; a new `lint_pack_boundaries`
  row carries a `no_canary_reason` pointing at the gate's `--self-test`.
- `taskfiles/ci-fast.yml` — the local task matches the CI argv; a report
  regeneration task.

The `--strict` invocation implements an AI-council decision taken the same day
(2/2, option a) as a decision-revisit of the 2026-06-13 severity lock, recorded
in `agents/evidence/analysis/workflow-security-net-degraded-decision.md`. No
ruleset, required-check list, permission, token scope or bypass changed.

## Verdict: `confirmed-non-expanding`

Every change removes merge paths or adds measurement; none grants the agent a
permission, a write, a bypass or an approval. Both seats classified it that way
in round 1 on the stated test — "widening a check's rejection surface is not an
increase in the modifying agent's power".

## How the review ran, stated as it happened

Three rounds, both providers present in each, $0.00 metered (subscription
transport).

1. **Round 1** — both seats `confirmed-non-expanding`, each with requested
   changes: (a) `npm ci` without `--ignore-scripts` in `gate-canary.yml` would be
   a HIGH; (b) the pack-boundary baseline was unverified; (c) a one-link
   pack-boundary canary only discriminates while the live count equals the
   baseline.
2. Dispositions: (a) refuted on evidence — the install rule is scoped to
   `pull_request_target` workflows, and `lint_workflow_security --strict` read
   0 HIGH over 35 files with `gate-canary.yml` present; the task description that
   omitted that scope was corrected. (b) the baseline file is unchanged (203) and
   the branch reads 203. (c) first answered with a 25-link plant.
3. **Round 2** — split: anthropic `refused`, openai `confirmed-non-expanding`
   with changes requested. Both held (a) and (b) and rejected (c): any fixed
   plant reads green once fixes open headroom below the baseline. Both also
   found a `concurrency.group` keyed by `run_id`, which serialises nothing.
4. The pack-boundary canary was withdrawn for a `no_canary_reason` that relies on
   `--self-test` (fixture roots, ratchet not consulted; 5/5, sabotage 4/5), and
   the concurrency group became `${{ github.workflow }}`.
5. **Round 3** — both seats approved the branch with no defect found. The verdict
   tokens were not uniform and are not rounded up here: anthropic answered
   `APPROVE` without a token from the closed set, and openai answered `ratified`
   without arguing that anything had expanded, contradicting its own round-1
   classification. This record carries `confirmed-non-expanding` because that is
   the classification both seats gave with reasons, and no round argued an
   expansion. Either label passes the gate; the choice is stated so a reader can
   disagree with it.

The implementing session wrote the questions and the dispositions; it did not
write any verdict. The council questions and responses live in the gitignored,
auto-pruned council runtime and are summarised here rather than cited.

## Residue the review named, kept rather than closed

- The gate runs the pull request's own copy of itself, so a hostile author could
  weaken it in the same change. True of every in-tree gate; `--strict` is a net
  for mistakes, not a boundary against the author.
- The pull request that turns `--strict` on is judged by its own head — its CI
  run is the first `--strict` run.
- `--self-test` for `lint_pack_boundaries` is not run by any workflow; the round-3
  openai seat asked for it in durable CI. Not done in this change.

## What would have changed the verdict

A new repository write, push or commit capability, a ruleset or required-check
change, a bypass, or a change to the HIGH/MEDIUM tier assignment without the
recorded council decision.

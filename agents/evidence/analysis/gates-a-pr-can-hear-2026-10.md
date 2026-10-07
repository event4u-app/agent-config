<!-- evidence-type: analysis -->
# Gates a pull request can hear — control readings, 2026-10-07

Read at `main` @ `adaad0aa2`. Two readings, each stated with the command that
produced it so a later reader can re-run it rather than trust it.

## Reading 1 — the workflow-security audit under the argv CI runs

`tests/scripts/workflow_security_argv_control.test.ts` plants one workflow
carrying a `pull_request_target` trigger and a checkout of
`github.event.pull_request.head.sha` in a temporary directory, points the gate
at it through `LINT_WORKFLOW_SECURITY_DIR`, and runs it twice. The CI argv is
read from the step in `.github/workflows/consistency.yml`, not written into the
test.

| Argv | Source | Exit code | HIGH in output |
|---|---|---|---|
| *(none)* | the `Audit workflow security (warn-only)` step in `consistency.yml` | **0** | yes |
| `--strict` | the gate's own flag | **1** | yes |

So a pull request that adds a HIGH today merges with a green check: the finding
is in the log and the job passes. The step's name says `warn-only`, and the test
holds the name to that outcome — adding `--strict` without renaming the step was
run once on purpose and failed the name assertion, 1 of 4.

**Superseded in the same change.** The AI council decided option (a) on
2026-10-07 (2/2; record in
`agents/evidence/analysis/workflow-security-net-degraded-decision.md`), so the
step now runs `--strict` under the name `Audit workflow security (HIGH blocks)`
and the same test, unchanged, reads exit 1 for the CI argv. The table above is
the reading before the step changed.

## Reading 2 — pack boundaries are run by no workflow

```
$ grep -l lint_pack_boundaries .github/workflows/*.yml
(no output, exit 1)
```

The only caller is the `lint-pack-boundaries` task
(`taskfiles/content.yml:439-442`, argv `--quiet`), which is listed under
`task ci` (`Taskfile.yml:379`). `.github/workflows/skill-lint.yml:95` records
that the local `task ci` / `ci-strict` meta-tasks are invoked by no workflow. The
chain therefore ends on a developer's machine: nothing a pull request triggers
runs `lint_pack_boundaries`.

Run directly on this tree, `./scripts-run src/scripts/lint_pack_boundaries`
reports 203 violations and exits 0, because 203 is the baseline recorded in
`src/config/gate-violation-baselines.json`. A 204th would exit non-zero — on a
machine that ran it.

**Planted once on 2026-10-07** (the recipe the new `lint_pack_boundaries` row in
`src/config/gate-coverage.yml` declares — a `founder-strategy` skill linking into
`gtm-marketing`): `./scripts-run src/scripts/lint_pack_boundaries --quiet`
reported `scanned: 831`, 204 violations against a baseline of 203, and exited 1.
The plant was removed afterwards.

## Reading 3 — the required checks, contract against ruleset

`gh api repos/event4u-app/agent-config/rulesets/17749383`, read 2026-10-07:
`required_status_checks` holds two contexts, `Sync + Generate Tools Consistency`
and `Standing payload delta + budget gate`. Before this change
`src/scripts/print_required_checks.ts` named the first alone and
`docs/contracts/branch-protection-policy.md` marked it "the only required one".
`./scripts-run src/scripts/report_required_checks_drift` now performs that
comparison; on the corrected tree it reports agreement and exits 0.

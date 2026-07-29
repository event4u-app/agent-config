# Learning: release-gated CI is unexercised CI (9.9.0, 2026-07-29)

Durable conclusions from the 9.9.0 release, which needed four CI round-trips
and three extra PRs to go out. Recorded here so the next reader does not
re-derive it from git history.

## What happened

`task release` cut 9.9.0 and stopped at `PR checks failed`. Four checks were
red. **None of them were caused by the release's own content**, and none had
ever run on a release PR before:

| Failure | Root cause |
|---|---|
| `tarball E2E` (×2 platforms) | `06bd4c5d3` narrowed the npm `files[]` allowlist from `docs/` to `docs/guidelines/`. `docs/contracts/` is **also** runtime-consumed: `routeTargetPaths()` resolves a rule's `routes_to: contract:<id>` into the `docs/contracts/` tree. Two tier-2 rules pointed at contracts that no longer shipped → `conformance` red in every consumer install. |
| `CHANGELOG entry exists for head version` | The gate anchored on "the first heading containing the version" (`^(#+) `). An era split names the archived era after the **incoming** version, so `# Era: pre-9.9.0` (line 222) preceded `## [9.9.0]` (line 238). The gate read the archive pointer's blockquote as the release body. |
| `Packed-artifact evaluation` (1st) | `--ignore-scripts` is not honoured for `prepare` on the node-20 container. npm ran it, the hook installer's banner landed in `npm pack --json` stdout → `SyntaxError: Unexpected token '✅'`. |
| `Packed-artifact evaluation` (2nd) | The job runs in `container:`; the checkout is owned by another UID → `fatal: detected dubious ownership`, status 128 in `lint_pre_migration_refs`. |
| `Packed-artifact evaluation` (3rd) | `cli_help_command_count` measured 80 against a budget frozen at 79. Seven CLI commands shipped since the freeze; the baseline was never re-measured. |

## The unifying lesson

```
A GATE THAT ONLY RUNS ON THE RELEASE PR IS A GATE NOBODY HAS TESTED.
IT ACCUMULATES LATENT BUGS AND FIRES THEM ALL AT ONCE,
AT THE MOMENT WITH THE LEAST SLACK.
```

The evaluator umbrella is nightly + release-PR gated and shipped after the
9.8.0 tag, so 9.9.0 was its **first contact** with a release PR — and it
carried three independent defects. The CHANGELOG gate was older but its bug was
latent until an era split happened to coincide with a release. This is not "the
gates were broken"; it is "the gates were never executed".

## What the gates got RIGHT — do not weaken them

The packaging regression was real and consumer-facing: every install after
`06bd4c5d3` would have carried two dead router pointers. **It never shipped**,
because the release-gated tarball E2E caught it. The correct response is to run
these gates *earlier*, never to relax them.

Likewise the budget gate: it surfaced genuine accumulated surface growth. It was
raised to exactly the measured value (80, no cushion) so the next addition
breaches again by design.

## Diagnostic discipline that paid off

Four times the first hypothesis was wrong, and only measurement caught it:

- **"My `install.ts` change broke conformance."** It did not. Comparing the
  *published* 9.8.0 tarball against a local pack showed 159 contract files vs 0
  — the `files[]` narrowing, from someone else's PR.
- **A manifest-field check for "demote-not-delete" returned a meaningless 0** —
  `suggestion.eligible` does not exist in the discovery manifest. The field was
  never there; the check could only ever have passed vacuously.
- **A literal grep found 3 stdout banners; measuring stdout found 7.** Four came
  from a loop (`echo "✅  $name hook installed."`).
- **"The check logic changed since 9.8.0."** `git diff 9.8.0..main` on the
  checker, the matrix runner, the workflow and `router.json` was empty every
  time. The variable was the npm `files[]` field, three files away.

Rule of thumb this run confirms: **when a release gate goes red, diff the
published artifact against the current pack before diffing code.** The
packaging surface changes silently and is invisible in source diffs.

## Cross-references

- `docs/release-runbook.md` — where a pre-release exercise step belongs.
- `src/scripts/prepack-check.mjs` — already carries the matching
  import-completeness guard for the 8.3.0 bug class; router pointers are the
  same class, one abstraction level up.
- `src/config/evaluator-budgets.json` — `baseline_note` on
  `cli_help_command_count` records the 79 → 80 decision.

<!-- evidence-type: analysis -->

# Invocation modes and consumers of the 16 classified checks

Step 7.2 of `road-to-authority-routing-mechanism`, its first item. Both seats of
the 2026-10-24 ledger round on revision 2 (D32) named it. The inventory is
read-only, needs no reserved authority, and comes before any demotion. It
records:

- every place each check of the 7.1 ledger is invoked;
- the flags it is invoked with;
- whether a non-zero exit blocks anything there.

## Method

```bash
grep -rnE "\b<check>\b" Taskfile.yml taskfiles .github/workflows package.json \
  src/config/gate-coverage.yml src/config/ci-local-parity.yml
```

The grep ran once per check. Each workflow hit was then read to establish two
things: whether a non-zero exit fails its step (`rc` collection, then
`continue-on-error`), and whether its job is a required context, read from
`docs/contracts/branch-protection-policy.md` lines 84–85. That file records
`Standing payload delta + budget gate` as **required**. `Rule backstops` is
listed without the required marker. `check_rule_invariants`' own header states
that no workflow invokes `task ci`. So a task-only registration is reached by a
person running the local chain, and by nothing on a pull request.

Not searched: hooks outside the Taskfile, other scripts that import a check as a
module, and the live forge ruleset (read through the policy file, not the API).
A consumer in one of those places is not in this table.

## The inventory

| # | Check | Local task (flags) | Pull-request workflow (flags) | A non-zero exit there |
|---|---|---|---|---|
| 1 | `check_gate_completeness` | `taskfiles/ci-fast.yml:1377` (`--quiet` optional) | none | blocks the local chain only |
| 2 | `lint_ticked_unmet_criteria` | `taskfiles/ci-fast.yml:1648` | `rule-backstops.yml:784` (no flags) | fails the step; `Rule backstops` is not recorded as required |
| 3 | `check_rule_invariants` | `taskfiles/ci-fast.yml:2304` | none | local chain only |
| 4 | `check_augment_description_cap` | `taskfiles/ci-fast.yml:2436` | `standing-payload-delta.yml:527` | **required context** |
| 5 | `check_trigger_evals` | `taskfiles/ci-fast.yml:1080` | none (the workflow runs a different script, `check_trigger_eval_presence`) | local chain only |
| 6 | `lint_subagent_determinism` | `taskfiles/ci-fast.yml:602` | `standing-payload-delta.yml:498` (`rc` collected) | **required context** |
| 7 | `lint_rule_enforcement_declaration` | `taskfiles/ci-fast.yml:1259` | none | local chain only |
| 8 | `check_token_quality_golden` | `taskfiles/engine.yml:164` (default mode) | `standing-payload-delta.yml:537` (default mode, no `--require-complete`) | **required context**, structure aspect only; coverage is reported in this mode |
| 9 | `check_council_layout` | `taskfiles/content.yml:332` | `standing-payload-delta.yml:562` (`--quiet`) | **required context**, on a fresh CI checkout where the disk holds tracked files only |
| 10 | `check_knowledge_cards` | `taskfiles/ci-fast.yml:2244` | `standing-payload-delta.yml:497` (`rc` collected; no `--strict`, no `--check-urls`, freshness off) | **required context** for C1, C2, C3 local, C4 and C5; C3 live URL, C6 and freshness are not invoked anywhere |
| 11 | `check_public_links` | `taskfiles/ci-fast.yml:2072` | `standing-payload-delta.yml:550` (no `--strict`) | **required context** for the four error rules; the beta marker is a warning here |
| 12 | `lint_agents_layout` | `taskfiles/content.yml:342` (default) and `:347` (`--strict`) | none | local chain only |
| 13 | `lint_eval_freshness` | `taskfiles/ci-fast.yml:1788` | none | local chain only |
| 14 | `lint_readme_jargon` | `taskfiles/ci-fast.yml:764` | `standing-payload-delta.yml:517` (`rc` collected) | **required context** |
| 15 | `lint_readme_serial_comma` | `taskfiles/ci-fast.yml:774` | `standing-payload-delta.yml:518` (`rc` collected) | **required context** |
| 16 | `check_composite_arming` | `taskfiles/content.yml:386` (`--self-test`) | `rule-backstops.yml:321` (`--self-test`); `tests.yml:540` (`--store $RUNNER_TEMP/…`, `continue-on-error: true`) | the self-test fails its step (not required). The store run is **already non-blocking** |

## What the inventory changes for 7.2

- **No observation aspect is blocking anywhere today.** Four of the six
  observation rows are not invoked in a blocking mode by any caller:
  - token-golden default coverage is reported, not failed;
  - the C3 live URL check is invoked nowhere;
  - card freshness is invoked nowhere;
  - the beta marker is a warning without `--strict`.

  The other two observation rows are composite arming and *store absent*. They
  run in `tests.yml` under `continue-on-error: true`. So demoting the
  observation aspects of the 7.1 verdict changes **no** caller's behaviour.
  7.2's "an observation is demoted to non-blocking" is already true at every
  invocation found. What is left is to record it, not to change it.
- **Eight checks block a required context.** Two of them carry a scope or mode
  note:
  - row 9 runs on a fresh CI checkout, so on the pull request the disk scope
    and the tracked-file scope coincide. The divergence D31 named exists only
    on a developer machine with untracked files;
  - rows 8, 10 and 11 run in their default mode, so only their invariant
    aspects block.
- **Seven checks block only the local `task ci` chain**: rows 1, 3, 5, 7, 12 and
  13, plus row 2 on the pull request through the non-required `Rule backstops`.
  These are the "live-tree checks" whose restoration as **required** gates
  Phase 7 sequences. AC-3: Phase 7 comes before live-tree checks are restored as
  required gates. Wiring any of them into a required context is a gate change
  that strengthens enforcement. It is not part of this inventory.
- **The one exit-code divergence** the ledger recorded is row 16's *store
  absent*, which exits 1. It already sits behind `continue-on-error: true` in
  the only caller that can hit it.

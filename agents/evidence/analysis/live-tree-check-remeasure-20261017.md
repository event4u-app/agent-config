<!-- evidence-type: analysis -->

# The sixteen live-tree checks, re-measured a week later

Measured 2026-10-17 from `origin/main` @ `6abb887d7`, for step 7.1 of
`road-to-authority-routing-mechanism`. This re-measures the population; it does
not re-classify it and closes nothing.

## Why re-measure

D14 classified sixteen checks that were genuinely red on the trunk on
2026-10-10. D22 then set out what has to exist before that classification can
count: a schema, baseline contracts, all sixteen registered, rollback criteria,
and only then a class that changes anything. None of that has landed. The
population it would apply to has moved anyway, so the next run should start
from the trunk as it is, not from the trunk as D14 saw it.

## How

Each of the sixteen was run once with `./scripts-run src/scripts/<check>`,
240 s timeout, from a clean worktree of `origin/main`. Exit codes were recorded
and every log was read, not only its exit code.

**Controls.** The harness is not silently passing: seven checks exit 1 with a
concrete finding, and every exit-0 log prints what it scanned (for example
`scanned: 108`, `1092 roadmap file(s)`, `coverage 105/116 rules`). No check
timed out and none printed a usage line.

## Result: 9 of 16 are green, 7 stay red

| # | Check | D14 class | 2026-10-17 | What the log says |
|---|---|---|---|---|
| 1 | `check_gate_completeness` | snapshot | **red** | 240 violations against a baseline of 214 — 26 new (D14 saw 237) |
| 2 | `lint_ticked_unmet_criteria` | invariant | green | 1092 files, 2 grandfathered by digest |
| 3 | `check_rule_invariants` | invariant | **red** | a kernel-rule clause was reworded (`non-destructive-by-default`, "Never act while asking"); the registry expects the old wording |
| 4 | `check_augment_description_cap` | invariant | green | 108 descriptions within cap |
| 5 | `check_trigger_evals` | invariant | **red** | 51 `last_eval` stamps older than 90 days |
| 6 | `lint_subagent_determinism` | invariant | green | 1 subagent clean |
| 7 | `lint_rule_enforcement_declaration` | invariant | **red** | 2 rules missing the body line; 1 baseline entry owed removal |
| 8 | `check_token_quality_golden` | invariant | green | structurally valid; 11 rules uncovered, warning only |
| 9 | `check_council_layout` | **unclassified** | green | clean |
| 10 | `check_knowledge_cards` | **unclassified** | green | 1 card passes |
| 11 | `check_public_links` | invariant | green | 0 errors, 21 warnings |
| 12 | `lint_agents_layout` | invariant | **red** | `agents/memory-quarantine/` (tracked since 2026-08-19) is not on the allowlist |
| 13 | `lint_eval_freshness` | invariant | **red** | 4 skills without `upstream.last_eval` |
| 14 | `lint_readme_jargon` | invariant | green | 3 hits, at the limit |
| 15 | `lint_readme_serial_comma` | invariant | green | no violations |
| 16 | `check_composite_arming` | **unclassified** | **red** | no composite store yet: "not measured yet" |

## What this changes for 7.1, and what it does not

- **Two of the three abstentions are green now.** `check_council_layout` and
  `check_knowledge_cards` pass on today's trunk. That does not resolve them.
  D14 abstained on what each check *means*, and a pass says nothing about
  meaning. Treating "it went green" as "it is an invariant" would read class
  off observed behaviour, which is what both D14 seats refused to do.
- **`check_composite_arming` says what it is.** It is red because no data
  exists yet, and its own message says so: "not measured yet, which is NOT the
  same as armable". It reports whether evidence exists, not whether a property
  holds. That fits D22's call for explicit observation handling better than
  the invariant default. This is a reading for the next round to test, not a
  classification.
- **Two checks change verdict as the calendar moves.** `check_trigger_evals`
  (90-day staleness) and, in part, `lint_eval_freshness` can go red with no
  change to the tree. The four classes have no slot for "becomes false with
  time". That is a concrete instance of the TWO-objects problem D22 left open:
  a freshness window is a bounded tolerance on one side and an invariant on
  the other. It is evidence for aspect-level rows over a single-valued `class`.
- **The snapshot's pressure grew.** `check_gate_completeness` went from 237 to
  240 over a baseline of 214. D14's rule still applies: raising the baseline
  because violations rose is forbidden, and a refresh waits until the new ones
  are listed rule by rule.
- **`check_rule_invariants` is red because a kernel rule was reworded, not
  because a clause was dropped.** The kernel file still has the clause; only
  the wording differs. Both possible fixes touch governed surfaces. Changing
  the kernel rule is a kernel edit, and changing the invariant registry
  loosens a kernel guard. Neither belongs to this roadmap's lane, so this file
  records it and leaves it alone.

## Limits

- One run, one machine, one commit. A green here is a reading of that commit,
  nothing more.
- The population is still the sixteen pinned at Phase 7 start. Checks that
  went red after 2026-10-10 are not here, so this is not a census of
  everything red on today's trunk.
- Nothing here meets any item on D22's still-required list. 7.1 stays open.

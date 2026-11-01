# Divergence: run_skill_evals

## Script

- Python: `src/scripts/run_skill_evals.py` (retired — removed with the container
  under ADR-051; `no-python-in-src` forbids reintroducing it)
- TypeScript: `src/scripts/run_skill_evals.ts`

## Symptom

`SKILLS_ROOT` replicated the Python literal pointing at the retired
`.agent-src.uncondensed/skills` container. That directory does not exist, so
`_skill_dir()` throws for **every** skill and every subcommand aborts before
doing any work.

- **Python output (at its own time):** resolved a skill directory and scaffolded.
- **TS output (before this change):**
  `error: skill 'code-review' not found at <repo>/.agent-src.uncondensed/skills/code-review`
- Affected channel(s): stderr + exit code — all three subcommands
  (`scaffold`, `aggregate`, `report`).

## Root cause

The port kept the path literal verbatim under the ADR-051 faithful-twin
carve-out (former header, lines 13-16). The carve-out preserves byte-fidelity
to the mirrored source; it does not notice when the mirrored source and the
directory it names are both gone. The result was a twin faithful to a file that
no longer exists and runnable against nothing.

`SKILLS_ROOT` now resolves through `src/scripts/_lib/agent_src.ts::SRC_SKILLS()`
— the shared resolver whose job is owning that constant, and the same repair
applied to `skill_collision_clusters`, `skill_overlap`, and
`score_skill_selection`, each of which had been scoring 0 of 288 skills.

## Verdict

`bug-fix-in-TS` — the replicated path was never correct in the TS tree. Parity
with the Python source cannot be restored (the source and its container are
both deleted and cannot return), so option 1 of the divergence README —
"a fix in the TS port that restores byte-exact parity" — is not reachable, and
this doc is the only remaining option.

Two falsification checks were run before choosing, both pointing the same way:

- **Boilerplate test.** "This faithful twin replicates that literal
  byte-for-byte" is standard ADR-051 twin language, not a marker specific to
  this file — `src/scripts/measure_projection_bytes.ts:25-26` carries the same
  sentence about the same container. So the header did not encode an intentional
  disabled state.
- **Authority test.** ADR-200 § 5 makes Python behaviour part of the contract
  "unless a documented divergence says otherwise", and § 6 supplies this
  process. The ADR authorises the change rather than forbidding it.

## Evidence

- Before: `./scripts-run src/scripts/run_skill_evals scaffold code-review`
  exited with the skill-not-found error quoted above.
- After: the same command prints
  `scaffolded 4 scenarios × 2 arms at runs/<timestamp>-{baseline,with-skill}/`.
- `tests/scripts/sweep_dead_scan_roots.test.ts` — the Class-A advisory added in
  the same PR reports this script's root, which is how the dead root was found;
  the advisory entry disappears once this divergence lands.

**Scope limit, stated so it is not overread:** the subagent spawn function
remains an explicit stub that throws. This divergence makes `scaffold`,
`aggregate` and `report` runnable. It does **not** make live behavioural
evaluation runnable — that axis belongs to
`road-to-skill-ecosystem-executable-payloads`.

**Downstream change shipped with it:** `scaffold` now writes under
`src/skills/<id>/evals/runs/`, which no ignore rule covered — the `runs/`
patterns existed only for the retired container and for `dist/`. Added to
`.gitignore` in the same change; without it the first real run leaves untracked
output in the source tree and trips `task sync-check`.

## Approval

- Reviewer: <pending — PR review>
- Date: <YYYY-MM-DD>

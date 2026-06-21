# Parity harness

Quality gate for the Python-to-TypeScript script migration (roadmap
`road-to-typescript-only-scripts`, Phase 1 Step 6 + Step 9). It proves that a
TypeScript port behaves identically to its Python original before the `.py`
file is deleted.

## Components

| File | Role |
|---|---|
| `compare.ts` | Pure comparison engine (`compareOutcomes`, `deepEqual`) — no process spawning. Reusable by phase-gate CI. |
| `replay.ts` | Golden-replay runner: runs `python3 <script>.py` and `tsx <script>.ts` on identical fixtures and compares stdout, stderr, exit code, and the full post-run file tree. Exports `runReplay` for programmatic use. |
| `coverage_diff.ts` | Coverage gate: pytest baseline vs vitest coverage per ported cluster; fails when TS is below Python on line or branch coverage. Exports `diffCoverage`. |

## Golden replay

```
npx tsx src/scripts/parity/replay.ts \
  --script src/scripts/_lib/agent_settings \
  --case tests/golden/parity/agent_settings/cases/defaults \
  --case tests/golden/parity/agent_settings/cases/modules \
  --normalize none \
  --divergences docs/migration/divergences
```

- `--script` — repo-relative path WITHOUT extension; both `<path>.py` and
  `<path>.ts` must exist.
- `--case` — repeatable. A case dir contains:
  - `argv.json` (required) — JSON array of CLI args,
  - `stdin.txt` (optional) — piped to both processes,
  - `files/` (optional) — fixture tree copied into a fresh temp cwd before
    each run (each runtime gets its own pristine copy).
- `--normalize json|yaml|none` (default `none`) — `none` compares byte-exact;
  `json`/`yaml` parse stdout and written file contents on both sides and
  deep-compare the data (key order and whitespace become irrelevant). stderr
  and exit code are always compared exactly.
- `--divergences <dir>` — see "Divergence awareness" below.

Exit code 0 iff all cases pass OR every failing comparison is covered by a
divergence doc. Harness errors (missing script, malformed case) always fail.

## Error parity is a usage mode, not a separate tool

Failure scenarios are regular replay cases. A case whose `argv.json` carries
an invalid flag, whose `files/` tree omits a required input, or whose
`stdin.txt` is malformed exercises the error path; the runner already compares
the three channels that define error parity:

- error text (stderr, always byte-exact — never normalized),
- output channel (a message moving from stderr to stdout is a diff),
- exit code (always exact).

Convention: keep failure cases next to the happy-path cases of the same
script, named for the failure mode:

```
tests/golden/parity/<script>/cases/
  happy-default/argv.json
  err-missing-file/argv.json        # references a file not in files/
  err-invalid-flag/argv.json        # ["--no-such-flag"]
  err-bad-input/{argv.json,stdin.txt}
```

No extra flags are needed — both runtimes are expected to fail identically,
and any deviation (different message, different stream, different exit code)
is a regular FAIL.

## Divergence awareness (the CI divergence check)

With `--divergences docs/migration/divergences`, a script whose comparison
fails is still PASS-with-note iff a markdown file in that directory contains
a line

```
Script: <repo-relative script path>
```

matching the `--script` value (the `.py`/`.ts` extension is tolerated). The
doc format is `docs/migration/divergences/_template.md` (symptom, root cause,
verdict, evidence test, approval line). Undocumented mismatches remain
failures and are listed prominently in the report — this is the Step 9 CI
check: golden parity red without a divergence doc fails the build.

## Coverage diff

```
# Baseline (on the Python side):
pytest --cov=src/scripts/_lib --cov-branch --cov-report=json:coverage-py.json

# TS side (vitest with the json-summary reporter):
npx vitest run --coverage --coverage.reporter=json-summary tests/_lib/

npx tsx src/scripts/parity/coverage_diff.ts \
  --pytest coverage-py.json \
  --vitest coverage/coverage-summary.json \
  --scope src/scripts/_lib
```

Prints line + branch percentages for both sides; exits 1 when vitest is below
pytest on either metric. `--scope` filters both reports to a path prefix
(vitest absolute paths are made repo-relative first). If either input file is
missing the gate errors out, unless `--allow-missing` is given (warn + exit 0
— for clusters that have no Python test baseline yet).

## Intended CI invocation per ported batch

One replay invocation per script of the batch plus one coverage gate, e.g.
for the Phase 2 `_lib` cluster:

```yaml
- name: Golden parity (_lib batch)
  run: |
    set -e
    for script in agent_settings agent_src value_ladder; do
      npx tsx src/scripts/parity/replay.ts \
        --script "src/scripts/_lib/${script}" \
        --case tests/golden/parity/_lib/${script}/cases/* \
        --divergences docs/migration/divergences
    done

- name: Coverage diff (_lib batch)
  run: |
    npx tsx src/scripts/parity/coverage_diff.ts \
      --pytest coverage-py.json \
      --vitest coverage/coverage-summary.json \
      --scope src/scripts/_lib
```

Phase-gate CI can alternatively import `runReplay` / `diffCoverage` from this
package and aggregate results programmatically.

## Self-tests

```
npx vitest run tests/parity/
```

Fixture script pairs live under `tests/fixtures/parity/` (identical pair,
stdout mismatch, exit-code mismatch, JSON key-order, file-tree mismatch).

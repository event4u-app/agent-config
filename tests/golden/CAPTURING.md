# Golden Transcript Capture Recipe

Central regeneration guide for every Capture Pack under
`tests/golden/baseline/GT-N/`. Replaces the per-pack
`reproduction-notes.md` (dropped to keep the baseline
load-bearing only — generated boilerplate files, never
read by `harness.ts`, never compared by the replay tests).

Per-scenario metadata lives in `tests/golden/baseline/summary.json`
(outcome, exit code, cycle count) and the recipe modules
themselves under `tests/golden/sandbox/recipes/`.

> **TS re-platform (2026-06).** The harness, runner, recipes, capture
> driver, and toy repo are now pure TypeScript + vitest — there is no
> Python in this subsystem. The toy repo is `calculator.ts` exercised by
> vitest (`run_vitest`), so the locked baselines were re-derived from the
> `.ts` system; they are not byte-identical to the retired pytest-era packs.

## How to regenerate one scenario

From the repo root:

```bash
node node_modules/.bin/tsx tests/golden/capture.ts --scenarios GT-U1
```

`--scenarios` accepts a comma-separated list (`GT-U1,GT-U4`).
Omit the flag to recapture every locked GT. A partial run keeps the
other rows in `summary.json` intact.

## How to regenerate all scenarios

```bash
node node_modules/.bin/tsx tests/golden/capture.ts
```

The driver writes into `tests/golden/baseline/`, rewrites
`tests/golden/baseline/summary.json`, and refreshes
`tests/golden/CHECKSUMS.txt`. Review the diff before staging.

## How the driver works

For each scenario in `RECIPES` (`sandbox/recipes/index.ts`), via
`harness.captureFull`:

1. Materialise the toy repo into a fresh OS temp workspace (no
   host-state leakage — `agents/memory/` lookups resolve relative to the
   workspace, so every run sees zero curated entries). The workspace is
   removed once the in-memory transcript is captured.
2. Invoke `./agent-config <command>` once per cycle, where
   `<command>` is `implement-ticket`, `work`, `review-changes`,
   or whichever entrypoint the recipe declares.
3. After each cycle, the recipe mutates the persisted state
   file in the same shape the agent would write — this
   models the human-in-the-loop turns without driving an
   actual LLM.
4. Capture transcript, state snapshots, halt markers, exit
   codes, and the final delivery report into the pack
   directory.

Determinism env (`PYTHONHASHSEED` no longer applies): `NO_COLOR=1`
and the python-free runtime are injected by `runner.ts` /
`invoke_engine`; vitest + esbuild resolve from the package
`node_modules` so the copied workspace needs none of its own.

## Capture Pack layout

```
tests/golden/baseline/GT-N/
├── transcript.json     # per-cycle cmd/stdout/stderr + exit + state_after
├── state-snapshots/    # state file after each cycle (cycle-NN.json)
├── halt-markers.json   # extracted directives + numbered questions
├── exit-codes.json     # per-cycle exit codes only
├── delivery-report.md  # final report (or empty if flow halted)
└── fixture/            # frozen copy of the input ticket / prompt / diff
```

`harness.ts` `loadBaseline` reads the four load-bearing files
(`exit-codes.json`, `halt-markers.json`, `delivery-report.md`,
`state-snapshots/`) and feeds them into `compareExitCodes`,
`compareStateSnapshots`, `compareHaltMarkers`, and
`compareDeliveryReport`. `transcript.json` + `fixture/` + `summary.json`
are inspection / freeze-guard artifacts, not part of the replay
comparison.

## Lock + verify

After regeneration, verify integrity from the repo root:

```bash
shasum -a 256 -c tests/golden/CHECKSUMS.txt
```

The replay regression test (`tests/golden/golden_replay.test.ts`)
re-drives every scenario against the live engine and diffs against the
locked baseline — it fails the build if the engine's observable
behaviour drifted without an explicit lock update. The full 29-scenario
matrix runs by default; `GOLDEN_SMOKE=1` restricts to the fast PR subset
(`GT-1, GT-2, GT-P1, GT-U1, GT-U10, GT-U15`).

## When to relock

A baseline relock is the **maintainer's** explicit decision,
not an automatic CI step. Relock when:

- The engine intentionally changes a halt shape, directive
  contract, or state schema (PR description must call this
  out and link to the contract change).
- A recipe is added or rewritten to cover a new behavioural
  path (PR adds the recipe module to `RECIPES`).
- A directive is renamed or split (every affected GT shows
  up in the diff — review every pack, not just the one you
  meant to change).

Never relock to "make CI green" without reading the diff.
The replay test exists precisely to surface unintended
behavioural changes; a green replay after relock means the
new behaviour is now the contract.

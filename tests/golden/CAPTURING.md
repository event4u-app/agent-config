# Golden Transcript Capture Recipe

Central regeneration guide for every Capture Pack under
`tests/golden/baseline/GT-*/`. Replaces the per-pack
`reproduction-notes.md` (dropped to keep the baseline
load-bearing only — 17 generated boilerplate files, never
read by `harness.py`, never compared by the replay tests).

Per-scenario metadata lives in `tests/golden/baseline/summary.json`
(outcome, exit code, cycle count) and the recipe modules
themselves under `tests/golden/sandbox/recipes/`.

## How to regenerate one scenario

From the repo root:

```bash
python3 -m tests.golden.capture --scenarios GT-U1
```

`--scenarios` accepts a comma-separated list (`GT-U1,GT-U4`)
or a glob-ish prefix. Omit the flag to recapture every locked
GT.

## How to regenerate all scenarios

```bash
python3 -m tests.golden.capture
```

The driver writes into `tests/golden/baseline/` and refreshes
`tests/golden/CHECKSUMS.txt`. Review the diff before staging.

## How the driver works

For each scenario in `RECIPE_MODULES` (capture.py):

1. Materialise the toy repo into a fresh
   `tempfile.TemporaryDirectory` (no host-state leakage —
   `agents/memory/` lookups resolve relative to the
   workspace, so every run sees zero curated entries).
2. Invoke `./agent-config <command>` once per cycle, where
   `<command>` is `implement-ticket`, `work`, `review-changes`,
   or whichever entrypoint the recipe declares.
3. After each cycle, the recipe mutates the persisted state
   file in the same shape the agent would write — this
   models the human-in-the-loop turns without driving an
   actual LLM.
4. Capture transcript, state snapshot, halt markers, exit
   codes, and the final delivery report into the pack
   directory.

Determinism env: `PYTHONHASHSEED=0`, `PYTHONIOENCODING=utf-8`,
`LC_ALL=C.UTF-8`, `NO_COLOR=1` (injected by `runner.py`).

## Capture Pack layout

```
tests/golden/baseline/GT-N/
├── transcript.json     # per-cycle stdout/stderr + exit codes
├── state-snapshots/    # state file after each cycle (cycle-NN.json)
├── halt-markers.json   # extracted directives + numbered questions
├── exit-codes.json     # per-cycle exit codes only
├── delivery-report.md  # final report (or stub if flow halted)
└── fixture/            # frozen copy of the input ticket / prompt / diff
```

`harness.py` loads every file in this list and feeds them
into `compare_transcript`, `compare_state_snapshots`,
`compare_halt_markers`, `compare_exit_codes`, and
`compare_delivery_report`. A capture is "load-bearing" only
if at least one of those comparators reads it.

## Lock + verify

After regeneration, verify integrity from the repo root:

```bash
sha256sum -c tests/golden/CHECKSUMS.txt
```

The replay regression test (`tests/golden/test_lock.py`)
re-captures into a staging tree and diffs against the locked
baseline — it fails the build if the engine's observable
behaviour drifted without an explicit lock update.

## When to relock

A baseline relock is the **maintainer's** explicit decision,
not an automatic CI step. Relock when:

- The engine intentionally changes a halt shape, directive
  contract, or state schema (PR description must call this
  out and link to the contract change).
- A recipe is added or rewritten to cover a new behavioural
  path (PR adds the recipe module to `RECIPE_MODULES`).
- A directive is renamed or split (every affected GT shows
  up in the diff — review every pack, not just the one you
  meant to change).

Never relock to "make CI green" without reading the diff.
The freeze-guard exists precisely to surface unintended
behavioural changes; a green replay after relock means the
new behaviour is now the contract.

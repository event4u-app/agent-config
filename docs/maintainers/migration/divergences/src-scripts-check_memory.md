# Divergence: check_memory

## Script

- Python: `src/scripts/check_memory.py`
- TypeScript: `src/scripts/check_memory.ts`

## Symptom

Two byte-level mismatches, both confined to paths that depend on external
behaviour the TS port cannot reproduce in-language:

### 1. YAML-parse-error class name (`--path`, malformed `.yml`)

When a `.yml` file fails to parse, the finding message ends with the parser's
exception class name:

- **Python output:** `YAML parse error: ScannerError` (or `ParserError`,
  `ComposerError`, … — whatever PyYAML's scanner/parser raised for the input)
- **TS output:** `YAML parse error: YAMLError` (constant)
- Affected channel(s): stdout (text + json `message` field)

### 2. `--shadow-report` backend label

- **Python output:** `Shadow report — backend: misconfigured` (or whatever
  `scripts.memory_status.status` returns at runtime), with real per-type
  hit/shadow counts pulled from `scripts.memory_lookup.retrieve`.
- **TS output:** `Shadow report — backend: unknown`, all per-type counts 0.
- Affected channel(s): stdout (text + json `backend` / `per_type` fields)

## Root cause

### 1. YAML-parse-error class name

The Python original catches `except Exception as exc` and renders
`exc.__class__.__name__`. PyYAML's scanner/parser raises specific subclasses
(`ScannerError`, `ParserError`, `ComposerError`, `ConstructorError`) chosen by
its hand-written state machine. The TypeScript port uses the `yaml` npm
package, whose error taxonomy is structurally different (`YAMLParseError` with
`code` values like `BAD_INDENT`, `BAD_SCALAR_START`, `TAB_AS_INDENT`,
`DUPLICATE_KEY`). The two classifiers disagree even on which *phase* the error
belongs to — e.g. an unquoted backtick scalar is a `ScannerError` in PyYAML
but is first reported as `BAD_INDENT` by `yaml`. Reproducing PyYAML's exact
class for an arbitrary malformed input would require porting PyYAML's scanner
and parser state machines verbatim, which is out of scope for this phase and
provides no behavioural value — the class name is a debugging hint appended to
the stable `YAML parse error: ` prefix, not a contract field. The TS port
emits a constant `YAMLError` after that prefix.

### 2. `--shadow-report`

`_shadow_report` imports `scripts.memory_lookup` (`CURATED_TYPES`,
`retrieve`, `RetrievalResult`) and best-effort `scripts.memory_status`. Both
modules are **unported** in Phase 4 (they belong to the memory/telemetry
cluster, Phase 7). The TS port reproduces the scaffold with a zero-shadow
result and a `backend: unknown` label so the CLI surface (flag, channels,
output shape) stays identical until those modules land. The Python original's
`backend` value (`misconfigured` on this machine) reflects the real
`memory_status` probe, which has no TS equivalent yet.

## Verdict

`formatting-only` for (1) — the byte difference is a debugging-hint suffix
with no semantic or consumer impact; the stable `YAML parse error: ` prefix
(which every caller and test asserts on) is preserved.

`intentional-improvement` is **not** claimed for (2); it is an unavoidable
consequence of cross-phase ordering. The `--shadow-report` path is scaffolding
("Ships today as scaffolding" per the Python docstring) whose real backend is
absent until `@event4u/agent-memory` and the Phase-7 memory modules exist. The
TS scaffold is behaviourally faithful to the *absent-backend* state the feature
was designed around (zero shadows). Full byte-parity for `--shadow-report`
re-opens when `memory_lookup` / `memory_status` are ported.

## Evidence

- pytest suite `tests/test_check_memory.py` and the TS twin
  `tests/scripts/check_memory.test.ts` assert the **substring**
  `YAML parse error` (not the class name), so both suites pass under the
  divergence.
- Golden-parity tests in the TS suite cover every other `--path` /
  `--format` / `--append-only` case byte-exact (stdout + stderr + exit) and
  explicitly exclude the malformed-YAML class-name suffix and
  `--shadow-report` per this doc.

## Approval

Approved as a Phase-4 documented divergence. Both items are tracked: (1) is
permanent (cross-library error taxonomy); (2) closes when the Phase-7 memory
modules are ported and `--shadow-report` can call real `retrieve` /
`memory_status` twins.

# Divergence: spotcheck_thin_root

## Script

- Python: `src/scripts/spotcheck_thin_root.py`
- TypeScript: `src/scripts/spotcheck_thin_root.ts`

## Symptom

The entire `main()` is a **live AI-council call** (Anthropic `claude-sonnet-4-5`
+ OpenAI `gpt-4o`) that requires API keys + network access and produces a
**non-deterministic** report — per-call `latency_ms` and `tokens_in/out` vary
every run, and the model prose is not reproducible. There is therefore no
golden-parity path: python3 vs tsx output cannot be byte-compared, and the
script cannot run inside CI.

- Affected channel(s): written files (`thin-root-platform-spotcheck.md` /
  `.json`) + stderr (`Running …`, `✅  Wrote …`).

## Root cause

The Python original imports three still-Python `ai_council` modules with no TS
twin in this wave:

- `ai_council.clients` — `AnthropicClient`, `OpenAIClient`,
  `load_anthropic_key`, `load_openai_key` (~1,385 lines, network clients).
- `ai_council.orchestrator` — `CostBudget`, `CouncilQuestion`, `consult`
  (~1,206 lines).
- `ai_council.pricing` — `load_prices` (ported as `ai_council/pricing.ts`).

A `.ts` cannot import a `.py`, and the "PORT + import, never inline the
un-ported logic" rule forbids re-implementing those ~2,800 lines of
network-calling code inside this twin. Per the established precedent for
un-ported Python deps (`check_discovery_determinism.ts` runs its un-ported
scanner via `python3`; `smoke_quickstart.ts` Step 3 imports `decision_engine`
via a `python3` shim), the TS twin delegates the live `consult(...)` call to a
`python3` shim that imports the real Python modules. The deterministic parts —
artefact assembly, the `json.dumps(indent=2)` writer, the Markdown report
layout, the stderr lines — are ported faithfully in TS.

## Verdict

`intentional-improvement` — both behaviors are defensible; the TS twin
preserves the byte-shape of the written report and the stderr surface while
running the unportable, non-deterministic, network-bound council step through
the still-Python modules. Porting the two large network clients is out of this
wave's scope and tracked separately.

## Evidence

`tests/scripts/spotcheck_thin_root.test.ts` asserts the module imports without
a top-level throw and exposes the `main` entry point (the deterministic CLI
surface). The live council path (network + keys) is excluded from CI by
construction — there is no fixture that could pin a non-deterministic
LLM-latency report.

## Approval

- Reviewer: <pending — porting subagent, Wave 8h>
- Date: 2026-06-13

<!-- evidence-type: analysis -->

# Routing baseline — 2026-10-27, host evaluator

**Roadmap:** `road-to-routing-assurance-live-floors` 0.2 (and the inputs of 0.4
and 5.4). **Machine-readable rows:** `routing-baseline-20261027.json` beside
this file. **Protocol:** `agents/evidence/preregistration/routing-baseline-protocol-20261027.md`,
committed before the run; the artefact names its sha256.

## What ran

| Field | Value |
|---|---|
| Instrument | `claude plugin eval`, host 2.1.311 |
| Commit (catalogue built from) | `9e226440b6653348d409dab743b47439ab6c670c` |
| Model | `claude-opus-5-5` |
| Catalogue | `dist/agent-src/skills/`, 301 skills, sha256 `1c967b17…` |
| Cases | one corpus positive per unit, hash order, 179 selected |
| Run | 135 cases before the 22.5 USD ceiling stopped it (`partial: true`), 0 infrastructure failures |
| Cost | 23.09 USD for the run; 0.48 USD of calibration before the freeze; **23.56 of the 25 USD cap** |

## Result

- **73 of 135 units fired on their baseline prompt; 62 did not.** Mean
  per-unit recall 0.541 over measured units. Every unit's row is in the JSON.
- **The grader and the trace agree on every row.** The host's `tool_used`
  verdict and the skill names read independently from each run's trace match on
  135 of 135.
- **5 of the 62 misses invoked a different skill** instead; 57 invoked none.

## What it is not

- **Not a per-unit confidence figure.** One run per unit, so every recall is 0
  or 1 — the floors in `docs/contracts/routing-assurance-floors.json` are
  therefore 0.90 or 0. Repetition (6.1) is what turns them into rates.
- **Not the consumer path.** Plugin skills are listed namespaced (`ac:<name>`)
  and ignore `skillOverrides`; the trace does not show which descriptions the
  host's listing kept, so a miss may be "not listed with a description" as well
  as "not chosen".
- **Not all units.** 44 selected units were not reached before the ceiling; they
  have no row and no floor.

## Reproduce

```bash
./scripts-run src/scripts/compile_trigger_evals --baseline-plan \
  --plugin-root <gitignored-dir>/plugin --units 999 --per-unit 1
claude plugin eval --ablation none --runs 1 -j 4 --max-cost-usd 22.5 \
  --model claude-opus-5-5 --no-publish --trust-plugin --keep-temp \
  --json <aggregate.json> <gitignored-dir>/plugin
./scripts-run src/scripts/compile_trigger_evals --ingest <aggregate.json> \
  --plan <gitignored-dir>/plugin/plan.json \
  --protocol agents/evidence/preregistration/routing-baseline-protocol-20261027.md \
  --model claude-opus-5-5 --commit <sha> --artifact <out.json>
```

A rerun is a new baseline, not a reproduction of this one: the model and host
move, which is why each row carries its fingerprint.

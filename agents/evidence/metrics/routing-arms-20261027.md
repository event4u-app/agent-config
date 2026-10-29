<!-- evidence-type: analysis -->

# Routing arms — catalogue pressure, twins and the MCP path, 2026-10-27

**Roadmap:** `road-to-routing-assurance-live-floors` 3.1–3.3 and 4.1–4.3.
**Protocol:** `agents/evidence/preregistration/routing-arms-protocol-20261027.md`,
committed before any arm ran a corpus case; every artefact names its sha256.
**Baseline compared against:** `routing-baseline-20261027.json`.
**Machine-readable rows:** `routing-arm-{n12,n20,n50,twins,mcp}-20261027.json`
per arm, and `routing-arms-report-20261027.json`, written by
`routing_arms --report` from those artefacts.

## What ran

| Arm | Cases | Measured units | UNKNOWN | CLI estimate (USD) |
|---|---:|---:|---:|---:|
| N=12 | 135 | 135 | 0 | 14.25 |
| N=20 | 135 | 135 | 0 | 15.10 |
| N=50 | 135 | 135 | 0 | 17.49 |
| twins | 30 | 10 pairs | 0 | 5.35 |
| MCP | 135 | 116 | 19 | 11.76 |

Every arm ran on `claude plugin eval`, host **2.1.311** — the baseline's host —
with `claude-opus-5-5`, on the baseline commit's catalogue (`1c967b17…`). The
USD figures are the CLI's own estimates; the runs went through the
subscription CLI (OQ-22, AC-7), not the API.

## Results

| Arm | Paired units | Baseline (full catalogue) | Arm |
|---|---:|---:|---:|
| N=12 | 135 | 0.541 | 0.793 |
| N=20 | 135 | 0.541 | 0.785 |
| N=50 | 135 | 0.541 | 0.741 |
| MCP | 116 | 0.552 | 0.448 |

- **3.3, the pre-registered null — BROKEN.** Quoted: *"selection accuracy at
  full catalogue is not worse than at N=20 by more than the floor delta."*
  acc(full) = 0.541, acc(20) = 0.785, floor delta 0.10: 0.541 < 0.685.
  Accuracy falls as the catalogue grows, and falls hardest between 50 and the
  full 301 skills. This verdict claims no authority over tiering, which shipped
  for the host listing budget; per 3.3 it is an input to the archived
  `road-to-skill-delivery-over-mcp` measurement of routable skills per standing
  token, not new work.
- **3.2, twins — confusion 0 on every pair.** Ten paraphrased twins, each
  `<skill>-twin` in the same catalogue; in 30 runs no run invoked a twin. The
  misses were runs that invoked nothing (9 of 30). Per pair:
  `routing-arms-report-20261027.json` `.twins`; twin texts are archived in
  `agents/evidence/preregistration/routing-twins-20261027.json`.
- **4.2/4.3, parity — BREACHED.** Native 0.552, MCP 0.448 over 116 shared
  units; `parityVerdict` delta 0.103 > epsilon 0.05. Per 4.2, MCP default-on
  stays blocked and default-off holds. This is evidence against the archived
  `road-to-skill-delivery-over-mcp` measured-null outcome and adds no claim id.
  The traced shape of a miss: the run calls `suggest_skill_for_task`, gets the
  skill named, and answers without calling `read_skill`.

## Deviations, disclosed

- **MCP: 19 cases are UNKNOWN.** They ended on the org's monthly spend limit,
  not on the instrument. The protocol forbids retries; they drop out of the
  parity comparison only, which is why it covers 116 units.
- **Discarded runs, not counted.** An MCP run without `--allow-real-servers`
  started no server (41 cases, all unscored); an MCP run without `--mocks off`
  and `--allow-tools` (0 of 135) deviated from the frozen flags; a twin run
  without `--keep-temp` kept no traces, so twin invocations were unreadable.
  Each was re-run once with the protocol's exact flags; only those re-runs are
  ingested. The pressure arm N=20 first stopped on the spend limit and was
  re-run whole.
- **Execution order.** N=12 and N=50 overlapped the MCP run instead of
  following N=20 strictly; the arms share no state, so order cannot reach a
  case's outcome.

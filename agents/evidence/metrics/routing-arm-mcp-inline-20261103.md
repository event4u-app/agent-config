<!-- evidence-type: analysis -->

# Routing — the inline-top-body MCP arm, 2026-11-03

**Roadmap:** `road-to-routing-assurance-live-floors` 4.4, carried to
`road-to-routing-assurance-live-floors-carried` 2.1.
**Protocol:** `agents/evidence/preregistration/routing-inline-arm-protocol-20261103.md`,
committed before the arm ran (`c45936af3b`). The artefact's `protocol.sha256`
(`fa3d8722…`) is that committed version's; the only later edit is the file's
`evidence-type` marker (`preregistration` → `analysis`, the lint's vocabulary),
so `git show c45936af3b:<path> | shasum -a 256` reproduces the recorded hash.
**Rows:** `routing-arm-mcp-inline-20261103.json`; report
`routing-arms-inline-report-20261103.json` (`routing_arms --report`).

## What ran

The baseline's 135 cases on the baseline commit's catalogue (`1c967b17…`) and
corpus, the lite server with `AGENT_CONFIG_MCP_INLINE_TOP_BODY=1`,
`claude plugin eval` host **2.1.316** (the baseline ran on 2.1.311),
`claude-opus-5-5`, one run each. CLI estimate 13.84 USD. No run errored.
33 runs passed the `read_skill` grader; `--regrade-inline` flipped 26 more whose
trace shows the unit's body delivered inline.

## Result — the 4.2 gate, breached

| | Recall |
|---|---:|
| native (baseline) | 0.541 |
| MCP-inline | 0.437 |
| delta | 0.104 > ε 0.05 |

The earlier MCP arm without inline bodies read delta 0.103, so inlining did not
move parity. Every run called `suggest_skill_for_task`; 85 of 135 answers carried
no body because the top score tied, 34 carried the target's body, 16 another
skill's. The switch stays off.

The tie diagnosis was found by the session that built the mechanism, after the
gate failed; per the AI council (2/2, option a) the next uniqueness rule is
chosen by a session that did not author it.

<!-- evidence-type: analysis -->

# Routing — the inline-top-body MCP arm (4.4), protocol

**Roadmap:** `road-to-routing-assurance-live-floors` 4.4.
**Written:** 2026-11-03, before the arm ran any corpus case.
**Inherits:** `routing-arms-protocol-20261027.md` § Frozen for every arm and § 4.1,
unchanged except where this file says otherwise.

## What changes against the 4.1 MCP arm — and nothing else

1. **The server switch.** The arm's `.mcp.json` sets
   `AGENT_CONFIG_MCP_INLINE_TOP_BODY=1` (`routing_arms --mcp --inline-top-body`).
   With it set, `suggest_skill_for_task` returns `top_body: {skill, body,
   truncated}` when the top row's score is **strictly** above the runner-up's,
   the body cut at 6,000 characters. A tie returns no body.
2. **Selection on this path = the run received the unit's body**, by either
   route: a `read_skill` call with the unit's name (the 4.1 grader, unchanged),
   OR a `suggest_skill_for_task` result, matched to its call by `tool_use_id`,
   whose `top_body.skill` is the unit. The second is read from the kept trace by
   `routing_arms --regrade-inline` before `--ingest`. The re-grade only flips a
   failed run whose trace shows delivery; it never flips a pass, and an errored
   run stays UNKNOWN.

## Frozen

- Catalogue: the baseline commit's (`9e226440b6`), materialised with `git archive`,
  reproducing `1c967b17…` — `routing_arms` refuses any other.
- Cases: the baseline's 135, same names. Model `claude-opus-5-5`, `--runs 1`,
  `--ablation none`, `--no-publish`, `--trust-plugin`, `--keep-temp`, `--mocks off`,
  `--allow-tools` for exactly the two lite tools.
- Host: the CLI installed on the running machine; the record names its version.
  It is **not** the baseline's 2.1.311, and the report says so.
- Gate: `parityVerdict(native, mcp-inline, 0.05)` over units measured in both —
  the 4.2 gate, epsilon unchanged. `breached == false` ticks 4.4; `true` leaves
  it open with the number recorded. Default stays off either way until a pass.

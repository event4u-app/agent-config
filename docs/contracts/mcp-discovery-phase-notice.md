---
stability: experimental
---

# MCP Discovery-Phase Notice

**Audience:** MCP consumers integrating with `event4u/agent-config` — host
applications, CLIs, agents calling our stdio server or the Cloudflare Worker.
**Status:** active under the Discovery-First MCP coverage strategy
([`mcp-coverage-strategy.md`](../../agents/settings/contexts/mcp-coverage-strategy.md)).

## What you will see

`tools/list` advertises ~20 tools. Most return a `not_implemented` envelope when
called — wire shape in [`mcp-tool-stub-envelope`](mcp-tool-stub-envelope.md).
This is intentional. Phase 1 is *discovery*: every call — implemented, stub, or
unknown — is logged so Phase 2's implementation cut is derived from real
consumer behaviour, not guesses.

## What we need from you

**Keep calling the tools you would naturally call.** A call against a stub is
not a failed integration; it is a vote. Telemetry records carry
`{tool_name, client_id_hash, ts, transport, outcome}` — no payload bodies, no
raw identifiers (J4 in the roadmap). Three outcomes are logged:

- `implemented` — a real handler ran.
- `stub` — catalog entry, no transport handler; you received the envelope.
- `latent_demand` — name not in the catalog at all. **The most valuable
  signal.** If you want a tool that does not exist, call it — do not work
  around the absence silently.

## How to verify telemetry is flowing

On any host running the stdio server:

```bash
python3 scripts/mcp_telemetry_health.py
```

Healthy → exit 0 with the 24 h count. Silent → exit 1; treat as an alert.
Wire it into Sentry, a GitHub Actions cron, a mailer, or `launchd` — whatever
you already trust. Worker telemetry lands in Cloudflare Workers Logs
(structured `mcp.telemetry` lines); query via the dashboard or `wrangler tail`.

## Phase 1 → Phase 2 gate

When the gate fires (≥ 4 weeks of healthy telemetry, ≥ 500 logged attempts,
≥ 50 distinct `client_id_hash` values), the council ranks tools by demand and
picks the implementation cut. Tools above the line move from stub → real;
tools below stay stubbed and may be removed. Silent windows ≥ 24 h refuse the
K3 gate and restart the observation period — that is why the healthcheck
output matters.

## Contact

Open an issue against
[`event4u-app/agent-config`](https://github.com/event4u-app/agent-config) with
the `mcp-discovery` label if a call returns something other than the documented
envelope or if `latent_demand` is not landing for a tool you call.

# MCP evaluator scoring-model claim — VERIFIED (2026-07-27)

road-to-credible-install Phase 3 required verifying the external
scoring-model claim against the evaluator's published documentation before
acting on it. Result: **CONFIRMED** — fetched from the evaluator's own
score page for this package (glama.ai, 2026-07-27), not from the
reviewer's testimony:

> "The overall quality score combines two components: Tool Definition
> Quality (70%) and Server Coherence (30%)."

> "The server-level definition quality score is calculated as 60% mean
> TDQS + 40% minimum TDQS, so a single poorly described tool pulls the
> score down."

## Disposition

Per the roadmap's pre-registered rule, confirmation is **mechanism-relevant
new evidence against the stub-by-default pillar's cost side** (the
40%-minimum term makes the worst-scored tool dominate nearly half the
tool-definition component; stubs are structurally the minimum candidates,
and self-identifying stub descriptions mitigate transparency, not the
minimum-drag).

The pillar's revisit trigger is therefore **recorded as fired**, and the
revisit council round ran the same day (AI council debate, 2 members —
an Anthropic Sonnet-class and an OpenAI GPT-4-class model — 2 rounds).

## Council convergence (2026-07-27) → ADR-132

- The middle option (hide from `tools/list`, keep callable via the
  `not_implemented` envelope) is **semantically incoherent**: compliant
  MCP clients treat `tools/list` as the invocation gate, so an unlisted
  tool is uncallable — the envelope becomes dead theater.
- Catalog-only discovery is illusory transparency; the discovery value of
  listed phantom tools is speculative and unevidenced, while the verified
  40%-minimum scoring term and the >25-tool context soft cap are real
  costs.
- **Verdict: stubs leave the stdio wire** (server registers implemented
  tools only, 19/19/0); the generated catalog keeps every stub entry as
  the documented implemented-on-demand backlog with the
  `[stub — implemented on demand]` marker. Recorded as
  [`ADR-132`](../../../docs/decisions/ADR-132-stub-tools-off-the-wire.md),
  which also carries the re-entry conditions (a concrete consumer request
  implements the real tool; latent-demand telemetry keeps counting asks).

Stubs were NOT silently eradicated — the pillar's own trigger fired, the
council decided, the ADR records it.

---
status: blocked-for-later
complexity: medium
---

# Road to deferred-rule retriever — command-invoked Class-A variant of the rejected MCP retrieval server

> **Blocked until BOTH hold:** (1) the first native engine's Phase-5 benchmark
> verdict is published (ADR-124 sequencing rule — one native engine at a
> time; queue position 1 behind the code-graph engine per the sequencing plan
> in `road-to-native-code-intelligence.md`), AND (2) the three re-open
> conditions from the archived flow-learnings REJECT (council, 2026-07-07)
> convert into a real demand signal: (a) the `essential` discipline profile
> shipped + baseline-measured, (b) the MCP surface grown materially beyond
> ~3k tokens, (c) telemetry showing real retrieval demand.

## What this is — and what it is not

The 2026-07-07 council REJECT killed an **MCP deferred-rule retrieval
server** — correctly, and ADR-124 re-affirms that verdict at Class B (a
resident server; residency is the defining trait — an MCP server can run
stdio without any network). What the ADR-124 reclassification sweep
re-opened is the **Class-A slice**: a *command-invoked* retriever — one-shot
CLI over the already-shipped BM25/trigram core (`_lib/lexical_index.ts`),
corpus = the suite's own deferred/tier-2 rule bodies instead of
`agents/memory/`. No server, no transport, no resident anything.

## Sketch (to be re-planned when unblocked)

- [ ] Corpus adapter: index deferred-rule bodies (dist projection) with the
  existing lexical core — no second engine (ADR-061 engine-fork ban;
  the similarity primitive is reused, not duplicated).
- [ ] `rule_retrieve` one-shot CLI: query → top-k rule sections within a
  token budget; source attribution per hit; sanitizer on output.
- [ ] Wire as an optional lookup step in the router flow on hosts without
  native rule-injection; measure activation lift against the flow-learnings
  baseline before any default flips.
- [ ] Pre-registered threshold + honest-null path, per ADR-124 § 3.

## Provenance

- Archived flow-learnings cycle: REJECT of the *server* shape with three
  re-open conditions (quoted in the blocked-until header).
- ADR-124 § 4 sweep (2026-07-23): server re-affirmed B (resident);
  command-invoked variant classed A and queued here.

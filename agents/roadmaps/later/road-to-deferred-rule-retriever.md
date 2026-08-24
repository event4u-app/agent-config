---
status: blocked-for-later
complexity: lightweight
---

# Road to deferred-rule retriever — command-invoked Class-A variant of the rejected MCP retrieval server

> **Blocked until BOTH hold:** (1) the first native engine's Phase-5 benchmark
> verdict is published (ADR-124 sequencing rule — one native engine at a
> time; queue position 1 behind the code-graph engine per the sequencing plan
> in `road-to-native-code-intelligence.md`), AND (2) the three re-open
> conditions from the archived flow-learnings REJECT (council, 2026-07-07)
> convert into a real demand signal: (a) the `essential` discipline profile
> shipped + baseline-measured, (b) the MCP surface grown materially beyond
> ~3k tokens, (c) telemetry showing real retrieval demand — measured by the
> `rules_carried`/`rules_used` per-worker audit fields shipped by
> `road-to-lean-agent-init` (2026-07-28): a sustained low usage quota
> (rules carried but not applied) IS the datum this condition asks for.
> **Producer registered (2026-08-10) and RETIRED as condition (c)'s datum
> (2026-08-23).** `road-to-token-economy-dispatch` Phase 1.3 registered
> `rules_efficiency` (median `rules_used/rules_carried`, low-quota bar 0.2) in
> `src/config/dispatch-economy-metrics.json`. It cannot produce condition (c)'s
> signal, and `road-to-trigger-delivered-rule-bodies` step 0.8 classified it
> **`pre-intervention-impossible`** on measured grounds rather than retiring it
> on taste: the report path works and 755 orchestration lines carry both fields
> `null` on every single one, because `rules_used` — "rules the worker actually
> applied/cited" — is a model self-report and under an eager projection there is
> no runtime consumer of rule bodies to observe. A gate reading a metric that
> cannot be produced can never fire, which is what parked this roadmap behind an
> instrument rather than behind a decision.
>
> **Condition (c) now reads the trigger-MATCH rate** — `rules_matched /
> rules_carried`, produced offline by `./scripts-run src/scripts/model_rule_injection`
> over `tests/eval/routing-matrix` and, once a delivery mode is on, by the
> concern that performs the delivery. Measured 2026-08-23 on the frozen corpus:
> p50 **2** matched, p90 **4**, mean **2.07**, against **105** tier rules carried
> — a match rate around 2 %.
>
> **It is NOT a usage figure, and the substitution is refused in as many words.**
> Matched-and-delivered is not applied-and-followed. Reading the match rate as
> "usage" would make this roadmap's own demand gate self-fulfilling, which is
> exactly the metric-repair-manufactures-evidence failure step 0.8 forbids. What
> the match rate licenses is the narrower claim: most carried rules are not
> reachable from a given turn's triggers. Whether the agent would have USED them
> had they been present is unmeasured, and no number in this tree answers it.
> Evidence: `agents/evidence/analysis/trigger-delivery-baseline.md` § 7.
>
> **Gate (1) HAS FIRED — as an honest null (2026-07-28).** The first native
> engine's Phase-5 verdict is published: the code graph measured recall
> **0.365 vs disciplined grep 0.797** (Δ −43.2 pp), is permanently
> `enabled: false`, and carries a deprecation date (`docs/CLAIMS.md`
> `code-graph-retrieval-null`; `docs/MIGRATION.md` § Scheduled deprecations).
> The ADR-124 sequencing rule therefore no longer blocks this roadmap — gate
> (2), the three-condition demand signal, is now the only gate.
>
> **But read the null before building.** Council 2026-07-28
> (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds) flagged that the
> null's root cause is a category limit of static indexes over dynamic code,
> and that *rule retrieval is also a retrieval problem* — a lexical/BM25 core
> already ships (`_lib/lexical_index.ts`) and is the cheaper baseline any new
> retriever must beat on a pre-registered measurement BEFORE it is built, not
> after. The house pattern is now established: build-then-measure cost a full
> engine; measure-then-build is the lesson. If gate (2) converts, the first
> deliverable is the pre-registered comparison against the shipped lexical
> core, not the retriever.

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

---
complexity: structural
status: later
---

# Road to gateway harvest — what the runtime layer could carry, parked behind the freeze (Source B)

> **Parked (2026-08-03, council disposition claude-sonnet-4-5 + gpt-4o, 2
> rounds): 0 of 9 milestones proceed now.** The `route:explain` milestone
> (M3) is NOT parked — it is owned by `road-to-routing-correctness.md`
> Phase 2 (one implementation; the council rejected borrowing the same
> capability twice). Every other milestone is additive capability without a
> recorded internal failure → harvest freeze applies.
>
> **Resume when:** the harvest freeze's reopen condition fires (first
> documented external adopter), AND each resumed milestone either cites a
> RECORDED internal failure or passes a fresh council as deliberately
> additive. Individual early re-entry is possible only with that per-item
> citation — the analysis's own claims (e.g. M5 "continues the
> gates-that-can-fail work") were reviewed and judged insufficient as
> recorded-failure citations by the 2026-08-03 council.
>
> **Source identity:** an external LLM-gateway reference ("Source B") — a
> permanent gateway in the request path, the architectural antithesis of
> this package's zero-runtime-daemon claim. ~80% of it is structurally
> unadoptable here; the analysis harvested only position-independent
> patterns. Raw analysis with the source name and pinned commits is
> maintainer-local (gitignored transcript, `agents/tmp.old/`), per
> source-confidentiality.

## Milestones preserved for resume (re-verify each against the then-current tree)

| # | Milestone | Shape at analysis time | Freeze status |
|---|-----------|------------------------|---------------|
| M1 | Gateway composition — optional `base_url` per council member (OpenAI-compatible clients only); a set `base_url` forces billing classification `metered/unknown` (over-gated); doctor shows "via gateway: spend-gated" | no new process, no new dependency | frozen — additive |
| M2 | Council resilience as pure policy — `fallback_chain:` per seat reusing the reach-channels ordered-candidates shape; side-effect-free `(seatState, chain, event) → decision` module; cooldown ledger needs its own mini-ADR against the state-store test; pre-registered claim with honest-null path ("chairman fallback already suffices" → drop the milestone) | default-off until the claim is backed | frozen — additive |
| M3 | `route:explain` — deterministic offline router dry-run with mandatory measurement-level header | **not parked** — owned by `road-to-routing-correctness.md` Phase 2 | moved |
| M4 | MCP tool-description compression — offline token report first (shippable alone); compressor only behind a pre-registered tool-selection regression gate; no harness → park, never "unmeasured on" | gate-first | frozen — additive |
| M5 | Mutation testing of the top ~8 gate modules — nightly-only, ratcheted score, coverage check first (its honest null "gate X has no killing test" is itself a finding), kill criterion: no new findings after 2 months → remove the job | industrializes "who checks the checkers" | frozen — additive (per council; re-enter with a specific recorded gate failure the existing sweeps missed) |
| M6 | Universal doc-reference gate — every concrete reference in load-bearing docs (paths, subcommands, Taskfile targets, settings keys, skill/rule names) must resolve; warn-first, scoped start (contracts + decisions + README + AGENTS.md), per-class ratchet to blocking; must pass `assertScanned` | generalizes the three narrow existing gates | frozen — additive (re-enter by citing a recorded doc-drift incident) |
| M7 | Changelog fragments — `changelog.d/<class>/<PR>-<slug>.md`, one per PR, release-time aggregation, no fragment survives a release; PR gate: fragment or explicit `no-changelog` label | makes CHANGELOG merge conflicts structurally impossible | frozen — additive; **note:** if `road-to-release-truth.md` Phase 1's single-source pipeline finds fragment collection to be the cheapest mechanism, it may adopt this shape there — that adoption decision belongs to that roadmap |
| M8 | Dead-code ratchet — scoped to `src/{scripts,cli,server,install,shared}`, shrink-only baseline, report-only until the solution-minimalism adjudication decides | evidence feed, enforces nothing | frozen — additive |
| M9 | Council liveness probe — `doctor --check council --deep`: one minimal real request per enabled member, reach-doctor vocabulary, opt-in, billable-flagged, no scheduler | probe pattern only; the reference's background scheduler is explicitly NOT adoptable (no-runtime boundary) | frozen — additive |

## Rejected at analysis time (do not resurrect without beating the recorded reasoning)

Request-path compression of any kind (requires gateway position; violates the
machine-checked zero-runtime-daemon claim), external runtime federation
(ADR-088), MITM/TLS interception (outside any mandate), a memory system
(agent-memory sunset + no-runtime boundary), a stage pipeline (duplicates
do-and-judge + model downshift), quota accounting (agent-switch territory), an
injection-guard middleware (already shipped as `injection_scan_hook`), hard
complexity ratchets (would relitigate the report-only council adjudication),
external ELO rankings as routing input (unverified external data as a default
driver), a dependency allowlist (YAGNI at ~12 runtime deps), and a chaos mode
(functionally the council).

## Cross-project note (not this repo)

The reference's context-relay design (handoff summaries on account rotation;
only the injection layer knows whether the account actually switched) maps to
the agent-switch session-handoff work — recorded here so it is not lost;
belongs in that repo's roadmap set.

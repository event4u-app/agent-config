---
complexity: structural
status: later
---

# Road to gateway harvest — what the runtime layer could carry, parked behind the freeze (Source B)

> **Arrivals:** 2 — latest `inbox-2026-09-n` (2026-09-05); earlier: the untracked round of 2026-08-03 that created this roadmap.

> **FREEZE LIFTED 2026-08-05.** The ADR-211 harvest freeze that parked this
> roadmap was anchored on external adoption; that anchoring is struck by
> [`ADR-216`](../../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
> (external adoption is not a project goal and is not a valid gate anywhere in
> this tree). The freeze's real basis was maintainer capacity, and its conditions
> are met — **so nothing external holds this roadmap any more.**
>
> **Resume when** the maintainer decides to spend a slot on it. That is the only
> remaining condition: a sequencing decision, in the maintainer's control, not an
> event to wait for. Per-item evidence discipline is untouched — ADR-211
> Amendment C (the cited failure finding must predate the borrow) and Amendment D
> (red test committed first) still apply to each item on resume.

> **Parked per
> [`ADR-211`](../../../docs/decisions/ADR-211-harvest-freeze-resume-conditions.md)
> (harvest freeze; council disposition 2026-08-03): 0 of 9 milestones proceed
> now.** The `route:explain` milestone (M3) is NOT parked — it is owned by
> `road-to-routing-correctness.md` Phase 2 (one implementation; the council
> rejected borrowing the same capability twice). Re-audited item-granularly
> on 2026-08-03: 0 EXTRACT (every pre-dating recorded failure — council
> quorum `a4f4eb8e6`, gpt-5 transport branch `af3ed6e7e`, kernel-prefix gate
> `154d36619`, dead scan roots `47bb0f099`/`e89c1b733` — was already fixed at
> its root), 3 LATENT-CANDIDATE (M2, M5, M6 — marked in the table below with
> the red test that would qualify each under ADR-211 Amendment D), 5 STAY.
>
> **Resume when:** the maintainer spends a slot on it (ADR-216 struck the
> adoption gate; the capacity conditions are met), AND each resumed milestone satisfies ADR-211 Amendment C (pre-dating
> failure finding) or Amendment D (pre-registered red test) — or a fresh
> council pass admits it as deliberately additive post-freeze. A
> LATENT-CANDIDATE may re-enter EARLIER by committing its red test first;
> the test's failure is the qualification, not this file's prose.
>
> **Source identity:** an external LLM-gateway reference ("Source B") — a
> permanent gateway in the request path, the architectural antithesis of
> this package's zero-runtime-daemon claim. ~80% of it is structurally
> unadoptable here; the analysis harvested only position-independent
> patterns. The raw analysis with the source name and pinned commits is
> maintainer-local and gitignored, per source-confidentiality.

## Milestones preserved for resume (re-verify each against the then-current tree)

| # | Milestone | Shape at analysis time | Freeze status |
|---|-----------|------------------------|---------------|
| M1 | Gateway composition — optional `base_url` per council member (OpenAI-compatible clients only); a set `base_url` forces billing classification `metered/unknown` (over-gated); doctor shows "via gateway: spend-gated" | no new process, no new dependency | frozen — additive |
| M2 | Council resilience as pure policy — `fallback_chain:` per seat reusing the reach-channels ordered-candidates shape; side-effect-free `(seatState, chain, event) → decision` module; cooldown ledger needs its own mini-ADR against the state-store test; pre-registered claim with honest-null path ("chairman fallback already suffices" → drop the milestone) | default-off until the claim is backed | **LATENT-CANDIDATE** (ADR-211 Amendment D) — member-level fragility is real with provenance (`a4f4eb8e6` quorum miscount, `af3ed6e7e` transport branch), but each incident was fixed at its root; the un-fired risk is a seat OUTAGE degrading binarily. Qualifying red test: induced outage of seat provider #1 mid-run → observe binary chairman-fallback / failed round instead of ordered degradation |
| M3 | `route:explain` — deterministic offline router dry-run with mandatory measurement-level header | **not parked** — owned by `road-to-routing-correctness.md` Phase 2 | moved |
| M4 | MCP tool-description compression — offline token report first (shippable alone); compressor only behind a pre-registered tool-selection regression gate; no harness → park, never "unmeasured on" | gate-first | frozen — additive |
| M5 | Mutation testing of the top ~8 gate modules — nightly-only, ratcheted score, coverage check first (its honest null "gate X has no killing test" is itself a finding), kill criterion: no new findings after 2 months → remove the job | industrializes "who checks the checkers" | **LATENT-CANDIDATE** (ADR-211 Amendment D) — the gate-that-cannot-fail class is recorded with provenance (`154d36619` kernel-prefix gate, PR #1084; 13+5 dead scan roots `47bb0f099`/`e89c1b733`), all fixed at their roots; the un-fired risk is a LIVE gate whose tests kill zero mutants. Qualifying red test: a mutation pass over ONE chosen gate module showing 0 killed mutants — which is exactly this milestone's own coverage-check first step |
| M6 | Universal doc-reference gate — every concrete reference in load-bearing docs (paths, subcommands, Taskfile targets, settings keys, skill/rule names) must resolve; warn-first, scoped start (contracts + decisions + README + AGENTS.md), per-class ratchet to blocking; must pass `assertScanned` | generalizes the three narrow existing gates | **LATENT-CANDIDATE** (ADR-211 Amendment D) — the near-dated renewal finding "164 src/ files reference the dead authoring tree" (hand-verified 2026-08-02, same-day as the harvest analysis → fails Amendment C's strict pre-dating bar) shows the class is real; the sweep is owned by the ADR-hygiene roadmap, this gate is the standing prevention AFTER it. Qualifying red test: a seeded dangling concrete path reference in a load-bearing doc passes every gate today |
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

---
complexity: structural
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "One active roadmap and two open blockers (free-route-admission, project-content-ceiling). Both blockers are the owner question the 2026-09-07 council refusal of M1 explicitly left with the owner; this is the third and fourth arrival of that question, so it is posed rather than re-derived."
estate_offset_exempt: "No active roadmap covers free routes as bounded workers: M1, M2 and M9 sit in later/road-to-gateway-harvest, which stays parked for its other six milestones, and archiving an unrelated finished file to buy the slot would hide the growth this key exists to show."
relates:
  - slug: road-to-gateway-harvest
    relation: extends
    note: "M1 (base_url route) is executed here in Phase 2; M9 (liveness) in Phase 5. M2 (cooldown) is executed by road-to-seats-that-know-why-they-failed Phase 3. The parked file keeps M4-M8."
  - slug: road-to-seats-that-know-why-they-failed
    relation: depends
    note: "Phase 5 here consumes that roadmap's closed failure vocabulary (rate_limited / quota_exhausted / model_unservable) instead of inventing a second one."
  - slug: road-to-one-detector-and-the-senders-we-own
    relation: disjoint
    note: "Step 1.2 adds three prefix rows to the existing egress rule table; it does not touch the detector unification that roadmap owns."
  - slug: road-to-workflows-that-cannot-exfiltrate
    relation: disjoint
    note: "The workflow-security floors found in the same analysis ship there, independently of any free route."
depends:
  - road-to-seats-that-know-why-they-failed
---
# Road to free hands a paid head checks

> **Source:** `agents/tmp.old/inbox-2026-10-x/` — one owner chat (three owner turns) and three
> supplied plans for it. Every tree fact below was re-verified against `origin/main@447f8fd`
> on 2026-10-22; the supplied plan's own pin was `66b810588`, and the only change to a cited
> file in between (`council_egress.ts`, #2578) does not touch bare-prefix detection.
> External sources are coded S1–S7; their identities stay out of the tree.

> **Arrivals:** the free-route question now stands at 4 arrivals on
> `later/road-to-gateway-harvest.md` (this round and `inbox-2026-10-y` are the third and
> fourth). The owner decision is therefore posed as two blockers below, not re-derived a fifth
> time.

> **Owner directive (2026-10-22, chat):** free models are to be used chiefly for subagent-style
> and council calls — wherever a strong model and a strong provider manage the work and the
> weaker models only execute specific, controlled calls — so paid limits last longer while
> quality stays high. A second owner turn adds: distributing work means no single free
> provider learns the whole project, which makes reconstruction harder.

## Goal

The paid host model stays the **head**: it plans, cuts slices, chooses the route, verifies
every return and decides. Free routes become **hands**: bounded, typed, tool-less calls whose
output is a *proposal* the head checks before anything acts on it. This is the shape ADR-257
already permits — an unpaid route may propose and may score, never decide — applied to the
cheap rungs of the judgment ladder that exists today (rung 0 script → rung 0.5
`ask_transport` → rung 1 spawn → council).

Success is checkable:

1. A payload whose content class is undeclared never reaches a seat whose ceiling is
   `public-artifact` (fail-closed, D2).
2. A rung-0.5 call can be served by a free route, chosen by task kind, content class and
   remaining quota — never by list order (D1, D3).
3. Paid tokens avoided **net of the head's verification tokens** and quality held are both
   measured against pre-registered bars before any default flips (Phase 6). The owner's
   constraint is *limits last longer while quality stays high*; a saving that the head spends
   again on checking the hands is not a saving.
4. No free route ever plans, chairs, writes files, or carries a verdict (K1).

## What this roadmap is not

Not a gateway in the request path, not a host-subagent model override (the host's native
subagent field maps tiers to the host vendor only — `src/scripts/_lib/model_tier.ts`), not
tool-using free agents (K7), not a shipped model catalogue (K3), and not a new always-loaded
rule: every mechanism below lands in an existing script, contract or skill.

## Context — defects reproduced on this tree

| # | Defect | Evidence | How checked |
|---|---|---|---|
| D1 | The cheap rungs cannot reach any route the package does not pay for. The provider set is closed at five names and the config layer has no `base_url`. | `src/scripts/ai_council/config.ts` `_VALID_PROVIDERS` (five names); `grep -c base_url` on that file → 0; M1 parked in `later/road-to-gateway-harvest.md` | read + grep |
| D2 | **The content ceiling is fail-open.** `content_ceiling.ts` declares an unclassified payload private (`DEFAULT_CONTENT_CLASS = 'project-content'`), but the resolver only checks when the caller declares a class: "an undeclared pass is unchanged" (`transport_resolver.ts`, content-ceiling block). The only files naming `contentClass` are `content_ceiling.ts`, `status_surface.ts` and the resolver itself — no production caller declares one. Latent today (no `public-artifact` seat exists), live the moment a free seat is added. | files cited | read + grep |
| D3 | Rung 0.5 routes by list order and declares nothing: `ask_transport` takes `members[0]` unless `--member` is given (`src/scripts/ask_transport.ts:148`), passes no content class, and has no notion of task kind or quota. | file cited | read |
| D4 | Council egress misses bare credentials of free-tier providers the package itself touches. Reproduced 2026-10-22 through `resetCouncilEgress({identifiers:true}).replace` over 50 synthetic random keys per prefix: `hf_` 0/50, `nvapi-` 0/50, `r8_` 0/50 masked; `csk-`, `gsk_`, `sk-or-v1-` 50/50. The prefix table has no row for the three (`src/scripts/_lib/egress_prefixes.ts`). Assignment forms (`HF_TOKEN=…`) are caught. **Correction:** the second supplied plan listed `csk-` as missing too — it is masked already and is not in scope. | executed probe | tsx probe, synthetic keys |
| D5 | Served identity is recorded, never acted on: `model_served` is attribution-only (`ai_council/session.ts`); `policy_model_mismatch` and `policy_unproven_cost` (`seat_policy.ts`) have no producer outside config; a jury score's `family` is declared by the caller, not derived from the served id (`jury_aggregate.ts`). | grep for producers | grep |
| D6 | Jury independence is proxied by family count (`jury_aggregate.ts`; claim `free-jury-judge-agreement` in `docs/CLAIMS.md`). S3 (2026) measured ≈ 2 effective votes for 9 judges across 7 families, with the most correlated pairs cross-family. Several endpoints serving the same weights are not independent votes at all. | files + S3 | read |
| D7 | Observation keeps one last outcome per member (`probe_store.ts`), and `model_unservable` is deliberately unmapped (`transport_resolver.ts`). Fine for two subscription seats; wrong for free catalogues that lose rows overnight (S1: five rows of one vendor answered 410 Gone in one run). | read | read |
| D8 | The weekly cross-model canary is red on every scheduled run since 2026-09-14 (six of six listed). The 2026-10-19 run fails in step `Trigger-eval pass-rate rotation` with **14 suites at precision 0 / recall 0** against floors 0.8 / 1 — a uniform zero, which is the signature of a harness that never got an answer rather than of a routing regression. ADR-118 makes the red the notification; six ignored reds make it decorative. | `gh run list --workflow cross-model-canary.yml --event schedule`; `gh run view --log-failed` | live, 2026-10-22 |
| D9 | Five parked or context files justify parked items with the zero-runtime-daemon claim that ADR-249 withdrew: `later/road-to-gateway-harvest.md`, `later/road-to-plugin-runtime-borrowings.md`, `later/road-to-mission-catalogue.md`, `agents/settings/contexts/cache-economy-refusals.md`, `agents/settings/contexts/elder-ponytail-harvest-cut.md`. `retires_phrasings` is scanned on README, docs and release-facing surfaces only (`check_claims.ts`). | grep | grep |
| D10 | Limit relief is unmeasurable: `ask_economy` counts substitution and escalation (`src/config/dispatch-economy-metrics.json`) but has no billing-class axis, so "paid tokens avoided" cannot be read, let alone net of verification. | read | read |

**Reused, not rebuilt:** the judgment ladder and `ask_transport` hard caps (one completion, no
tools, honest ∅); the ADR-257 role boundary; the `PolicyExclusion` vocabulary; the binary
content ceiling; the council egress engine and placeholder scope; `MidFlightFallback`;
`cli_call_budget`; `jury_aggregate` + `judge_position_bias`; the `ask_economy` escalation kill
at 0.3; the `llm-provider-knowledge` skill's route-don't-cache stance.

## Phase 0 — Read before building

- [ ] **0.1 Classify the canary's uniform zero (D8).** Read the uploaded `rotation-results/*.json`
  of the 2026-10-19 run and the oldest red; name for each whether the zero is a provider answer
  scored wrong, an empty answer, or no call at all. Record in `agents/evidence/analysis/`. No
  Phase 5 design before this.
  verify: the analysis names the failing class for at least three scheduled runs.
- [ ] **0.2 Correct D9.** Replace the withdrawn-claim rationale in the five files with the live
  reason, or mark the item re-open-eligible; extend the `retires_phrasings` scan to
  `agents/roadmaps/later/`, `agents/roadmaps/stubs/` and `agents/settings/contexts/`.
  verify: a seeded "zero-runtime-daemon claim" line in a `later/` file fails `check_claims`.

## Phase 1 — Floors that ship regardless of free routes

- [ ] **1.1 Content ceiling fail-closed (D2).** An undeclared payload is classified
  `project-content`; `ask_transport` and the council bundle declare their class explicitly;
  repo-owned eval corpora declare `public-artifact`.
  verify: a `public-artifact` seat receiving an undeclared payload reports
  `available: false, policy_content_ceiling`; every existing seat is unchanged.
- [ ] **1.2 Three prefix rows (D4).** Add `hf_`, `nvapi-`, `r8_` to the egress rule table; every
  credential env var a shipped adapter reads maps to a prefix row or to an explicit
  `no-stable-prefix` row. `corrected-from-reproduction`: `csk-` is dropped from the list.
  verify: an `egress_prefixes` test masks every synthetic key of each of the three prefixes,
  and a fixture adapter reading an unmapped `*_TOKEN` fails the coverage-join test.

## Phase 2 — The route (gateway M1)

- [ ] **2.1 One provider table.** Fold `PROVIDER_CLI_META`, `PROVIDER_ENV_KEY` and
  `PROVIDER_KEY_FILE` (`_lib/environment_detector.ts`).
  verify: adding a provider is one edit; a partial entry fails all three lookups together.
- [ ] **2.2 `base_url` member** for OpenAI-compatible routes. Billing class `free-quota` only
  with proof (keyless endpoint or documented free tier, dated URL), else `per-token` inside
  the USD gate; any 402 is `policy_unproven_cost`, never a silent paid fallback.
  verify: config test — undeclared proof yields `per-token`; `council:status` names route + class.
- [ ] **2.3 Ship endpoints, discover models.** The package ships provider base URLs and dated
  data-use attestations only; model ids are discovered live from the route's `/models`, probed
  once, and written to gitignored runtime state next to `council-probes.json`. No model id is
  committed (K3).
  verify: offline, the roster reports `unknown`, never a cached list.
- [ ] **2.4 Identity derived, not declared (D5).** Family comes from the served id; a free route
  answering with `model_served ≠ requested` is absent with `policy_model_mismatch` (paid
  aliases keep today's attribution-only behaviour). Random/auto routers are refused at config
  time (K2).
  verify: a stub route answering with another family's id is absent with that reason.

## Phase 3 — The worker contract (rung 0.5, free hands)

- [ ] **3.1 Typed task kinds.** `ask_transport --kind <k>` with a closed set: `classify`,
  `extract`, `summarise-given-text`, `draft-candidate`, `test-candidates`,
  `finding-proposal`. Each kind has a JSON output schema; a return that does not parse is a
  failed call, not a partial answer.
  verify: schema-invalid stub output exits 3 and is logged.
- [ ] **3.2 Route chooser replaces `members[0]` (D3).** Inputs: task kind, declared content
  class, route ceiling, remaining quota, liveness. Order: admissible free route → paid fallback
  → honest ∅. Head-only kinds (plan, decide, chair, final review, anything that writes) never
  reach the chooser.
  verify: table test over kind × class × quota; a `project-content` payload never lands on a
  `public-artifact` route.
- [ ] **3.3 The head verifies every hand.** The return enters the existing verify budget; the
  orchestration record carries `route_billing` and `verified: pass|fail|skipped`, plus the
  head's own tokens spent verifying it. A `skipped` verify on a free return counts as an
  escalation for Phase 6.
  verify: orchestration-line validation rejects a free-route line without `verified`.
- [ ] **3.4 The delegation nudge names the free rung** when the slice matches a kind in 3.1 and
  a route is admissible; it never auto-spawns.
  verify: a nudge fixture for a `classify` slice names the free rung and dispatches nothing.
- [ ] **3.5 Hands see fragments, never the project.** (Owner rationale, 2026-10-22.) Made
  mechanical rather than assumed: (a) a hand's payload is the slice the head cut — never repo
  maps, architecture docs, README, roadmaps or the project name; (b) identifiers that link
  fragments (project/package names, repo paths, domains) go through the existing placeholder
  scope before send; (c) a per-route **exposure ledger** in gitignored runtime state counts
  distinct project files and symbols each route has seen; the chooser prefers the
  least-exposed admissible route and refuses a route past a share cap (default 20 % of tracked
  files). This raises reconstruction cost; it never substitutes for the content ceiling or K4.
  verify: a seeded multi-route test leaves no route above the configured cap, and the outbound
  payload of a call containing the project name carries its placeholder instead.

## Phase 4 — Council: free proposers and jurors, paid chair

- [ ] **4.1 Free seats as proposer and juror only** (ADR-257). Chair, synthesis and verdict stay
  on paid seats; `seat_policy` refuses a free seat in those roles with a named reason. Jurors
  answer in parallel and blind — no juror sees another's answer before synthesis.
  verify: a `seat_policy` test refuses a free seat as chair with a named reason, and a juror
  prompt fixture contains no other juror's answer.
- [ ] **4.2 Panel size capped at five judges** (S3: ≈ 90 % of achievable independence at five);
  prefer different architectures over more seats.
  verify: a config with six judges is refused with the cap as the reason.
- [ ] **4.3 Independence measured (D6).** Next to κ, compute pairwise error φ and Kish
  n_eff = k / (1 + (k−1)·φ̄) on the same run; pre-register `free-jury-effective-independence`
  (bar: n_eff/k ≥ 0.5) before any run. The κ claim's bar is unchanged; n_eff is reported, not
  substituted.
  verify: a synthetic perfectly-correlated panel yields n_eff = 1.

## Phase 5 — Liveness and quota (gateway M9, D7)

- [ ] **5.1 Streaks, not last outcomes.** Per route+model, using the failure vocabulary of
  `road-to-seats-that-know-why-they-failed`: `rate_limited` / `quota_exhausted` / server errors
  mark the route absent for this pass and never count against liveness; `model_unservable`
  (404 model-not-found, 410) extends a streak; three consecutive retire the model from the
  discovered roster until re-discovered.
  verify: three seeded `model_unservable` results retire the model; three `rate_limited`
  results do not.
- [ ] **5.2 Fallback chain per kind** reusing `MidFlightFallback` (one retry, double-spend guard
  kept).
  verify: a stub chain whose first route fails serves the call from the second route, and a
  repeated failure yields honest ∅ without a second paid call.
- [ ] **5.3 Liveness folds into the existing canary** (ADR-118: no new scheduled workflow). A
  keyless leg needs no secret, so the cross-vendor leg finally runs; a streak of three or more
  red scheduled runs writes one status line that `doctor` and session start surface.
  verify: three seeded reds put the status line in place; one green clears it.

## Phase 6 — Measure, then flip

- [ ] **6.1 Billing axis (D10) and two pre-registered claims before any free call:**
  `free-hands-limit-relief` — paid billable tokens avoided per week on rung 0.5, **minus the
  head's verification tokens from 3.3**; `free-hands-quality-held` — escalation + verify-fail
  rate of free-routed asks ≤ paid-routed asks + 5 pp, and below the registered 0.3 kill.
  Underpowered means neither claim is backed.
  verify: both claim rows exist in `docs/CLAIMS.md` with bars before the first free call, and
  `check_claims` is green.
- [ ] **6.2 Shadow:** a free route answers in parallel, the paid answer is used, both are
  verified; the call budget recorded in decision A5, public-artifact corpus first.
  verify: the shadow ledger shows a free and a paid answer with a verify result for every call.
- [ ] **6.3 Flip per kind**, only for kinds that clear both bars; a kind that later breaches the
  escalation kill reverts automatically and the reversion is recorded in the claim row.
  verify: a seeded breach above the kill flips the kind back to the paid route.

## Phase 7 — Breadth for consumers

- [ ] **7.1 `llm-provider-knowledge` gains a free-tier class:** docs roots, data-use page,
  region caveat — no model ids, no limits copied. Answers "set up a free LLM API" for consumers.
  verify: the skill's linter passes and the skill names no model id.

## Kill register

| # | Not done | Why |
|---|---|---|
| K1 | Free route as head: planner, chair, evaluator of record, final reviewer, writer | ADR-257; the owner directive itself |
| K2 | Random/auto routers as seats | identity and family unknown before the call (S6) |
| K3 | Shipping model ids or limits | catalogues drift within weeks; route, don't cache |
| K4 | Project content to any route whose terms allow training on prompts | data-use terms differ by provider and region (S5) |
| K5 | Overriding host subagent models to free routes | the host field maps to the host vendor only |
| K6 | A new scheduled workflow | ADR-118 — fold into the canary |
| K7 | Tool-using or file-writing free workers | write authority stays with the head; reopen only with its own roadmap |
| K8 | The retired GitHub-hosted model endpoint as a zero-touch path | retired 2026-07-30 (S2) |
| K9 | Vendoring the external catalogue's data or README | licence + drift; endpoints are discovered |
| K10 | More than five judges for "more agreement" | n_eff saturates (S3) |
| K11 | Rotating accounts or keys to stretch a provider's free limit | only legitimately held keys; a route's own limits are honoured, never evaded |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | agent | Keyless routes serve eval and jury; keyed free tiers are an opt-in for worker volume, with keys in the user-global key root; `doctor` names which is configured | keyless endpoints measured at ≈ 2 requests per minute per IP and model (S5) — too slow for worker volume, enough for a jury | a keyless endpoint offers worker-grade throughput |
| A2 | reversible-technical | agent | A roadmap of its own, not a promotion of `later/road-to-gateway-harvest`: the scope (fail-closed ceiling, typed worker kinds, exposure ledger, jury independence, net measurement) exceeds M1, and the parked file keeps six unrelated milestones | `later/road-to-gateway-harvest.md` milestone table; this file's Phases 1, 3, 4, 6 | the parked file is emptied of M4-M8 |
| A3 | reversible-technical | agent | The binary content ceiling stays; a four-level public / internal / confidential / strictly-confidential scheme from the supplied plan is declined | the existing ceiling is fail-closed after 1.1, and no route exists that a third or fourth level could admit; a level with no admissible route is a label, not a control | a route class appears that needs a ceiling between the two |
| A5 | reversible-technical | agent | The Phase 6 shadow is capped at 2,000 calls | enough for per-kind rates at the 5 pp margin on the public-artifact corpus; spend stays USD 0.00 under `free-quota` | the per-kind sample is underpowered at the cap |
| A4 | reversible-technical | agent | The exposure cap starts at 20 % of tracked files and is a tunable, not a gate threshold | owner rationale 2026-10-22; obscurity layer only, the ceiling and K4 carry the guarantee | the ledger shows a route at the cap blocking otherwise-admissible work |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Undeclared content reaches a free route | implementation | A caller that declares no content class sends project content to a `public-artifact` route. | 1.1 lands before any route exists; blocker `project-content-ceiling` keeps every free route at `public-artifact` until the owner rules. | Phase 1 — Floors that ship regardless of free routes |
| 2 | Free answers look right and are wrong | product | A hand returns a plausible proposal the head accepts without catching the error. | 3.3 makes verification mandatory and counted; 6.1 quality bar; per-kind flip in 6.3. | Phase 3 — The worker contract (rung 0.5, free hands) |
| 3 | Verification eats the saving | product | The head spends more tokens checking hands than the hands saved. | 3.3 records verification tokens; 6.1 measures relief net of them; no flip without it. | Phase 6 — Measure, then flip |
| 4 | Quota exhaustion stalls a session | implementation | A free route runs dry mid-task. | Quota means absent for the pass, paid fallback, honest ∅ (3.2, 5.1). | Phase 5 — Liveness and quota (gateway M9, D7) |
| 5 | Provider terms change silently | product | A route's data-use terms change after its attestation was recorded. | Dated attestations; the ceiling falls back to `public-artifact` when an attestation is older than 90 days; 2.3 re-discovery. | Phase 2 — The route (gateway M1) |
| 6 | Fragments are re-linked | product | The same route sees enough fragments over months, or shared identifiers, to reconstruct structure. | 3.5 exposure cap and placeholders; training routes never see project content (K4). | Phase 3 — The worker contract (rung 0.5, free hands) |
| 7 | Scoring quietly becomes deciding | implementation | A consumer starts acting on a free juror's score as if it were a verdict. | ADR-257; 4.1 refuses free seats in chair/verdict roles; consumers of free output enumerated in tests. | Phase 4 — Council: free proposers and jurors, paid chair |

## Blockers

### blocker: free-route-admission
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phases 2-7. Phases 0 and 1 run without it.
- **What to do:** pick exactly one — (a) admit OpenAI-compatible `base_url` routes as free hands and jurors under ADR-257, first a keyless endpoint, spend ceiling USD 0.00 enforced by billing class `free-quota`, shadow capped at 2,000 calls, termination on the Phase 6 bars or three consecutive `model_unservable` per route; or (b) keep the slot unspent and park Phases 2-7 in `later/` with this question recorded as the wake condition.
- **Recommendation:** (a). It answers the four things the 2026-09-07 refusal asked a new request to name (seat, call count, spend ceiling, termination rule), and it is the only path to the owner's 2026-09-05 free-jury goal and the 2026-10-22 directive.
- **If you do nothing:** the free-route question arrives a fifth time; `free-jury-judge-agreement` stays unbacked with no route to back it.
- **Resolved when:** a dated owner decision line naming (a) or (b) is recorded in this file's `## Decisions` table.

### blocker: project-content-ceiling
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** any free route above `public-artifact` — the subagent-style kinds of 3.1 on consumer code. Hands on repo-owned artefacts run without it.
- **What to do:** pick exactly one — (a) a free route may be raised to `project-content` only with a dated data-use attestation (no training, no retention, source URL) and the egress engine in front, and routes whose terms allow training on prompts stay `public-artifact` permanently; or (b) every free route stays `public-artifact` permanently.
- **Recommendation:** (a). Without it most of the subagent-style value the directive names is out of reach; the attestation plus K4 keep the floor where a raise is provable.
- **If you do nothing:** hands run only on repo-owned artefacts; Phase 6 measures a narrower kind set.
- **Resolved when:** a dated owner decision line naming (a) or (b) is recorded in this file's `## Decisions` table.

## Acceptance Criteria

- [ ] AC-1 An undeclared payload is refused by a `public-artifact` seat (1.1).
- [ ] AC-2 Bare `hf_` / `nvapi-` / `r8_` are masked 50/50 (1.2).
- [ ] AC-3 A free route serves a typed rung-0.5 call, chosen by kind, class and quota (3.2).
- [ ] AC-4 No free route holds a head role (4.1, K1).
- [ ] AC-5 n_eff is reported beside κ on every jury run (4.3).
- [ ] AC-6 Both Phase 6 claims are filed before the first free call, and limit relief is reported net of verification tokens; every flip cites them.
- [ ] AC-7 The canary's uniform zero is classified before Phase 5 is designed (0.1).

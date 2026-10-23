---
complexity: structural
status: ready
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
    note: "Step 1.2 adds three prefix rows to the existing egress rule table; it does not touch the detector unification that roadmap owns. Step 1.3's personal-data and identifier canaries read that roadmap's step 2.3 identifier rows and report not-detectable until it lands; no ordering edge, so not a depends row."
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

- [x] **0.1 Classify the canary's uniform zero (D8).** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/trigger_eval_rotation.ts --> Read the uploaded `rotation-results/*.json`
  of the 2026-10-19 run and the oldest red; name for each whether the zero is a provider answer
  scored wrong, an empty answer, or no call at all. Record in `agents/evidence/analysis/`. No
  Phase 5 design before this.
  verify: the analysis names the failing class for at least three scheduled runs.
  Done 2026-10-22: `agents/evidence/analysis/cross-model-canary-uniform-zero-2026-10-22.md` names the class of eight scheduled runs — the three October runs had no answered call at all (0 input tokens in every suite; the router turns a non-OK response into "no skill, zero tokens"), the five September runs are real answers below a recall floor of 1. Fix in the same step: a live suite with no answered call is reported `NO ANSWER`, not scored (commit 40482d31cb, test `trigger_eval_rotation.test.ts` › marks a live suite whose router never answered as unanswered).
- [x] **0.2 Correct D9.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_claims.ts --> Replace the withdrawn-claim rationale in the five files with the live
  reason, or mark the item re-open-eligible; extend the `retires_phrasings` scan to
  `agents/roadmaps/later/`, `agents/roadmaps/stubs/` and `agents/settings/contexts/`.
  verify: a seeded "zero-runtime-daemon claim" line in a `later/` file fails `check_claims`.
  Done 2026-10-22 (commit e7c2462d9f): the five files and a sixth the scan found (`stubs/road-to-owner-authority-decisions.md`, a verbatim quote of the old ledger) now state the live reason or mark the item re-open-eligible; `check_claims` scans `later/`, `stubs/` and `settings/contexts/` with the hyphenated needle added (`check_claims_retired_phrasings.test.ts` › RED on a seeded line in a later/ roadmap).

## Phase 1 — Floors that ship regardless of free routes

- [x] **1.1 Content ceiling fail-closed (D2).** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/transport_resolver.ts --> An undeclared payload is classified
  `project-content`; `ask_transport` and the council bundle declare their class explicitly;
  repo-owned eval corpora declare `public-artifact`.
  verify: a `public-artifact` seat receiving an undeclared payload reports
  `available: false, policy_content_ceiling`; every existing seat is unchanged.
  Done 2026-10-22 (commit ec9df20078): undeclared → `project-content` in `resolveTransport`; `build_members` now passes each seat's configured ceiling and the pass's class (it passed neither, so the ceiling never reached a council run); `ask_transport --content-class`. Tests: `seat_policy_and_ceiling.test.ts` › an undeclared content class is project-content: a public-artifact seat refuses it, and › … leaves every default seat unchanged; `council_cli.test.ts` › the content ceiling reaches the resolver. No repo-owned eval corpus goes through a council seat today, so none had a class to declare; `--content-class public-artifact` is the path when one does.
- [x] **1.2 Three prefix rows (D4).** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/egress_prefixes.ts --> Add `hf_`, `nvapi-`, `r8_` to the egress rule table; every
  credential env var a shipped adapter reads maps to a prefix row or to an explicit
  `no-stable-prefix` row. `corrected-from-reproduction`: `csk-` is dropped from the list.
  verify: an `egress_prefixes` test masks every synthetic key of each of the three prefixes,
  and a fixture adapter reading an unmapped `*_TOKEN` fails the coverage-join test.
  Done 2026-10-22 (commit 06777113cc): rows `huggingface-token`, `nvidia-api-key`, `replicate-api-token` in `egress_rules.ts`; `CREDENTIAL_ENV_ROWS` (`src/scripts/_lib/egress_credential_env.ts`) maps the eleven credential variables the adapters and council clients read (the media adapters' `AIV_ACCESS_KEY` / `AIV_SECRET_KEY` as `no-stable-prefix`). Tests: `tests/scripts/_lib_egress_free_tier_prefixes.test.ts` (50/50 per prefix, seen 0/50 first; the coverage join and its fixture).
- [x] **1.3 An egress canary run before any free call.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/egress_canary.ts --> (Folded 2026-10-22 from
  `inbox-2026-10-z`.) A fixed set of planted canary values — personal data, credentials and
  internal identifiers — placed in the payload, in the hand's system prompt and in rule or skill
  text a payload could quote, is sent through `ask_transport` to a mock endpoint on loopback
  that records the bytes it receives. No network, synthetic values only. `ask_transport` gets
  the final check, not replacement (`egress-placeholders-v1.md`), so a credential canary is
  refused, not replaced. Identifier canaries need the rows of
  `road-to-one-detector-and-the-senders-we-own` 2.3; until then they report `not-detectable`.
  verify: no planted canary in clear text; the report names each canary as replaced (with its
  placeholder), refused (with its reason) or `not-detectable`. Zero observed leaks is a test
  result, never a guarantee.
  Done 2026-10-22 (ffb6a6b722, 61bb2463f6): `egress_canary.test.ts`, seen red with the check neutralised.

## Phase 2 — The route (gateway M1)

- [x] **2.1 One provider table.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/environment_detector.ts --> Fold `PROVIDER_CLI_META`, `PROVIDER_ENV_KEY` and
  `PROVIDER_KEY_FILE` (`_lib/environment_detector.ts`).
  verify: adding a provider is one edit; a partial entry fails all three lookups together.
  Done 2026-10-22 (commit 09507c1510): `PROVIDER_TABLE` and `providerRow` in `_lib/environment_detector.ts`; tests › one provider table.
- [x] **2.2 `base_url` member** for OpenAI-compatible routes. Billing class `free-quota` only <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/detection_report.ts -->
  with proof (keyless endpoint or documented free tier, dated URL), else `per-token` inside
  the USD gate; any 402 is `policy_unproven_cost`, never a silent paid fallback.
  verify: config test — undeclared proof yields `per-token`; `council:status` names route + class.
  Done 2026-10-22 (commits d0d9dd44af, b64e3ef140): `free_route_member.test.ts` › `undeclared proof yields per-token`, `council:status output names route + class`, `HTTP 402 resolves to policy_unproven_cost and is n…`; `docs/contracts/ai-council-config.md` describes route members.
- [x] **2.3 Ship endpoints, discover models.** The package ships provider base URLs and dated <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/continuity-surface.json -->
  data-use attestations only; model ids are discovered live from the route's `/models`, probed
  once, and written to gitignored runtime state next to `council-probes.json`. No model id is
  committed (K3). The attestation also records whether the route's terms permit use inside a
  client distributed to users in the EEA, Switzerland and the UK (one free tier's terms require
  paid services as soon as such a client exists); a route without that field is admissible for
  the maintainer's own runs only and is never a consumer default. (Folded 2026-10-22 from
  `road-to-a-tier-the-dispatch-carries` T9.)
  verify: offline, the roster reports `unknown`, never a cached list; a route whose attestation
  lacks the distribution field is refused as a consumer default.
  Done 2026-10-22 (e750d31083, e9009baac5, c0090499d7): one keyless row attested, distribution `unknown`, first-party only (A14).
- [x] **2.4 Identity derived, not declared (D5).** Family comes from the served id; a free route <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/free_route.ts -->
  answering with `model_served ≠ requested` is absent with `policy_model_mismatch` (paid
  aliases keep today's attribution-only behaviour). Random/auto routers are refused at config
  time (K2).
  verify: a stub route answering with another family's id is absent with that reason.
  Done 2026-10-22 (commit 996fd9aa4e): `free_route_identity.test.ts` › `a stub route answering with another family's id is absent with pol…`; random/auto routers refused at config time.
- [x] **2.5 A loopback self-hosted route** (owner turn 2026-10-22: paid *or self-hosted* models <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/free_route.ts -->
  repair and finish; read as a *hand*, decision A8). Not a free route, so blocker
  `free-route-admission` does not gate it. Loopback is a precondition, never the proof (A7,
  K12): billing class `self-hosted` may carry `project-content` only after a per-model probe
  shows local weights and no outbound connection during a probe call. Unprobed, or on a
  non-loopback host, it is an ordinary route under blocker `project-content-ceiling`.
  verify: a loopback stub whose probe reports local weights admits a `project-content`
  payload; the same stub reporting a remote model, and on a non-loopback address, both refuse
  it with `policy_content_ceiling`.
  Done 2026-10-22 (d0d9dd44af, 15d021b4a2, 7b4054e5f9, d5905363e8): real probe in production callers; not exercised live (no local model server).

## Phase 3 — The worker contract (rung 0.5, free hands)

- [x] **3.1 Typed task kinds.** `ask_transport --kind <k>` with a closed set: `classify`, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/hand_kinds.ts -->
  `extract`, `summarise-given-text`, `draft-candidate`, `test-candidates`,
  `finding-proposal`. Each kind has a JSON output schema; a return that does not parse is a
  failed call, not a partial answer.
  verify: schema-invalid stub output exits 3 and is logged.
  Done 2026-10-22 (commit 550ac29e61): `ask_transport_hand_kinds.test.ts` › `schema-invalid stub output exits 3 and is logged`.
- [x] **3.2 Route chooser replaces `members[0]` (D3).** Inputs: task kind, declared content <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/route_chooser.ts -->
  class, route ceiling, remaining quota, liveness. Order: admissible free route → paid fallback
  → honest ∅. Head-only kinds (plan, decide, chair, final review, anything that writes) never
  reach the chooser.
  verify: table test over kind × class × quota; a `project-content` payload never lands on a
  `public-artifact` route.
  Done 2026-10-22 (commits 177c6a89eb, dde028435e): `route_chooser.test.ts` — 75-row kind × class × quota table, `a project-content payload never lands on a public-artifact route, even when it is the only one`; `askOnce` picks through `chooseRoute`.
- [x] **3.3 The head verifies every hand.** The return enters the existing verify budget; the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/hand_kinds.ts -->
  orchestration record carries `route_billing` and `verified: pass|fail|skipped`, plus the
  head's own tokens spent verifying it. A `skipped` verify on a free return counts as an
  escalation for Phase 6. A hand's return is untrusted data in the sense of
  `untrusted-input-defense` — never an instruction, never acted on before the head's verify.
  verify: orchestration-line validation rejects a free-route line without `verified`.
  Done 2026-10-22 (commit 619b597a8e): `hand_verification.test.ts` › `rejects an unpaid-route line without verified`; a typed return is recorded `untrusted: true` and `skipped` until the head runs `orchestration_record --verified`.
- [x] **3.4 The delegation nudge names the free rung** when the slice matches a kind in 3.1 and <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/delegation_nudge_hook.ts -->
  a route is admissible; it never auto-spawns.
  verify: a nudge fixture for a `classify` slice names the free rung and dispatches nothing.
  Done 2026-10-22 (commits 7857d7fd86, 0358a034ab): `delegation_nudge_free_rung.test.ts` › `a classify slice with an admissible route names the free rung and dispatches nothing`; the hook asks `free_rung.freeRouteAvailable` against the user-global council config, read lazily, without pulling the council loader into the hook bundle.
- [x] **3.5 Hands see fragments, never the project.** (Owner rationale, 2026-10-22, twice: no <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/hand_payload.ts -->
  single free provider learns the whole project; and "only what is needed — the function to
  build, not what exists".) A hand's payload is the slice the head cut — the specification of
  the function to build plus the signatures it must call, never their implementations, repo
  maps, architecture docs, README, roadmaps or the project name (decision A6). The hand's own
  system prompt carries no project rule, skill or instruction-file text. Identifiers that link
  fragments (project/package names, repo paths, domains) go through the existing placeholder
  scope before send.
  verify: the outbound payload of a call containing the project name carries its placeholder
  instead, and a payload fixture carries no implementation body of a called function.
  Done 2026-10-22 (commit 3064cf4394): `hand_payload.test.ts` — no callee body, project name placeholdered; sabotage turned 2 red.
- [x] **3.6 An exposure ledger per route.** Gitignored runtime state counts distinct project <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/continuity-surface.json -->
  files and symbols each route has seen; the chooser prefers the least-exposed admissible route
  and refuses a route past a share cap (default 20 % of tracked files, decision A4). This raises
  reconstruction cost; it never substitutes for the content ceiling or K4.
  verify: a seeded multi-route test leaves no route above the configured cap.
  Done 2026-10-22 (commit 34a1ca4623): `exposure_ledger.test.ts` › `leaves no route above the cap` (3 routes, 100 files, 90 calls, 60 served); cap is the constant 0.2. The cap applies to paid routes too, as decision A4 is written; whether to exempt them is listed for the owner in the PR.

## Phase 4 — Council: free proposers and jurors, paid chair

- [x] **4.1 Free seats as proposer and juror only** (ADR-257). Chair, synthesis and verdict stay <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/chairman.ts -->
  on paid seats; `seat_policy` refuses a free seat in those roles with a named reason. Jurors
  answer in parallel and blind — no juror sees another's answer before synthesis.
  verify: a `seat_policy` test refuses a free seat as chair with a named reason, and a juror
  prompt fixture contains no other juror's answer.
  Done 2026-10-22 (commits 78f7126f48, 2bc7ce4980): `seat_policy_and_ceiling.test.ts` refuses a free seat as chair with a named reason; chair candidates carry route billing.
- [x] **4.2 Panel size capped at five judges** (S3: ≈ 90 % of achievable independence at five); <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/chairman.ts -->
  prefer different architectures over more seats.
  verify: a config with six judges is refused with the cap as the reason.
  Done 2026-10-22 (commit 78f7126f48): a six-judge config is refused with the cap as the reason.
- [x] **4.3 Independence measured (D6).** Next to κ, compute pairwise error φ and Kish <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/chairman.ts -->
  n_eff = k / (1 + (k−1)·φ̄) on the same run; pre-register `free-jury-effective-independence`
  (bar: n_eff/k ≥ 0.5) before any run. The κ claim's bar is unchanged; n_eff is reported, not
  substituted.
  verify: a synthetic perfectly-correlated panel yields n_eff = 1.
  Done 2026-10-22 (commits 78f7126f48, 25df57a814): `jury_aggregate.test.ts` — a perfectly correlated panel yields n_eff = 1; `free-jury-effective-independence` pre-registered.

## Phase 5 — Liveness and quota (gateway M9, D7)

- [x] **5.1 Streaks, not last outcomes.** Per route+model, using the failure vocabulary of <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/continuity-surface.json -->
  `road-to-seats-that-know-why-they-failed`: `rate_limited` / `quota_exhausted` / server errors
  mark the route absent for this pass and never count against liveness; `model_unservable`
  (404 model-not-found, 410) extends a streak; three consecutive retire the model from the
  discovered roster until re-discovered.
  verify: three seeded `model_unservable` results retire the model; three `rate_limited`
  results do not.
  Done 2026-10-22 (594698ab11): `route_liveness.test.ts`, 17 green; vocabulary names reused from the seats roadmap via a local HTTP classifier; sabotage seen red.
- [x] **5.2 Fallback chain per kind** reusing `MidFlightFallback` (one retry, double-spend guard <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/route_chooser.ts -->
  kept).
  verify: a stub chain whose first route fails serves the call from the second route, and a
  repeated failure yields honest ∅ without a second paid call.
  Done 2026-10-22 (a962afa732): `route_fallback_chain.test.ts` — second route serves, repeated failure is ∅ with no third call.
- [x] **5.3 Liveness folds into the existing canary** (ADR-118: no new scheduled workflow). A <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/continuity-surface.json -->
  keyless leg needs no secret, so the cross-vendor leg finally runs; a streak of three or more
  red scheduled runs writes one status line that `doctor` and session start surface.
  verify: three seeded reds put the status line in place; one green clears it.
  Done 2026-10-22 (bd113de533): `canary_liveness.test.ts`; doctor runner and the session-start line on `council-availability`. The keyless leg is not in `cross-model-canary.yml`: no keyless route is catalogued; `--refresh` is manual.

## Phase 6 — Measure, then flip

- [x] **6.1 Billing axis (D10) and two pre-registered claims before any free call:** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/dispatch-economy-metrics.json -->
  `free-hands-limit-relief` — paid billable tokens avoided per week on rung 0.5, **minus the
  head's verification tokens from 3.3**; `free-hands-quality-held` — escalation + verify-fail
  rate of free-routed asks ≤ paid-routed asks + 5 pp, and below the registered 0.3 kill.
  Underpowered means neither claim is backed.
  verify: both claim rows exist in `docs/CLAIMS.md` with bars before the first free call, and
  `check_claims` is green.
  Done 2026-10-22 (commits 449f03cff0, 25df57a814): both claims in `docs/CLAIMS.md` with bars, `check_claims` exit 0; the ask line now writes `route_billing` and `verify_tokens` (3.3), so the axis has a source.
- [ ] **6.2 Shadow:** a free route answers in parallel, the paid answer is used, both are
  verified; the call budget recorded in decision A5, public-artifact corpus first.
  verify: the shadow ledger shows a free and a paid answer with a verify result for every call.
  Built 2026-10-22 (e7f38f239a): `free_hand_shadow.test.ts` ledgers both answers with a verify result.
  Wired and harnessed 2026-10-22, window not run: `ask_transport` calls `shadowAsk` (a45480aaf4, 32fc4978c8); the settings block now builds `base_url` members (e9312bad3d); PREREG 1bc9c41c5d (amended 6dc334d39c before any call); harness `internal/bench/free-hands-shadow/` (d1489529b8, 033fe5fbfb). The host's permission classifier refused sending repository content to the external route from this session. Closes when an operator runs the harness and files the evidence.
  Window running since 2026-10-23 (owner approval after a payload audit); two live-route defects fixed red-first first (A16; pacing from the reply).
- [x] **6.3 Flip per kind**, only for kinds that clear both bars; a kind that later breaches the <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/continuity-surface.json -->
  escalation kill reverts automatically and the reversion is recorded in the claim row.
  verify: a seeded breach above the kill flips the kind back to the paid route.
  Done 2026-10-22 (6fb2cb8e5b, 2ace081b28): `kind_flip.test.ts` — seeded breach reverts and is recorded; missing data never flips; the nudge names the free rung only for a flipped kind.

## Phase 7 — Breadth for consumers

- [x] **7.1 `llm-provider-knowledge` gains a free-tier class:** docs roots, data-use page, <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
  region caveat — no model ids, no limits copied. Answers "set up a free LLM API" for consumers.
  verify: the skill's linter passes and the skill names no model id.
  Done 2026-10-22 (commit f89826b92a): skill linter 1 pass, 0 fail; no model id named. The skill-body budget moved 7,434 → 8,465 with its raise entry.

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
| K12 | Treating a cloud-served model behind localhost as `self-hosted` | a loopback address says where the socket is, not where the model runs (A7) |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | agent | Keyless routes serve eval and jury; keyed free tiers are an opt-in for worker volume, with keys in the user-global key root; `doctor` names which is configured | keyless endpoints measured at ≈ 2 requests per minute per IP and model (S5) — too slow for worker volume, enough for a jury | a keyless endpoint offers worker-grade throughput |
| A2 | reversible-technical | agent | A roadmap of its own, not a promotion of `later/road-to-gateway-harvest`: the scope (fail-closed ceiling, typed worker kinds, exposure ledger, jury independence, net measurement) exceeds M1, and the parked file keeps six unrelated milestones | `later/road-to-gateway-harvest.md` milestone table; this file's Phases 1, 3, 4, 6 | the parked file is emptied of M4-M8 |
| A3 | reversible-technical | agent | The binary content ceiling stays; a four-level public / internal / confidential / strictly-confidential scheme from the supplied plan is declined | the existing ceiling is fail-closed after 1.1, and no route exists that a third or fourth level could admit; a level with no admissible route is a label, not a control | a route class appears that needs a ceiling between the two |
| A5 | reversible-technical | agent | The Phase 6 shadow is capped at 2,000 calls | enough for per-kind rates at the 5 pp margin on the public-artifact corpus; spend stays USD 0.00 under `free-quota` | the per-kind sample is underpowered at the cap |
| A4 | reversible-technical | agent | The exposure cap starts at 20 % of tracked files and is a tunable, not a gate threshold | owner rationale 2026-10-22; obscurity layer only, the ceiling and K4 carry the guarantee | the ledger shows a route at the cap blocking otherwise-admissible work |
| A6 | reversible-technical | agent | A hand's slice includes the signatures the function must call, not only its specification | a draft without its callees' signatures cannot compile, and the rework would land on the head; implementations stay out per the owner turn of 2026-10-22; Phase 6 measures whether the slice is too thin | 6.1 shows the head's verification tokens rising on slices that carried signatures only |
| A7 | reversible-technical | agent | A loopback self-hosted route may carry `project-content` only after a per-model probe shows local weights; without it, and on any non-loopback host, it may not without blocker `project-content-ceiling` | loopback is a precondition, not proof: a local runtime can serve a cloud-hosted model through its local API, and any localhost proxy forwards upstream; a model whose weights are on this machine has no data-use term to check | a probed-local route is observed forwarding upstream, or the probe cannot tell local from remote weights for a runtime in use |
| A8 | reversible-technical | agent | 2.5 reads the owner turn's self-hosted *finisher* as a *hand* that may see project content — a reinterpretation, stated as one | a local model as head or finisher would miss the quality bar the paid head holds; as a hand its output is still checked by the paid head | the owner restates self-hosted as finisher, or Phase 6 shows a self-hosted hand's drafts raising the head's verification tokens |
| A9 | product-owned | owner | Blocker `free-route-admission`: option (a) — OpenAI-compatible `base_url` routes are admitted as hands and jurors under ADR-257, keyless first, USD 0.00 under `free-quota`, shadow capped at 2,000 calls, termination on the Phase 6 bars or three consecutive `model_unservable`. Owner decision O2, dated 2026-10-23, confirms the council's 2/2 default of 2026-10-22 | the bounds contain the experiment and (b) produces no evidence; residue named by both seats: a payload already sent cannot be recalled, so fragmentation and classification hold before the first call | a privacy or correlation violation in the shadow, or the owner overturns it |
| A10 | product-owned | owner | Blocker `project-content-ceiling`: option (b) — every free route stays `public-artifact` permanently; no attestation raises one. Owner decision O3, dated 2026-10-23, confirms the council's 2/2 default of 2026-10-22 | the owner's directive limits free endpoints to work that does not touch data protection; an attestation documents a provider's policy and enforces nothing | `project-content` is narrowed to exclude customer, personal and proprietary data and a fail-closed egress path with refreshed provider assurance is independently validated |
| A11 | product-owned | owner | The exposure cap of A4 (20 % of tracked files) applies to paid routes too (owner decision O4, dated 2026-10-23) | 3.6 already applies it to every route; the owner settled the exemption question 3.6 listed | the cap blocks paid work the content ceiling already admits |
| A12 | product-owned | owner | The 6.3 thresholds stand: 333 shadow calls per kind before a flip; a revert only after 30 free-routed asks and only on the 0.3 kill; a reverted kind stays reverted until a person clears its record (owner decision O5, dated 2026-10-23) | `kind_flip.ts`: `MIN_SHADOW_PER_KIND` = 333, `REVERT_MIN_SAMPLE` = 30, `ESCALATION_KILL` = 0.3, a reverted kind is skipped by `applyFlips` | a per-kind sample proves the 333 floor underpowered at the 5 pp margin |
| A13 | product-owned | owner | A deliberately created measurement window is admissible when it consists of real, useful work and its evidence file labels it `manufactured` (owner decision O6, dated 2026-10-23) | the shadow window cannot fill from organic traffic before the 2,000-call cap matters | — |
| A14 | reversible-technical | council:agents/evidence/council/subagent-system-2583-rest-decisions-20261022.md | The keyless first-party route is catalogued maintainer-only with distribution `unknown`, first-party models enforced at discovery and member build (decision 2, round 1 split, round 2 2/2 (a)); the shadow verifies `classify` and `extract` deterministically on a manufactured public-artifact corpus with a blind 10 % paid-head audit, `summarise-given-text` stays unmeasured (decision 3, 2/2 (c)) | both rounds' prompts committed beside the evidence file | the route exposes no first-party flag, or the audit disagrees with the deterministic verifier |
| A15 | reversible-technical | council:agents/evidence/council/subagent-system-2583-rest-owner-residue-20261023.md | `ask_transport` is maintainer tooling: the delegation nudge cites it only inside this repository's checkout, and the free-hands routes are recorded as maintainer-only | Council 2026-10-23, 2/2 for option (1), council-decidable; a consumer `agent-config ask` would send project content to a user-configured external route, which is owner-reserved | the owner asks for a consumer entry point |
| A16 | reversible-technical | owner | Discovery resolves a listed id once: a first-party entry with declared aliases gets one minimal probe call, and when the route serves under one of those aliases the roster records the served id; an undeclared served id leaves the roster. The client's exact identity match is unchanged. Owner answer 2026-10-23 after a split council | Live 2026-10-23: `text.pollinations.ai` lists `openai-fast` and serves `gpt-oss-20b`, a declared alias, so every free call was absent with `policy_model_mismatch`. Council split 1:1 (`agents/evidence/council/subagent-system-2583-rest-owner-residue-20261023.md`) | the route rotates the served id between declared aliases within a roster's day |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Undeclared content reaches a free route | implementation | A caller that declares no content class sends project content to a `public-artifact` route. | 1.1 lands before any route exists; blocker `project-content-ceiling` keeps every free route at `public-artifact` until the owner rules. | Phase 1 — Floors that ship regardless of free routes |
| 2 | Free answers look right and are wrong | product | A hand returns a plausible proposal the head accepts without catching the error. | 3.3 makes verification mandatory and counted; 6.1 quality bar; per-kind flip in 6.3. | Phase 3 — The worker contract (rung 0.5, free hands) |
| 3 | Verification eats the saving | product | The head spends more tokens checking hands than the hands saved. | 3.3 records verification tokens; 6.1 measures relief net of them; no flip without it. | Phase 6 — Measure, then flip |
| 4 | Quota exhaustion stalls a session | implementation | A free route runs dry mid-task. | Quota means absent for the pass, paid fallback, honest ∅ (3.2, 5.1). | Phase 5 — Liveness and quota (gateway M9, D7) |
| 5 | Provider terms change silently | product | A route's data-use terms change after its attestation was recorded. | Dated attestations; the ceiling falls back to `public-artifact` when an attestation is older than 90 days; 2.3 re-discovery. Re-reviewed 2026-10-23: the one attested route covers first-party models only, so discovery and member build refuse any model the route lists as community-served. | Phase 2 — The route (gateway M1) |
| 6 | Fragments are re-linked | product | The same route sees enough fragments over months, or shared identifiers, to reconstruct structure. | 3.6 exposure cap and 3.5 placeholders; training routes never see project content (K4). | Phase 3 — The worker contract (rung 0.5, free hands) |
| 7 | Scoring quietly becomes deciding | implementation | A consumer starts acting on a free juror's score as if it were a verdict. | ADR-257; 4.1 refuses free seats in chair/verdict roles; consumers of free output enumerated in tests. | Phase 4 — Council: free proposers and jurors, paid chair |

## Blockers

### blocker: free-route-admission
- **Status:** resolved — the owner chose (a) on 2026-10-23 (decision O2), confirming the council's 2/2 recommendation of 2026-10-22 (`agents/evidence/council/subagent-system-2583-owner-blockers-20261022.md`); recorded as A9
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phases 2-7, except 2.5 (a self-hosted route is not a free route). Phases 0 and 1 run without it.
- **What to do:** pick exactly one — (a) admit OpenAI-compatible `base_url` routes as free hands and jurors under ADR-257, first a keyless endpoint, spend ceiling USD 0.00 enforced by billing class `free-quota`, shadow capped at 2,000 calls, termination on the Phase 6 bars or three consecutive `model_unservable` per route; or (b) keep the slot unspent and park Phases 2-7 in `later/` with this question recorded as the wake condition.
- **Recommendation:** (a). It answers the four things the 2026-09-07 refusal asked a new request to name (seat, call count, spend ceiling, termination rule), and it is the only path to the owner's 2026-09-05 free-jury goal and the 2026-10-22 directive.
- **If you do nothing:** the free-route question arrives a fifth time; `free-jury-judge-agreement` stays unbacked with no route to back it.
- **Resolved when:** a dated owner decision line naming (a) or (b) is recorded in this file's `## Decisions` table.

### blocker: project-content-ceiling
- **Status:** resolved — the owner chose (b) on 2026-10-23 (decision O3), confirming the council's 2/2 recommendation of 2026-10-22 (`agents/evidence/council/subagent-system-2583-owner-blockers-20261022.md`); recorded as A10
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** any free route above `public-artifact` — the subagent-style kinds of 3.1 on consumer code. Hands on repo-owned artefacts run without it.
- **What to do:** pick exactly one — (a) a keyed free route may be raised to `project-content` only with a dated data-use attestation (no training, no retention, source URL) and the egress engine in front, and routes whose terms allow training on prompts stay `public-artifact` permanently; or (b) every free route stays `public-artifact` permanently. Under either option a keyless anonymous route stays `public-artifact`.
- **Recommendation:** (a). Without it most of the subagent-style value the directive names is out of reach; the attestation plus K4 keep the floor where a raise is provable.
- **If you do nothing:** hands run only on repo-owned artefacts; Phase 6 measures a narrower kind set.
- **Resolved when:** a dated owner decision line naming (a) or (b) is recorded in this file's `## Decisions` table.

## Acceptance Criteria

- [x] AC-1 An undeclared payload is refused by a `public-artifact` seat (1.1).
  Done 2026-10-22: 1.1, `ec9df20078`.
- [x] AC-2 Bare `hf_` / `nvapi-` / `r8_` are masked 50/50 (1.2).
  Done 2026-10-22: 1.2, `06777113cc`, `9725442e47`.
- [ ] AC-3 A free route serves a typed rung-0.5 call, chosen by kind, class and quota (3.2).
  Built 2026-10-22, open: served end to end by a loopback stub through `askOnce` → `chooseRoute` (3.2). No free route is configured on the maintainer's host — adding one needs an account or key outside this run — so no live free call has been served.
  2026-10-22, second pass: a keyless first-party route is catalogued and attested (2.3), the settings path now builds it (e9312bad3d), and `run.ts --ac3-demo` serves one typed classify ask on it through the production chooser and verifies it deterministically (tested against stubs). The live call was refused by the host's permission classifier for this session. Closes on the first live `--ac3-demo` run by an operator.
- [x] AC-4 No free route holds a head role (4.1, K1).
  Done 2026-10-22: 4.1, `seat_policy_and_ceiling.test.ts`.
- [x] AC-5 n_eff is reported beside κ on every jury run (4.3).
  Done 2026-10-22: 4.3, `jury_aggregate.test.ts`.
- [x] AC-6 Both Phase 6 claims are filed before the first free call, and limit relief is reported net of verification tokens; every flip cites them.
  Done 2026-10-22: claims filed before any free call (6.1); the shadow report nets verify tokens (6.2); every flip and revert line names `free-hands-quality-held` (6.3).
- [x] AC-7 The canary's uniform zero is classified before Phase 5 is designed (0.1).
  Done 2026-10-22: 0.1, `15d00c9420`, before Phase 5 was designed.

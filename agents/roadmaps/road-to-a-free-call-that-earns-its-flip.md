---
complexity: structural
status: ready
tree_pin: b234d08480
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps over the WIP cap of 5, owner-directed 2026-11-03 (agents/evidence/owner-directives/2026-11-03-process-inbox-2026-11-n-roadmaps.md): one of eight roadmaps of round inbox-2026-11-n landed active so /roadmap:process-full executes them in the same run."
estate_offset_exempt: "Owner search at b234d08480 (grep -rlF for kind_flip, free_hand_shadow, route_liveness, remaining_quota, data_collection, juryIndependence, free-hands-quality-held, model_not_found, egress_prefixes, servedMatches over agents/roadmaps, later, stubs) returned nothing; only retry-after hit later/road-to-seats-that-know-why-they-failed.md, which owns header parsing and is extended, not duplicated."
relates:
  - slug: road-to-free-hands-a-paid-head-checks
    relation: disjoint
    note: "Archived with every box checked; the defects below keep its claims unbacked and its flip unreachable."
  - slug: road-to-seats-that-know-why-they-failed
    relation: disjoint
    note: "Owns the failure vocabulary, retry-after, cooldown and quota headers. This file only fixes existing classifier rows and adds no class."
  - slug: road-to-gateway-harvest
    relation: disjoint
    note: "Its parked milestones stay parked; nothing here runs or vendors an external gateway."
---
# Road to a free call that earns its flip

> **Source:** `agents/tmp.old/inbox-2026-11-n/` (topic T4; T0 roadmap-05).
> **Arrivals:** 1 — `inbox-2026-11-n` (2026-11-03).

## Goal

A free-route verdict reaches the flip ledger and a truncated answer never passes. Not started
at the pin: the head's `pass` never joins (`kind_flip.ts:66-78`), production shadow rows count
as failures (`free_hand_shadow.ts:208`), and `servedMatches('llama-3.1','llama-3.1-405b')` is
`true` (`free_route.ts:210-216`). No step adds a provider, a paid call, or a failure class.

## Phase 1 — The verdict reaches the ledger

- [ ] **1.1 The printed verify command names the kind.** `src/scripts/ask_transport.ts`
      (`:588-591`) appends `--hand-kind <kind>` when the ask was typed.
      verify: `npx vitest run tests/scripts/ask_transport_hand_kinds.test.ts` -> 0, with a new
      case asserting stderr contains `--hand-kind classify`.
- [ ] **1.2 The flip reader joins by `work_id`.** `src/scripts/ai_council/kind_flip.ts`
      `observationsFromAuditLines`: a verify-phase line without `hand_kind` inherits kind and
      billing from the ask line with the same `work_id`; the latest verdict per `work_id` wins;
      an ask with no later verdict stays `skipped` (the pre-registered claim text is unchanged).
      verify: `npx vitest run tests/scripts/ai_council/kind_flip.test.ts` -> 0, with a red-first
      case: 30 ask lines plus 30 head `pass` lines produce no revert.
- [ ] **1.3 Production shadow rows are tagged and kept out of the flip stats.**
      `src/scripts/ai_council/free_hand_shadow.ts` rows gain `origin: 'production' | 'bench'`;
      `_runShadow` in `ask_transport.ts` passes `production`; shadow stats and the
      `SHADOW_CALL_CAP` count exclude `production` rows; rows without `origin` keep today's
      behaviour. Whether the production shadow should exist at all is owner decision E2.
      verify: `npx vitest run tests/scripts/ai_council/free_hand_shadow.test.ts tests/scripts/ask_transport_shadow.test.ts` -> 0,
      with a case where production rows with `skipped` leave the kind's free rate unchanged.

## Phase 2 — An answer and a failure are read correctly

- [ ] **2.1 A truncated typed return is not a schema pass.** `src/scripts/ask_transport.ts`
      `_callRoute` (`:405-414`): when `opts.kind` is set and `isIncompleteStop(r.stop_class)`
      (`stop_class.ts`), return `schemaValid: false`, never `true`.
      verify: `npx vitest run tests/scripts/ask_transport_hand_kinds.test.ts` -> 0, with a fixture
      whose JSON parses but `stop_class: 'truncated'`.
- [ ] **2.2 `model_not_found` is `model_unservable`.** `src/scripts/ai_council/route_liveness.ts`
      (`:53-55`): 404 and 400 bodies carrying `model_not_found` or a `"code":"model_…"` field map
      to the existing `model_unservable`; a plain 400 stays `other`. No new class.
      verify: `npx vitest run tests/scripts/ai_council/route_liveness.test.ts` -> 0 with fire rows
      (404 `model_not_found`, 400 `"code":"model_not_found"`) and a near-miss row (400 `invalid temperature` -> `other`).
- [ ] **2.3 Liveness is keyed by catalog id.** `route_liveness.ts` callers
      (`free_hand_shadow.ts:176`, `ask_transport.ts:404`) resolve the member's `base_url` to the
      catalog row id via `routeIdentity` (`route_member.ts`), falling back to the member name for
      an uncatalogued route, so `_retirementStands` reads the same roster discovery writes.
      verify: `npx vitest run tests/scripts/ai_council/route_liveness.test.ts` -> 0 with a member
      named `groq-x` on the `groq` base URL that retires after three strikes and is live again
      after a newer discovered roster lists the model.
- [ ] **2.4 A served id may not add a size.** `src/scripts/ai_council/free_route.ts`
      `servedMatches` (`:210-216`): when the requested id carries no parameter-size token
      (`\d+(\.\d+)?[bm]\b`, case-insensitive) and the served suffix does, the match is false.
      verify: `npx vitest run tests/scripts/ai_council/free_route_identity.test.ts` -> 0 with
      `llama-3.1` vs `llama-3.1-405b` false, `gpt-4o` vs `gpt-4o-2024-08-06` true,
      `llama-3.1-8b` vs `llama-3.1-8b-instruct` true.

## Phase 3 — The wire and the ledger

- [ ] **3.1 The aggregator route asks its providers not to keep prompts.**
      `src/scripts/ai_council/free_route_client.ts` (`:66`): when `routeIdentity(base_url)` is the
      catalogued `openrouter` row (`free_route_catalog.ts`), the request body carries
      `provider: { data_collection: 'deny' }`.
      verify: `npx vitest run tests/scripts/ai_council/free_route_member.test.ts` -> 0 with a case
      that captures the body through the injected `post` seam and asserts the field, plus a
      non-catalogued route whose body has no `provider` key.
- [ ] **3.2 The exposure ledger writes atomically.** `src/scripts/ai_council/exposure_ledger.ts`
      (`:89`) writes a temp file and renames it, like `kind_flip.ts` `_write`.
      verify: `grep -n "renameSync" src/scripts/ai_council/exposure_ledger.ts` -> one hit, and
      `npx vitest run tests/scripts/ask_transport.test.ts` -> 0.

## Later (not active steps)

- Header capture, `retry-after` formats, 429 ordering and a `remaining_quota` writer —
  appended to `later/road-to-seats-that-know-why-they-failed.md` (it owns the vocabulary).
- A new pre-registered `extract` window separating transport from answer failures — needs
  elapsed time and the owner's egress approval.
- Catalog attestation of the five null rows and credential-prefix rows for their key shapes —
  need each provider's published terms read and dated (network).
- Jury family from the served id, κ and n_eff in every run report, panel size from measurement —
  needs real jury runs first.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The join flips a kind on stale verdicts | implementation | a `pass` recorded long after the ask could mask a real escalation | latest verdict per `work_id`; unanswered asks stay `skipped`; claim text untouched | Phase 1 |
| 2 | Excluding production rows hides real failures | product | production shadow rows carried signal the bench lacks | rows are tagged, not deleted; the existence question is E2 | Phase 1 |
| 3 | The size rule refuses a legitimate variant | implementation | a served id with a size the request implied | only fires when the request names no size; variant suffixes still match | Phase 2 |

## Acceptance Criteria

- [ ] AC-1 — 30 free asks with 30 head `pass` lines do not revert the kind.
- [ ] AC-2 — No production shadow row moves a kind's free failure rate.
- [ ] AC-3 — A truncated typed return and a size-substituted served id are never a pass.
- [ ] AC-4 — A `model_not_found` retires a model on its catalog key, and rediscovery revives it.

## Non-goals

- Running or vendoring an external gateway, subscription-credential pooling, or client
  fingerprint tricks.
- A second failure vocabulary; new providers; any change to ADR-257 (free seats never chair,
  synthesise or carry a verdict).
- Any new paid call or paid fallback (owner decision E3).

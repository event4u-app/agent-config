---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "One active roadmap, no new blocker. It wakes M2 of later/road-to-gateway-harvest with the red probe ADR-211 Amendment D asks for, and fixes a live misclassification on the CLI seats that escalates a seconds-long throttle to a paid seat."
estate_offset_exempt: "No active roadmap owns council failure classification; M2 lives in a later/ file that stays parked for its other milestones. Archiving an unrelated finished file to buy the slot would hide the growth this key exists to show."
relates:
  - slug: road-to-gateway-harvest
    relation: extends
    note: "Phase 3 is M2 (cooldown ledger, mini-ADR, pre-registered claim with its honest-null path); Phase 0.2 is the red probe M2 names as its qualification."
  - slug: road-to-free-hands-a-paid-head-checks
    relation: disjoint
    note: "That roadmap consumes this one's closed failure vocabulary for route liveness and owns the base_url route; the jury seat the supplied plan proposed as P8 is executed there, not here."
---
# Road to seats that know why they failed

> **Source:** `agents/tmp.old/inbox-2026-10-y/` — one owner chat and two supplied plans. The
> repository-shaped plan was pinned at `main@5c4d54679` and a host binary read by the strings
> method; every tree fact below was re-verified against `origin/main@447f8fd` on 2026-10-22.
> External sources are coded S1–S6; their identities stay out of the tree. The source's code
> is AGPL-3.0 and this package is MIT: only ideas are taken, re-derived (K1).

## Goal

Every failure of a council seat carries a class before it gets a reaction, and the class picks
the reaction: a throttle of a few seconds waits or is skipped, an exhausted plan escalates or
parks, a context overflow never retries. Today a throttle and an exhausted plan are one class
on CLI seats, and API seats have no class at all.

## Context — reproduced on this tree

| # | Defect | Evidence | State |
|---|---|---|---|
| D1 | The CLI seats put a throttle and an exhausted plan into one class. `_QUOTA_PATTERNS` lists `'rate limit'`, `'429'`, `'too many requests'` beside `'quota exceeded'` and `'usage limit'`. The reaction is the empty-plan one: escalation to the paid API twin (`api_on_quota: true`), parking, or a `quota_parked` marker that `run_supervise` reads as plan end. The tree knows: `ai_team/team_dispatch.ts:596` — "`cli_quota_exhausted` covers two events with opposite remedies". | `src/scripts/ai_council/clients.ts` `_QUOTA_PATTERNS`; `_lib/quota_parked.ts`; `transport_resolver.ts` | live |
| D2 | API seats have no failure class. Every exception lands as free text in `error`; the curl transport reads the status but drops the headers, so `Retry-After` is unreadable (0 matches for `retry.after` under `src/scripts/ai_council/`). `HTTP 429: …` classifies as `other`: no retry, no fallback, the seat is missing from the round. | `api_transport.ts`; `transport_resolver.ts` | latent; live once a free seat exists |
| D3 | A council run has no time bound. Seats run serially, each call may take 290 s, nothing aborts one; the only run-wide bound is the USD limit, checked after the call. | `api_transport.ts` docblock | live, documented |
| D4 | The live smoke covers 2 of 5 API seats and no CLI seat; with `COUNCIL_LIVE_SMOKE=1` and a missing key the result is a silent skip, and a skip carries no machine-readable cause. | `tests/ai_council/clients_live_smoke.test.ts` | live |

**Reused, not rebuilt:** `CliFailureClass` with `isFallbackEligibleUnder`, `MidFlightFallback`
(once per provider, double-spend guard), `model_served`, the `quota_parked` PII-free record
shape.

## Phase 0 — Red probes first (ADR-211 Amendment D)

- [ ] **0.1 A throttle read as quota (D1).** Fixture: CLI stderr with `429 Too Many Requests` and
  `retry after 20s`. Expected today: `cli_quota_exhausted`, and under `api_on_quota: true` a paid
  twin follows.
  verify: the test is red at the base commit and names the escalated twin.
- [ ] **0.2 An API 429 loses the seat (D2).** Through the existing JSON-post seam, inject
  `HTTP 429` with `Retry-After: 7`. Expected today: `error: 'HTTP 429: …'`, class `other`, no
  retry. This is M2's qualifying red test.
  verify: the test is red at the base commit.

## Phase 1 — A throttle and an empty plan are two classes (D1)

- [ ] **1.1 New class `rate_limited`** beside `quota_exhausted`. Structured signals before free
  text: exit code, JSON error field and `retry after N` before substring. `'rate limit'`, `'429'`
  and `'too many requests'` move to `rate_limited`; `'quota exceeded'` and `'usage limit'` stay.
  On ambiguity `rate_limited` wins — the cheap mistake is "wait briefly", the expensive one is
  "escalate to paid".
  verify: 0.1 green; one fixture per pattern.
- [ ] **1.2 `rate_limited` never escalates to a paid twin**, writes no `quota_parked` marker, and
  gets its own message in `team_dispatch`.
  verify: a test over `rate_limited` × `api_on_quota` ∈ {false, true, 'ask'} shows no twin and
  no marker.
- [ ] **1.3 At most one retry of the same seat**, only when a wait is named and ≤ 60 s (decision
  A1). Without a named wait or above 60 s: no retry, the seat is absent with cause
  `rate_limited`.
  verify: a named wait under the bound yields one retry; a wait above it yields none, with the
  cause in the result.
- [ ] **1.4 The new code reaches the events log**; every reader counting `cli_quota_exhausted` is
  adjusted in the same change (classification already matches by prefix, so history readers do
  not break).
  verify: every remaining `cli_quota_exhausted` hit under `src/` carries a one-line reason for
  staying unchanged; all other hits are adjusted.

## Phase 2 — API seats get a class (D2), still without a cooldown

- [ ] **2.1 The curl transport reads `retry-after`** and throws a typed error with `status`,
  `retry_after_s` and a truncated body.
  verify: 0.2 shows `rate_limited` with `retry_after_s: 7`.
- [ ] **2.2 One vocabulary for CLI and API.** Precedence: structured code, then status, then
  text. 413 and `context_length_exceeded` beat rate markers; 402 is `billing`, not `auth`; 501
  and 505 are not retryable. The same table carries retryability as its own bit.
  verify: a table test covers every status class, and fixtures for a context-overflow status
  carrying rate text and for a payment-required status pass.
- [ ] **2.3 `Retry-After` is capped** at the 1.3 bound; above it nothing sleeps and the cause is
  named (an uncapped wait is a known weakness of S1, K3).
  verify: a day-long `Retry-After` header causes no sleep and a named cause.

## Phase 3 — Cooldown across runs (M2 woken)

Runs only once 0.2 is red **and** `road-to-free-hands-a-paid-head-checks`'s blocker
`free-route-admission` resolves (a): without free API seats the cross-run cooldown has nothing
to protect, and M2's own honest-null path applies.

- [ ] **3.1 Mini-ADR against the state-store test**, as M2 requires. Key `(provider,
  sha256(api_key))`, never the key; stored under `agents/runtime/state/`; fields cause, `until`,
  `observed_at`; no prompt or body field, PII excluded by construction like `quota_parked`.
  verify: the ADR exists; a schema test shows no field can hold free text.
- [ ] **3.2 A seat in cooldown is not called** and reports `absent: cooldown` with the remaining
  time. No background process, no probe scheduler.
  verify: two runs in a row against a throttle fixture — the second makes no call.
- [ ] **3.3 Pre-registered claim with an honest-null path:** "the chair fallback already
  suffices" drops the phase.
  verify: the claim row precedes the measurement and `check_claims` is green.

## Phase 4 — A live probe per seat with cause classes (D4)

- [ ] **4.1 The smoke covers every API seat** (Gemini- and OpenAI-compatible shims) and every
  installed CLI seat, each call capped at 16 output tokens as today.
  verify: the test list names every client class in `clients.ts`.
- [ ] **4.2 Outcome classes as data:** `missing_env`, `upstream_unavailable`, `rate_limited`,
  `probe_timeout`, `product_failure`, `harness_bug`. Only the last two are regressions; a skip
  without a class counts as `harness_bug`.
  verify: the classifier has its own tests, including that a deterministic bad-request answer
  is not an outage.
- [ ] **4.3 An explicitly chosen provider without a key is an error, not a skip**
  (`COUNCIL_LIVE_SMOKE_PROVIDERS=…`).
  verify: a chosen but unconfigured provider turns the run red.
- [ ] **4.4 Never in CI, never unattended spend** — operator opt-in as today.
  verify: no workflow under `.github/workflows/` invokes the live smoke.

## Kill register

| # | Not done | Why |
|---|---|---|
| K1 | Taking code, prompts or text from S1 | AGPL-3.0-only vs MIT; ideas only, re-derived |
| K2 | A leader/follower probe with a queue per credential | the council calls serially; there is no herd |
| K3 | An uncapped `Retry-After` | known weakness of S1 (2.3) |
| K4 | Classification by text substring alone | known weakness of S1; structured codes first (1.1, 2.2) |
| K5 | History-replay wrappers for reasoning blocks, response prefixes, tool-call buffers | council calls are stateless single shots and stream to no client |
| K6 | Free models as verdict, chair or evaluator | ADR-257, regardless of any measurement |
| K7 | Re-planning ideas the tree already has: stale-allowlist checks, merge-commit checkout in CI, idempotent publish with provenance, existence-checked claim anchors | `check_suppression_hygiene`; `actions/checkout` default on `pull_request`; `publish-npm.yml`; `check_claims` `file#substring` |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | agent | Retry the same seat once on `rate_limited` when the named wait is ≤ 60 s; at most once per seat per round | a council call is a stateless read question and therefore retry-safe, unlike the subagent case `road-to-a-cold-start-paid-once` had to guard | a retried call is observed to double-spend |
| A2 | reversible-technical | agent | Council run time (D3) is measured first — duration per round into the events log — and bounded only with data | a bound set without data guesses; the USD gate already caps spend | the measured p95 round exceeds the 290 s per-call cap times seat count |
| A3 | reversible-technical | agent | The jury seat the supplied plan proposed as its Phase 8 is not planned here; `road-to-free-hands-a-paid-head-checks` Phase 4 owns it, so the capability is planned in one place | both supplied plans propose the same `base_url` jury seat | the free-hands roadmap is parked without its Phase 4 |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A real plan end read as a throttle | implementation | 1.1 classifies an exhausted plan as `rate_limited` and retries. | Retry only with a named wait ≤ 60 s, at most once; afterwards the cause is named, never a twin. | Phase 1 — A throttle and an empty plan are two classes (D1) |
| 2 | Readers of the old code break | implementation | Something counting `cli_quota_exhausted` silently stops seeing throttles. | 1.4 sweeps every reader in the same change. | Phase 1 — A throttle and an empty plan are two classes (D1) |
| 3 | The cooldown store becomes a leak | product | A cooldown record grows a field that carries prompt or key material. | Hashed key only, schema test against free text, mini-ADR (3.1). | Phase 3 — Cooldown across runs (M2 woken) |

## Acceptance Criteria

- [ ] AC-1 Both Phase 0 probes are committed red before any change and green afterwards.
- [ ] AC-2 No path escalates a throttle to a paid twin (1.2).
- [ ] AC-3 Every missing council seat carries a cause from the closed vocabulary; `other` appears only with a reason in its detail.
- [ ] AC-4 The live smoke reports a class for every skip (4.2).

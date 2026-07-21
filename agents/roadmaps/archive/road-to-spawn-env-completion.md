---
complexity: structural
execution:
  mode: autonomous
parent_roadmap: road-to-runtime-security-hardening
---

# Road to spawn-env completion — close the GIT_CONFIG RCE residual, classify every spawn site

> Close the reproduced `GIT_CONFIG_*` config-injection RCE that survived the
> PR #984 deny-by-family scrub, migrate the one remaining consumer-runtime
> spawn site (the hook dispatcher), and classify all spawn sites in a
> self-enforcing policy doc — **without** adding the proposed secure-spawn lint
> (council-rejected as governance surface).

## Goal

Make `hardenedSpawnEnv` deny the `GIT_CONFIG*` family + `GIT_ALTERNATE_OBJECT_DIRECTORIES`
+ `HOSTALIASES` (with falsifiable tests), route the last consumer-runtime spawn
(`hooks/dispatch_hook.ts`) through it, and resolve the ADR-123
`maintainer-ci-spawn-sweep` blocker via a spawn-site policy inventory doc — the
disciplined completion of the runtime-security work, staying strictly
security-scoped.

## Context (verified 2026-07-21, do not relitigate)

Source: the user-supplied 9.6.0 review (`agents/tmp/feedback-9.6.0-1.txt`,
local/gitignored). It praised the just-merged PR #984 / ADR-123 runtime-security
work but **reproduced a working exploit against it**, confirmed empirically here:

- `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0='sh -c …'`
  (also `GIT_CONFIG_GLOBAL`/`_SYSTEM`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`,
  `HOSTALIASES`) **survived the shipped scrub** — the `GIT_*_COMMAND` deny-family
  missed it (no `_COMMAND` suffix). git then runs that shell on every
  `git status`, which both consumer-runtime hooks trigger. All 5 vectors leaked;
  now closed.
- PR #984 migrated `clients.ts` + `hot_context_hook` + `roadmap_progress_hook`
  but **missed `hooks/dispatch_hook.ts`** — the consumer-runtime concern
  dispatcher that spawns every hook via tsx with `{...process.env, …}`.
- The review's other in-repo items (utilization sweep, lazy-catalog A/B,
  judge-survivable corpus, external-adoption) are **separately gated** and
  explicitly out of scope for a security-completion roadmap.

### Council notes (2026-07-21, anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds)

- **Secure-spawn lint — REJECTED (dominant verdict).** The review proposed (P0) a
  CI lint forbidding raw `spawn`/`exec` in runtime paths. Sonnet (both rounds)
  argued it is net-new governance surface — a CI gate + allowlist + exemption
  adjudication + false-positive triage — which the folded complexity-budget lock
  (PR #983) forbids: the lock text explicitly lists "linter", and the
  "retires ad-hoc review" justification fails the retirement test (no such
  review gate exists). gpt-4o's "council-gate it" was rebutted as a punt. The
  **policy inventory doc is the self-enforcing substitute** — git-diff visibility
  at review time, not a build gate.
- **Scope — Phase 1 + 2 ship; Phase 3 (lint) dropped, not deferred.** Both
  members: stay strictly security-completion; do NOT expand into
  utilization/lazy-catalog/judge-corpus (Q3, unanimous).

### Gap-table (KEEP / RESOLVE-BY-DOC / DROP — feedback-9.6.0 items)

| Review item | Verdict | Where |
|---|---|---|
| `GIT_CONFIG_*` / `GIT_ALTERNATE_OBJECT_DIRECTORIES` / `HOSTALIASES` RCE residual (docked point) | **KEEP** | Phase 1 — deny-list extension + falsifiable tests |
| Migrate the missed consumer-runtime dispatcher (`dispatch_hook`) | **KEEP** | Phase 1 |
| P1 spawn-site inventory / policy table (resolves ADR-123 blocker) | **KEEP** | Phase 2 — `docs/spawn-site-policy.md` |
| P0 secure-spawn lint / architecture-test | **DROP** | Council-rejected — governance surface vs complexity-budget lock; policy doc is the self-enforcing substitute (ADR-123 follow-up) |
| Utilization KEEP/MERGE/REMOVE sweep · lazy-catalog A/B · judge-survivable corpus · external adoption | **OUT OF SCOPE** | Separately gated; a security roadmap does not expand into them (council Q3) |
| Knowledge-security parity · CHANGELOG `[Unreleased]` drain | **OUT OF SCOPE** | Distinct concerns; not security-spawn |

## Phase 1 — Close the GIT_CONFIG RCE residual

- [x] Extend `hardenedSpawnEnv` deny-list: add the `GIT_CONFIG` / `GIT_CONFIG_*`
      family by prefix (covers `GIT_CONFIG_COUNT`/`_KEY_<n>`/`_VALUE_<n>`/`_GLOBAL`/
      `_SYSTEM`, the `core.fsmonitor` arbitrary-config-injection primitive) plus
      exact `GIT_ALTERNATE_OBJECT_DIRECTORIES` and `HOSTALIASES`; update the header
      docstring. <!-- done 2026-07-21: DENY_EXACT + isDeniedByFamily GIT_CONFIG prefix -->
      <!-- verify: cd ../agent-config-spawnenv && npx tsx -e "import('./src/scripts/_lib/spawn_env.ts').then(m=>{process.env.GIT_CONFIG_COUNT='1';process.env.HOSTALIASES='/x';const e=m.hardenedSpawnEnv();if(e.GIT_CONFIG_COUNT||e.HOSTALIASES)throw new Error('leak');console.log('ok')})" -->
- [x] Extend the falsifiable test with the reproduced `core.fsmonitor` vectors
      (`GIT_CONFIG_COUNT`/`_KEY_0`/`_VALUE_0`/`_GLOBAL`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`,
      `HOSTALIASES`) — proven red without the fix (6 vectors leaked), green with it. <!-- done 2026-07-21: tests/scripts/ai_council/spawn_env.test.ts extended; red→green verified -->
      <!-- verify: cd ../agent-config-spawnenv && npx vitest run tests/scripts/ai_council/spawn_env.test.ts 2>&1 | tail -3 -->
- [x] Route the missed consumer-runtime dispatcher through the helper:
      `hooks/dispatch_hook.ts` concern spawn → `hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT })`. <!-- done 2026-07-21: import + concern_env now hardened; import-smoke green -->
      <!-- verify: grep -q "hardenedSpawnEnv" src/scripts/hooks/dispatch_hook.ts && echo ok -->

Exit: all 6 injection vectors blocked (test green, red without the fix); the
consumer-runtime spawn surface (transport + 3 hooks + dispatcher) fully hardened.
Rollback: revert the deny-list additions + the one dispatch_hook line.

## Phase 2 — Classify every spawn site (resolve the ADR-123 blocker)

- [x] Author `docs/spawn-site-policy.md`: four buckets (Consumer Runtime /
      Maintainer CLI / trusted CI / install-time), the MUST-harden rule for
      Consumer Runtime, the consumer-runtime inventory (all ✅ hardened), and the
      maintainer/CI/install exempt rationale. This is the self-enforcing
      substitute for the rejected lint. <!-- done 2026-07-21: docs/spawn-site-policy.md -->
      <!-- verify: grep -q "Consumer Runtime" docs/spawn-site-policy.md && echo ok -->
- [x] Record the follow-up in ADR-123: GIT_CONFIG residual closed, blocker
      resolved by classification (not mass migration), secure-spawn lint rejected
      with rationale; update threat-model row (g). <!-- done 2026-07-21: ADR-123 Follow-up (2026-07-21) section + threat-model row (g) updated -->
      <!-- verify: grep -q "Follow-up (2026-07-21)" docs/decisions/ADR-123-runtime-security-scope-and-spawn-hardening.md && echo ok -->

Exit: `docs/spawn-site-policy.md` classifies all spawn sites; ADR-123 records the
residual closure + blocker resolution + lint rejection. Rollback: revert the doc
+ ADR follow-up.

## Acceptance criteria (anti-dump)

- [x] **Live RCE closed, falsifiably:** the reproduced `core.fsmonitor` exploit is
      red without the fix and green with it; all 5 reviewer-named vectors blocked.
- [x] **No new mechanism:** the deny-list is extended (not a new artifact); the
      spawn-site policy is a doc, not a lint/gate/rule — the complexity-budget lock
      holds. The secure-spawn lint is DROPPED and recorded, not silently skipped.
- [x] **Security-scoped only:** no utilization-sweep / lazy-catalog / judge-corpus
      / knowledge-security / CHANGELOG work bleeds in (council Q3).
- [x] **ADR-123 blocker resolved honestly:** `maintainer-ci-spawn-sweep` closed by
      classification + doc, with maintainer/CI exemptions justified — not left open.

## Provenance

Source: the user-authored 9.6.0 review (`agents/tmp/feedback-9.6.0-1.txt`, local,
gitignored). The review references one external comparison (not depended on here).
Council convergence recorded inline (date + members), no session-file path cited.

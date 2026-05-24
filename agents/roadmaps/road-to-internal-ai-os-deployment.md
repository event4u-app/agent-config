---
complexity: structural
---

# Roadmap: Internal AI OS Deployment — one-click company rollout + central policy

> Make the package deployable as a **shared internal AI OS** for a company: one-click Docker / SSO setup, central policy for model access + guardrails, shared team context, internal-knowledge connectors (Git, Confluence, Notion, Drive). Today the package is a single-developer install; tomorrow a tech-lead deploys it for 50 people in one afternoon.

## Prerequisites

- [ ] Read `agents/tmp/feedback7.txt` — "Internal AI Operating System" framing; "no other AI product needed" hypothesis.
- [ ] Read `agents/tmp/feedback6.txt` §P2.11 (pack-marketplace contract — relevant for shared-pack signing).
- [ ] Confirm trust-and-safety contract — `docs/contracts/trust-and-safety.md` — and the `trust.level` enum currently shipping.
- [ ] Confirm `road-to-global-only-install.md` Phase 4 has defined the consumer surface (`agents/overrides/` + bridge marker) — central policy plugs into that contract.
- [ ] Confirm provider lifecycle contract — `provider-lifecycle-discipline` rule + adapter tiers.
- [ ] Sequencing — this roadmap **follows** `road-to-global-only-install.md` (global core path) and `road-to-product-adoption.md` Phase 1 (smoke matrix). Do not start Phase 2+ before either lands.

## Context

Feedback7 names the strategic frontier: the package is **technically excellent** but **organizationally invisible**. Single-developer adoption ≠ company adoption. The bottleneck is not features; it is the friction of "how do I roll this out to my team of 12 / 50 / 200 without each person doing `npx init` and configuring their own provider keys?".

This roadmap is **structural**, not lightweight — it touches the trust contract, introduces a new deployment artefact (Docker / Compose), defines a central-policy file consumed at runtime, and adds connector adapters with their own lifecycle. It needs a council pass on each of Phases 2, 3, and 5 before code lands.

- **Feature:** new — `packages/core/deploy/` (container manifests), `packages/core/policy/` (central policy reader), `packages/core/connectors/` (read-only knowledge adapters).
- **Sources:** `agents/tmp/feedback7.txt`; cross-link `agents/tmp/feedback6.txt` §P2.11.

## Phase 1: Deployment artefact — Docker + Compose (single-host first)

Make the package run as a long-lived server for a team, not a per-developer install.

- [x] **Step 1:** Author `packages/core/deploy/Dockerfile` — multi-stage build (Node + Python + the global `~/.event4u/agent-config/` core). Final image runs the GUI server (`agent-config-installer gui --host 0.0.0.0 --port 8787`) on a non-root user. Image size budget: < 600 MB compressed.
- [x] **Step 2:** Author `packages/core/deploy/docker-compose.yml` — services: `agent-config` (the image), `redis` (session + queue), `postgres` (audit log + memory persistence — replaces filesystem JSONL when `STORAGE_MODE=postgres`). Three named volumes: `agent-config-core`, `agent-config-runtime`, `postgres-data`.
- [x] **Step 3:** New env var contract — `STORAGE_MODE` (`filesystem | postgres`), `SESSION_BACKEND` (`memory | redis`), `BIND_HOST` (default `127.0.0.1` for dev, `0.0.0.0` for compose). Documented in `docs/deploy/env-vars.md`.
- [x] **Step 4:** Healthcheck endpoint — `GET /api/v1/health` returns `{status: "ok", version, uptime_seconds, storage_mode, session_backend}`. CSRF-exempt; rate-limited to 1 rps per IP.
- [x] **Step 5:** Council artefact — open question captured locally under `agents/tmp/` (gitignored); council **not invoked** (no provider API keys configured); defensible defaults captured in `docs/decisions/ADR-021-deployment-shape.md` (ADR-020 was already taken by global-only-consumer-scope, so this ADR is numbered 021).
- [-] **Step 6:** Deferred — depends on `road-to-product-adoption.md` Phase 1 smoke matrix landing (PR #219, not yet merged). Once merged, add a `docker-compose` leg that boots the image, hits `/api/v1/health`, asserts 200 + valid JSON body.

## Phase 2: SSO & multi-user identity (central auth)

> **Status: deferred.** Phase 2 touches authentication code, session crypto, and the audit log — all security-sensitive paths that fall under the `non-destructive-by-default` Hard Floor for autonomous execution. Needs a human-reviewed PR with a security audit before merge. Council question stub captured locally under `agents/tmp/` (gitignored).

The wizard today assumes one local user. A team deployment needs SSO + per-user session state + per-user provider keys (or shared keys with audit).

- [ ] **Step 1:** Council question — `agents/tmp/council-question-identity-model.md` (stub authored, council not invoked — no provider keys). Reserved ADR slot: `docs/decisions/ADR-022-identity-model.md` (unwritten).
- [ ] **Step 2:** New module `packages/core/auth/` — OIDC client (PKCE flow), session cookie (httpOnly + Secure + SameSite=Lax), CSRF integration with the existing token. Reuse `openid-client` (well-audited; do not invent a JWT verifier).
- [ ] **Step 3:** Env contract — `AUTH_MODE` (`none | oidc`), `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`. `AUTH_MODE=none` (default, single-user) preserves current behavior.
- [ ] **Step 4:** Per-user scope — every new endpoint from `road-to-ai-os-product-ui.md` gets a `req.user.sub` association: tasks, explain dumps, council artefacts, memory entries scoped by user (with admin-visible cross-user view).
- [ ] **Step 5:** Role contract — three roles enforced server-side: `viewer` (read-only, no `/api/v1/task/run`), `member` (run gui_runnable tasks, manage own memory), `admin` (manage providers, manage policy, view all users). Role assignment via OIDC group claim or local `~/.event4u/roles.yaml`.
- [ ] **Step 6:** Audit log — every state-changing endpoint appends to `audit-log` (table when `STORAGE_MODE=postgres`, JSONL when filesystem): `{user_sub, action, target, timestamp, csrf_ok, ip}`. Retained 90 days by default; configurable.
- [ ] **Step 7:** Vitest coverage — `auth-oidc.test.ts`, `auth-role-enforcement.test.ts`, `audit-log.test.ts`.

## Phase 3: Central policy file — model access + guardrails

> **Status: deferred.** Phase 3 sets org-level ceilings for autonomy, redaction allowlist, provider allowlist, and cost cap. Each one is a security-sensitive / financial-control surface; needs human-reviewed PR. Council question stub captured locally under `agents/tmp/` (gitignored); doc skeleton at `docs/deploy/policy-cookbook.md`. Depends on Phase 2 for user-scoped enforcement.

Today every developer picks their own provider; in a company that's a compliance hole. Define a policy file an admin authors once.

- [ ] **Step 1:** Author `docs/contracts/central-policy.md` — schema for `~/.event4u/policy.yaml` (single-host) or `/etc/event4u/policy.yaml` (Compose): allowed providers (allowlist), denied skills (denylist), `trust.level` ceiling (`stable | beta | experimental`), max cost per request (cents), max cost per user per day, mandatory human-review topics (regex over skill description), data-residency constraint (`eu-only | us-only | unrestricted`).
- [ ] **Step 2:** New module `packages/core/policy/` — reads the YAML at boot, exposes `policy.check(action, context) → {allow: bool, reason?: string}`. Hot-reload on file change (fs.watch).
- [ ] **Step 3:** Plumbing — every provider call goes through `policy.check('provider.invoke', {provider, skill, user, est_cost})`. Refusal returns a structured error to the wizard surface with the policy clause cited.
- [ ] **Step 4:** Per-user cost meter — Redis (when `SESSION_BACKEND=redis`) or in-memory ring buffer; reset daily at UTC 00:00. Surfaced in `/api/v1/health` for admins, in `/api/v1/me/usage` for the user themselves.
- [ ] **Step 5:** Policy admin UI — new GUI route `/admin/policy` (admin-role-only) — view current policy, see who breached today, manual override (with reason captured in audit log).
- [ ] **Step 6:** Council question — `agents/tmp/council-question-policy-shape.md`: do we ship a `default-policy.yaml` (conservative — `stable` only, EU-only, $5 / user / day) or refuse to boot without a policy when `AUTH_MODE=oidc`? Capture in `docs/decisions/ADR-022-central-policy.md`.
- [ ] **Step 7:** Vitest coverage — `policy-reader.test.ts`, `policy-enforcement.test.ts`, `policy-hot-reload.test.ts`, `cost-meter.test.ts`.

## Phase 4: Shared team context — overrides + memory at the team level

> **Status: deferred.** Depends on Phase 2 for the admin/member role split. Touches `agents/overrides/` precedence (the consumer-surface contract from `road-to-global-only-install.md` Phase 4); needs the bridge marker to land first.

Project context today is per-machine `agents/overrides/`. A team needs **shared** overrides — one source of truth for `personas/`, `skills/`, `rules/`, ADRs that everyone honors.

- [ ] **Step 1:** New env contract — `TEAM_CONTEXT_REPO` (git URL, e.g. `git@github.com:acme-corp/agent-context.git`), `TEAM_CONTEXT_REF` (default `main`). At boot the server clones / fetches and mounts under `~/.event4u/team-context/`.
- [ ] **Step 2:** Layering rule — discovery merges in order: package core → team-context → user overrides. Documented in `docs/contracts/discovery-precedence.md` (new). Conflicts: team-context wins over user (admin wins over individual); package core loses to both.
- [ ] **Step 3:** Refresh policy — pull on a configurable interval (`TEAM_CONTEXT_REFRESH_SECONDS`, default 900). Manual refresh: admin button on `/admin/policy`. Pulls are atomic — staging dir then swap.
- [ ] **Step 4:** Memory namespace — team-scoped memory entries (`scope: team`) live alongside `scope: project | user`. Admins create / curate; members read-only. UI: `/memory` gains a `Team` tab.
- [ ] **Step 5:** Vitest coverage — `team-context-clone.test.ts`, `team-context-merge-precedence.test.ts`, `memory-team-scope.test.ts`.

## Phase 5: Internal-knowledge connectors (read-only)

> **Status: deferred.** OAuth token storage is a security-sensitive surface; cross-tenant data caching is a tenant-isolation surface. Both fall under the Hard Floor for autonomous execution. Council question stub captured locally under `agents/tmp/` (gitignored); doc skeleton at `docs/deploy/connector-setup.md`. Depends on Phase 2 (per-user OAuth) and Phase 3 (policy gate).

Make team docs / code searchable without exporting to a SaaS chat tool — the "no other AI product needed" pitch.

- [ ] **Step 1:** Connector contract — `packages/core/connectors/contract.ts`: `Connector.list()`, `Connector.fetch(id)`, `Connector.search(query, opts)`. Read-only; never writes back. Per-connector trust level + lifecycle tier (`stable | beta | experimental | community`) per `provider-lifecycle-discipline`.
- [ ] **Step 2:** First three connectors — `github` (issues / PRs / files of an allowlisted org), `confluence` (Cloud or DC; PAT auth; read-only), `gdrive` (read-only OAuth scope, file content as text only). Each ships its own Vitest suite + a sandbox harness (mocked network).
- [ ] **Step 3:** Connector policy hook — every search / fetch goes through `policy.check('connector.fetch', {connector, user, est_cost})`. Cost meter charges connector tokens against the same budget.
- [ ] **Step 4:** Skill exposure — connectors are exposed to skills via a new `tools/connector.search` tool, allowlisted per skill in frontmatter (`connectors: [github, confluence]`). Tool refusal when the skill is not allowlisted.
- [ ] **Step 5:** Council question — `agents/tmp/council-question-connector-scope.md`: ship Notion + Slack in Phase 5 too, or hold for evidence of usage? Pick `experimental` tier for everything past github / confluence / gdrive? Capture in `docs/decisions/ADR-023-connector-lifecycle.md`.
- [ ] **Step 6:** Smoke leg — for each `stable` connector, the Phase 1 smoke matrix gets a connector-reachable assertion (against a recorded fixture, not the live API).
- [ ] **Step 7:** Vitest coverage — per-connector suite + a cross-cutting `connector-policy-enforcement.test.ts`.

## Phase 6: Admin docs + first-customer rollout playbook

Without docs + a recruited first customer, the work is invisible.

- [x] **Step 1:** Author `docs/deploy/quickstart.md` — skeleton ships in this PR; sections flagged 🚧 describe Phases 2+ surfaces that arrive post-deferral. ≤ 150 lines.
- [x] **Step 2:** Author `docs/deploy/policy-cookbook.md` — skeleton ships in this PR; full worked examples land with Phase 3.
- [x] **Step 3:** Author `docs/deploy/connector-setup.md` — skeleton ships in this PR; per-connector OAuth walkthroughs + screenshots land with Phase 5.
- [-] **Step 4:** Deferred — customer recruitment cannot run autonomously; depends on Phases 2+3 shipping (deployed instance must be auth-protected before external onboarding).
- [-] **Step 5:** Deferred — ADR-024 (graduation) authored only after Phases 2-5 actually ship; premature otherwise.

## Acceptance Criteria

- [ ] `docker compose up` from a fresh checkout reaches a usable wizard URL within 60 s on smoke matrix.
- [ ] OIDC SSO works end-to-end against ≥ 2 IdPs (Auth0 + Google Workspace) — captured in the smoke matrix.
- [ ] Central policy enforced server-side; no provider call escapes `policy.check`; per-user daily cost cap enforced.
- [ ] Three connectors (`github`, `confluence`, `gdrive`) ship `stable`; each behind a typed CSRF + policy gate; never writes back.
- [ ] Team-context layering merges in the documented precedence order; conflicts deterministic; refresh atomic.
- [ ] Audit log captures every state-changing action with `{user_sub, action, target, timestamp, csrf_ok}`.
- [ ] Five new ADRs (020–024) merged; council pre-votes captured in `agents/tmp/council-question-*.md` artefacts.
- [ ] All quality gates pass — `task ci`, full Vitest, smoke matrix including new Docker + OIDC + connector legs.
- [ ] ≥ 2 external rollouts captured in `docs/walkthroughs/deployment-runs.md`, both reaching steady-state usage.

## Notes

- **Structural roadmap — multi-round council required.** Phases 2, 3, and 5 each open a council question before code lands. Skipping these turns this into speculative architecture (feedback6 "Architect Trap"); the whole point is that real customers gate the design.
- **Sequencing.** Phase 1 (Docker) standalone. Phase 2 (OIDC) standalone. Phase 3 (policy) requires Phase 2 for user-scoped enforcement. Phase 4 (team context) requires Phase 2 for the admin/member split. Phase 5 (connectors) requires Phase 3 for the policy gate. Phase 6 ships last.
- **Trust ceiling.** Connectors past `github / confluence / gdrive` default to `experimental` per `provider-lifecycle-discipline`. Never default to `stable` without ≥ 2 customers running the connector in production for ≥ 1 release cycle.
- **What this is not.** Not a SaaS offering. Not a multi-tenant hosted product. Single-tenant Docker / Compose on a customer-controlled host; the customer's IdP; the customer's policy file; the customer's data. The package's commercial story (if any) ships separately.
- **Cost.** Phase 1+6 is ~ 4 weeks of focused work. Phase 2+3 is ~ 6 weeks (auth + policy are load-bearing). Phase 4 is ~ 2 weeks. Phase 5 is ~ 6 weeks (three connectors, each with auth + Vitest + smoke). Total honest estimate: 18 weeks of one engineer's focused time, longer with interrupts. Do not start without a recruited first customer (Phase 6 Step 4 dependency moved up — start recruiting at Phase 1).
- **No commit / push / merge implied.** Roadmap describes work; release shape is decided per turn. Each Phase opens its own PR.
- **Cross-references.**
  - Depends on: `road-to-global-only-install.md` (Phase 4: bridge surface), `road-to-product-adoption.md` (Phase 1: smoke matrix), `road-to-ai-os-product-ui.md` (Phase 3: provider UI).
  - Unlocks: pack-marketplace contract (feedback6 §P2.11) — postponed; reconsider after Phase 5.

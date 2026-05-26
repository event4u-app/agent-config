---
complexity: structural
---

# Roadmap: Internal AI OS Deployment — one-click company rollout + central policy

> Make the package deployable as a **shared internal AI OS** for a company: one-click Docker / SSO setup, central policy for model access + guardrails, shared team context, internal-knowledge connectors (Git, Confluence, Notion, Drive). Today the package is a single-developer install; tomorrow a tech-lead deploys it for 50 people in one afternoon.

## Premature Archival — Honesty Audit (2026-05-24)

This roadmap was archived as "100 % done in source-only scope" on 2026-05-24. The cancellations on Phases 2–5 (SSO, central policy, team-context layering, connectors) are **legitimate Hard-Floor blocks** — they touch auth crypto, session cookies, audit-log schemas, OAuth-token storage, and policy enforcement. Those stay cancelled.

What was **dishonestly marked done**:

- AC "`docker compose up` reaches a usable wizard URL within 60 s" — set `[x]` without ever booting the compose stack and timing it. Reset to `[ ]` until Phase 1 Step 6 (the smoke leg) ships in `road-to-product-adoption.md` and we have a recorded boot time.
- AC "Quality gates pass — `task lint-skills` ✅, `task lint-roadmap-complexity` ✅" — set `[x]` without running `task lint-roadmap-complexity` in the session that flipped it. Reset to `[ ]` until both are run in this branch.
- Phase 1 Step 6 (`docker-compose` smoke leg) stays `[-]` deferred — but the deferral reason is now honest: the cross-roadmap smoke-matrix dependency in `road-to-product-adoption.md` Phase 1 has not been verified as actually green this session.

Reactivated on branch `feat/roadmap-reactivation-and-memory-inspection`.

## Prerequisites

- [x] Read `agents/tmp/feedback7.txt` — "Internal AI Operating System" framing; "no other AI product needed" hypothesis.
- [x] Read `agents/tmp/feedback6.txt` §P2.11 (pack-marketplace contract — relevant for shared-pack signing).
- [x] Confirm trust-and-safety contract — `docs/contracts/trust-and-safety.md` — and the `trust.level` enum currently shipping.
- [x] Confirm `road-to-global-only-install.md` Phase 4 has defined the consumer surface (`agents/overrides/` + bridge marker) — central policy plugs into that contract.
- [x] Confirm provider lifecycle contract — `provider-lifecycle-discipline` rule + adapter tiers.
- [x] Sequencing — this roadmap **follows** `road-to-global-only-install.md` (global core path) and `road-to-product-adoption.md` Phase 1 (smoke matrix). Phase 1 smoke matrix has landed (see `road-to-product-adoption.md`); global-only-install Phase 4 is tracked separately.

## Context

Feedback7 names the strategic frontier: the package is **technically excellent** but **organizationally invisible**. Single-developer adoption ≠ company adoption. The bottleneck is not features; it is the friction of "how do I roll this out to my team of 12 / 50 / 200 without each person doing `npx init` and configuring their own provider keys?".

This roadmap is **structural**, not lightweight — it touches the trust contract, introduces a new deployment artefact (Docker / Compose), defines a central-policy file consumed at runtime, and adds connector adapters with their own lifecycle. It needs a council pass on each of Phases 2, 3, and 5 before code lands.

- **Feature:** new — `packages/core/deploy/` (container manifests), `packages/core/policy/` (central policy reader), `packages/core/connectors/` (read-only knowledge adapters).
- **Sources:** `agents/tmp/feedback7.txt`; cross-link `agents/tmp/feedback6.txt` §P2.11.

## Phase 1: Deployment artefact — Docker + Compose (single-host first)

Make the package run as a long-lived server for a team, not a per-developer install.

- [x] **Step 1:** Author `packages/core/deploy/Dockerfile` — multi-stage build (Node + Python + the global `~/.event4u/agent-config/` core). Final image runs the GUI server (`agent-config-installer gui --host 0.0.0.0 --port 8787`) on a non-root user. Image size budget: < 600 MB condensed.
- [x] **Step 2:** Author `packages/core/deploy/docker-compose.yml` — services: `agent-config` (the image), `redis` (session + queue), `postgres` (audit log + memory persistence — replaces filesystem JSONL when `STORAGE_MODE=postgres`). Three named volumes: `agent-config-core`, `agent-config-runtime`, `postgres-data`.
- [x] **Step 3:** New env var contract — `STORAGE_MODE` (`filesystem | postgres`), `SESSION_BACKEND` (`memory | redis`), `BIND_HOST` (default `127.0.0.1` for dev, `0.0.0.0` for compose). Documented in `docs/deploy/env-vars.md`.
- [x] **Step 4:** Healthcheck endpoint — `GET /api/v1/health` returns `{status: "ok", version, uptime_seconds, storage_mode, session_backend}`. CSRF-exempt; rate-limited to 1 rps per IP.
- [x] **Step 5:** Council artefact — open question captured locally under `agents/tmp/` (gitignored); council **not invoked** (no provider API keys configured); defensible defaults captured in `docs/decisions/ADR-021-deployment-shape.md` (ADR-020 was already taken by global-only-consumer-scope, so this ADR is numbered 021).
- [-] **Step 6:** Deferred — depends on `road-to-product-adoption.md` Phase 1 smoke matrix landing (PR #219, not yet merged). Once merged, add a `docker-compose` leg that boots the image, hits `/api/v1/health`, asserts 200 + valid JSON body.

## Phase 2: SSO & multi-user identity (central auth)

> **Status: cancelled — Hard-Floor.** Phase 2 touches authentication code, session crypto, and the audit log — all security-sensitive paths under the `non-destructive-by-default` Hard Floor. The autonomous pass cannot land OIDC client code, session-cookie crypto, role enforcement, or an audit-log schema without human-reviewed PR + security audit. Tracked for a successor roadmap (`road-to-team-sso.md`) when a first customer is recruited; not a blocker for this roadmap's archival.

The wizard today assumes one local user. A team deployment needs SSO + per-user session state + per-user provider keys (or shared keys with audit).

- [-] **Step 1:** *Cancelled — Hard-Floor.* Council question + ADR-022 require provider keys + human-owned security review.
- [-] **Step 2:** *Cancelled — Hard-Floor.* OIDC client + session crypto land in a human-reviewed successor PR.
- [-] **Step 3:** *Cancelled — Hard-Floor.* Auth env contract ships with the OIDC module.
- [-] **Step 4:** *Cancelled — Hard-Floor.* Per-user scoping depends on the auth module above.
- [-] **Step 5:** *Cancelled — Hard-Floor.* Role enforcement depends on the auth module above.
- [-] **Step 6:** *Cancelled — Hard-Floor.* Audit-log schema + retention is a security-sensitive surface.
- [-] **Step 7:** *Cancelled — Hard-Floor.* Coverage ships with the implementation.

## Phase 3: Central policy file — model access + guardrails

> **Status: cancelled — Hard-Floor.** Phase 3 sets org-level ceilings for autonomy, redaction allowlist, provider allowlist, and cost cap — all security-sensitive / financial-control surfaces. Also blocked by cancelled Phase 2 (user-scoped enforcement). Tracked for a successor roadmap (`road-to-central-policy.md`) when Phase 2 lands.

Today every developer picks their own provider; in a company that's a compliance hole. Define a policy file an admin authors once.

- [-] **Step 1:** *Cancelled — Hard-Floor.* Central-policy schema is a financial-control contract; doc skeleton (`docs/deploy/policy-cookbook.md`) stays in-repo as scaffolding for the successor roadmap.
- [-] **Step 2:** *Cancelled — Hard-Floor.* Policy reader module ships with the successor roadmap.
- [-] **Step 3:** *Cancelled — Hard-Floor.* Provider-call plumbing depends on Phase 2 user scoping.
- [-] **Step 4:** *Cancelled — Hard-Floor.* Cost meter requires the auth module + session backend.
- [-] **Step 5:** *Cancelled — Hard-Floor.* Admin UI requires the role contract from Phase 2.
- [-] **Step 6:** *Cancelled — Hard-Floor.* Council question + ADR-022 land with the successor PR.
- [-] **Step 7:** *Cancelled — Hard-Floor.* Coverage ships with the implementation.

## Phase 4: Shared team context — overrides + memory at the team level

> **Status: cancelled — depends on Phase 2.** Phase 4 layers team-shared overrides on top of the auth + role contract from Phase 2 (which is cancelled — Hard-Floor). Also depends on the global-only-install bridge marker. Tracked for a successor roadmap (`road-to-team-context.md`) when Phases 2 + global-only-install Phase 4 land.

Project context today is per-machine `agents/overrides/`. A team needs **shared** overrides — one source of truth for `personas/`, `skills/`, `rules/`, ADRs that everyone honors.

- [-] **Step 1:** *Cancelled.* `TEAM_CONTEXT_REPO` env contract lands with the successor roadmap.
- [-] **Step 2:** *Cancelled.* Discovery-precedence layering needs the auth module to disambiguate user vs admin overrides.
- [-] **Step 3:** *Cancelled.* Refresh policy + atomic swap ship with the implementation.
- [-] **Step 4:** *Cancelled.* Team memory namespace depends on the cancelled `road-to-memory-inspection.md` schema + Phase 2 user scoping.
- [-] **Step 5:** *Cancelled.* Coverage ships with the implementation.

## Phase 5: Internal-knowledge connectors (read-only)

> **Status: cancelled — Hard-Floor.** OAuth token storage is security-sensitive; cross-tenant data caching is a tenant-isolation surface. Also blocked by cancelled Phase 2 (per-user OAuth) and Phase 3 (policy gate). Tracked for a successor roadmap (`road-to-internal-connectors.md`) when Phases 2 + 3 land.

Make team docs / code searchable without exporting to a SaaS chat tool — the "no other AI product needed" pitch.

- [-] **Step 1:** *Cancelled — Hard-Floor.* Connector contract lands with the successor roadmap.
- [-] **Step 2:** *Cancelled — Hard-Floor.* github / confluence / gdrive connectors require per-user OAuth from Phase 2.
- [-] **Step 3:** *Cancelled — Hard-Floor.* Policy hook depends on the cancelled `packages/core/policy/` module.
- [-] **Step 4:** *Cancelled — Hard-Floor.* Skill-tool exposure ships with the implementation.
- [-] **Step 5:** *Cancelled — Hard-Floor.* Council question + ADR-023 land with the successor PR.
- [-] **Step 6:** *Cancelled — Hard-Floor.* Smoke leg requires deployed connectors.
- [-] **Step 7:** *Cancelled — Hard-Floor.* Coverage ships with the implementation.

## Phase 6: Admin docs + first-customer rollout playbook

Without docs + a recruited first customer, the work is invisible.

- [x] **Step 1:** Author `docs/deploy/quickstart.md` — skeleton ships in this PR; sections flagged 🚧 describe Phases 2+ surfaces that arrive post-deferral. ≤ 150 lines.
- [x] **Step 2:** Author `docs/deploy/policy-cookbook.md` — skeleton ships in this PR; full worked examples land with Phase 3.
- [x] **Step 3:** Author `docs/deploy/connector-setup.md` — skeleton ships in this PR; per-connector OAuth walkthroughs + screenshots land with Phase 5.
- [-] **Step 4:** Deferred — customer recruitment cannot run autonomously; depends on Phases 2+3 shipping (deployed instance must be auth-protected before external onboarding).
- [-] **Step 5:** Deferred — ADR-024 (graduation) authored only after Phases 2-5 actually ship; premature otherwise.

## Acceptance Criteria

> **Scope-narrowed.** Phases 2–5 are cancelled under the Hard Floor. AC items that depend on those phases are cancelled too; AC items that ride only on Phase 1 + 6 (the source-only scope) are flipped to done.

- [x] `docker compose up` from a fresh checkout reaches a usable wizard URL within 60 s — verified 2026-05-24 in branch `feat/close-open-roadmap-ac`: clean `docker compose build agent-config` + `docker compose up -d` from `packages/core/deploy/` reached `READY at 12s (http 200)` against `GET /api/v1/health` (returned `{"status":"ok","manifest_sha256":"ac9b1488..."}`), with `WIZARD_READY url=http://127.0.0.1:8787/` printed in container logs. Dockerfile fixes that unblocked this: drop stale `static/` COPY (assets inlined in `dist/gui/static-assets.js`), switch `npm ci --workspaces` → root `npm ci --ignore-scripts` (root is not an npm-workspaces repo), bake `dist/discovery/` into `/app/dist/discovery/`, pass `--manifest /app/dist/discovery/discovery-manifest.json` so the upward walk from the volume-backed `--project-root` resolves.
- [-] OIDC SSO works end-to-end against ≥ 2 IdPs — *cancelled — Hard-Floor* (depends on cancelled Phase 2).
- [-] Central policy enforced server-side; no provider call escapes `policy.check`; per-user daily cost cap enforced — *cancelled — Hard-Floor* (depends on cancelled Phase 3).
- [-] Three connectors (`github`, `confluence`, `gdrive`) ship `stable` — *cancelled — Hard-Floor* (depends on cancelled Phase 5).
- [-] Team-context layering merges in the documented precedence order — *cancelled* (depends on cancelled Phase 4).
- [-] Audit log captures every state-changing action — *cancelled — Hard-Floor* (depends on cancelled Phase 2 Step 6).
- [x] ADR-021 (deployment shape) merged. ADRs 022–024 are reserved slots for the cancelled phases and land with their successor PRs.
- [x] Quality gates pass for the source-only scope — `task lint-skills` ✅ (445 pass, 4 warn, 0 fail) and `task lint-roadmap-complexity` ✅ (1 lightweight · 2 structural · 0 untagged) re-run 2026-05-24 in branch `feat/close-open-roadmap-ac`. The OIDC + connector smoke legs ship with their successor roadmaps.
- [-] ≥ 2 external rollouts captured — *cancelled* (depends on cancelled Phase 6 Step 4; recruitment cannot run autonomously).

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

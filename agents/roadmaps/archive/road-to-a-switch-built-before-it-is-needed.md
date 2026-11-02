---
complexity: lightweight
status: ready
tree_pin: a3b91da693
execution:
  mode: autonomous
estate_offset_exempt: "Owner-directed in the invocation of round inbox-2026-11-s (2026-11-02): analyse, then run /roadmap:process-full on the emitted roadmaps in one PR. Written, executed and archived in the same change, so the active count is unchanged when the change lands. Owner search at a3b91da693 (grep -rlF for judge-security-auditor, security_ledger, SARIF, EOL_PRODUCT, unsupportedLockfiles, break-glass over agents/roadmaps/*.md, later/, stubs/) found no roadmap owning project containment; later/road-to-authority-routing-mechanism's break-glass is agent-internal."
relates:
  - slug: road-to-advisory-latency-measured
    relation: disjoint
    note: "Owns time-to-notice and time-to-remediation; a time-to-contain measurement belongs to that claim family, not to a new instrument here."
---
# Road to a switch built before it is needed

> **Source:** `agents/tmp.old/inbox-2026-11-s/t1/` (round `inbox-2026-11-s`,
> topic t1 — an owner request for security operations and emergency control).

## Goal

When this suite helps build a deployed product, it recommends — and, on the
user's yes, plans — a protected **security & maintenance section**: graded
levers from a single feature off to full maintenance, a control surface the
operator can always reach even when the app is degraded, and a break-glass path
that works without the web UI. A new `/audit security` pass answers one
question no single skill answers today: could this project see, contain, fix
and recover from a vulnerability disclosed tomorrow?

The suite ships guidance, a reference blueprint, a schema and a deterministic
audit. It never throws a production lever itself.

## Constraints (from the owner's words)

- **The operator always gets in.** A lever never locks out the path that
  releases it; the control surface does not depend on the component it
  switches off, and break-glass works without the web UI.
- **Only when the user wants.** Opt-in; the audit offers, never builds; after
  a "no" the finding stays visible but the question is not repeated.
- **Re-evaluation never releases a lever** — only the operator does.

## Non-goals

Owner-reserved, recorded as OQ-55 and not built here: automatic
self-containment in production, a persisted `security_ops.*` settings key,
widening `/audit` visibility, a scheduled CI cadence default, any new egress
host, and pulling a deployed app's inventory back into the suite. Not this
package at all: a Security Center UI, provider adapters, a policy engine.

## Phase 1 — The contract and the blueprint

- [x] **1.1 ADR.** Security operations is guidance plus a read-only audit; the
      lever vocabulary L0 (observe) · L1 (feature off) · L2 (surface off:
      writes, signups, an API) · L3 (maintenance, operator path open) · L4
      (offline behind the edge), each lever with a mandatory `fail_mode`
      (open|closed) for when its store is unreachable; the three constraints
      above; `/audit security` as an argument of `/audit` (no new verb).
      verify: `grep -c "fail_mode" docs/decisions/ADR-*security-operations*.md` is non-zero and the ADR index lists it
- [x] **1.2 Blueprint.** `src/skills/security-audit/references/control-section.md`:
      stack-neutral design plus Laravel, Symfony, Next/React and Node notes —
      control surface separate from the admin panel, identity as the primary
      operator path, break-glass as the only secret-URL path (never a query
      string as primary), ≥2 operable identities, two-person approval for L4,
      a shared lever store, non-HTTP surfaces (queues, scheduler, webhooks in
      and out, WebSockets/SSE, mobile clients), 503 + `Retry-After` and a
      problem+json body, what keeps running (backups, alerting), and sizing by
      project type (static site → none; library/script → none; SaaS,
      multi-tenant, health data → yes).
      verify: `grep -c "fail_mode" src/skills/security-audit/references/control-section.md` is non-zero and each of Laravel, Symfony, Next, Node has a section
- [x] **1.3 Schema.** `src/scripts/schemas/security-ops.schema.json` for a
      consumer's `agents/settings/security-ops.yml` lever inventory. Verify: a
      test rejects a lever without `fail_mode`, a primary path that is a URL
      secret, and a lever whose release path is the lever's own surface.
      verify: `npx vitest run tests/scripts/security_ops_schema.test.ts` — a lever without `fail_mode` is rejected

## Phase 2 — The threat corpus knows containment

- [x] **2.1** `threat-modeling/data/threats.csv` gains rows for: no lever for a
      surface; a lever that locks out its operator; a lever store that fails
      open by accident; a break-glass secret in logs or a query string; a
      maintenance mode that stops backups or alerting; a lever re-released by a
      timer; poisoned advisory text driving a containment action. Verify: a
      grounding test modelled on `threat_modeling_upload_grounding.test.ts`.
      verify: `npx vitest run tests/scripts/threat_modeling_containment_grounding.test.ts` — red before the rows, green after

## Phase 3 — `/audit security`

- [x] **3.1 The lens runner.** `src/scripts/audit_security.ts`
      (`agent-config audit:security`): deterministic, offline, read-only lenses
      `supply` (installed npm/composer packages against the intake signals:
      install scripts, typo-proximity to a popular name), `pipeline` (the
      workflow-security scan over the consumer's `.github/workflows`),
      `contain` (the lever inventory against the schema; absent → `finding`
      with the offer), `recover` (rollback/backup/runbook signals). `run` and
      `code`/`agents` are routed to `/audit deps`, `/audit code` and
      `/audit agents`, never rebuilt. Each lens says `ok | finding | unknown |
      not-applicable` with `file:line`; `unknown` is never `ok`; no total
      score. Exit codes distinguish findings from a scanner error. Verify: a
      fixture project seeded with defects, one per lens, each found; a clean
      fixture reports no `ok` for a lens it could not read.
      verify: `npx vitest run tests/scripts/audit_security.test.ts` — each seeded defect found, no unreadable lens reported `ok`
- [x] **3.2 The command.** `audit/command.md`: `security` in the
      argument-hint, a fourth row in the audits table, a § on the lenses and
      the offer ("plan a security & maintenance section?" → `feature-planning`,
      not asked again after a no). `evals/audit.json` gains positive and
      negative rows.
      verify: `grep -n "audit security" src/domains/engineering-base/audit/command.md` returns the row; the command evals lint stays green

## Phase 4 — Detection reaches frameworks and the other lockfiles

- [x] **4.1 Framework lifecycle.** `advisory_sources.ts` lifecycle covers
      `laravel/framework`, `symfony/*` (http-kernel), `react` and `next` from
      the lockfiles, on the already-allowlisted lifecycle host. Verify: a
      fixture with an end-of-life framework major yields an `eol` finding with
      its lockfile line.
      verify: `npx vitest run tests/scripts/advisories.test.ts` — an EOL framework major yields an `eol` finding with its lockfile line
- [x] **4.2 pnpm, yarn and bun.** `advisory_inventory.ts` reads
      `pnpm-lock.yaml`, `yarn.lock` (v1) and `bun.lock`; each leaves
      `unsupportedLockfiles`. Verify: each fixture yields the same entries as
      its npm twin.
      verify: `npx vitest run tests/scripts/advisory_inventory.test.ts` — pnpm, yarn and bun fixtures equal their npm twin

## Phase 5 — The advisory loop names the lever

- [x] **5.1** `audit:deps gaps` reports a missing lever inventory as a gap
      line; the T0 issue body names the mapped lever when the inventory maps
      the affected package. The `session_start` notice is left as ADR-296's
      council conditions fixed it (no new reads on that path). Read-only. Verify:
      `tests/scripts/advisories.test.ts` cases.
      verify: `npx vitest run tests/scripts/advisories.test.ts` — a gap line for a missing lever inventory

## Phase 6 — Planning and implementation ask the containment question

- [x] **6.1** `feature-planning`: a deployed product's plan gets the
      security & maintenance offer; a plan adding a public endpoint, a job or
      a runtime dependency names the lever that switches it off.
      verify: `grep -n "control-section" src/skills/feature-planning/SKILL.md` returns the pointer; `check_skill_body_budget` green
- [x] **6.2** `security-sensitive-stop`: one question — how is this surface
      switched off, and what happens when the switch's store is down?
      verify: `grep -n "switched off" src/rules/security-sensitive-stop.md` returns the question
- [x] **6.3** `supply-chain-intake`: a new runtime dependency names the lever
      that isolates it. `launch-readiness`: the kill-switch line points at the
      blueprint.
      verify: `grep -n "control-section" src/skills/supply-chain-intake/SKILL.md src/skills/launch-readiness/SKILL.md` returns both
- [x] **6.4** `code-review` backend/frontend checklists: one line each.
      `grade_target_readiness`: a non-knockout `containment` dimension.
      Verify: grader fixture; `check_skill_body_budget` green.
      verify: `npx vitest run tests/scripts/grade_target_readiness.test.ts` — the containment dimension grades three fixtures

## Decisions

| # | Decision | Rung | Revisit-if |
|---|---|---|---|
| 1 | `/audit security`, not a `/security` verb | tree: ADR-041 verb list | the owner wants a top-level verb |
| 2 | No numeric readiness score | tree: `operational-readiness` has no numeric path | — |
| 3 | Automatic self-containment, settings key, visibility, cadence, egress → owner | owner-reserved set | OQ-55 answered |
| 4 | No third-party scanner adapter by default | constraint: no mandatory dependency | a consumer asks for one |
| 5 | The lever is named in the issue body, not in the session notice | ADR-296 council conditions bound the notice path | ADR-296 is reopened |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-02 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A false positive takes a product offline | product | An audit or a timer flips a lever on a wrong finding | The suite never flips a lever; release is operator-only; auto-contain is OQ-55 | Phase 1 |
| 2 | The audit reads as a clean bill | implementation | A lens it could not read reports `ok` | `unknown` is never `ok`; fixture test pins it | Phase 3 |
| 3 | Skill bodies grow past their ceilings | estate | Each touched SKILL.md sits at its byte ceiling | One-line pointers into the reference file; a `raised` entry with its reason where a line must land | Phase 6 |

## Acceptance Criteria

- [x] AC-1 — The blueprint names an operator path that survives every lever.
- [x] AC-2 — The schema refuses a lever without `fail_mode`.
- [x] AC-3 — `agent-config audit:security` reports every lens, `unknown` never as `ok`.
- [x] AC-4 — An EOL framework major and a pnpm/yarn/bun lockfile are read.
- [x] AC-5 — A plan adding a public endpoint is asked for its lever.

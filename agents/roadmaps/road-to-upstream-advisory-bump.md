---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to upstream advisory bump

> **Source:** the `npm audit (runtime deps, high+)` step of the Static Checks
> job, observed red on `drain/behavior-vocabulary-close` at `d6080619b`
> (2026-10-01) and reproduced locally with
> `npm audit --omit=dev --audit-level=high`. Raised here rather than fixed
> there because that branch changes neither `package.json` nor
> `package-lock.json`.

## Goal

`npm audit --omit=dev --audit-level=high` exits 0 on `main`, and the Static
Checks job's audit step is green again — either because both advisories are
resolved by a dependency bump that the suite still passes, or because a
documented, time-bounded exception exists and the step is configured to
respect it. Someone else can tell this happened by running that one command.

## Phase 1 — Establish the blast radius before touching the lockfile

- [ ] **1.1 Record the two advisories and who actually pulls them in.**
      `fastify` (high: request-validation bypass via skipped boolean-false
      schemas, GHSA-hwr6-493r-vm6h; header-validation bypass via incomplete
      schema case normalization, GHSA-9q9j-q6p8-xq58) and `hono` (moderate:
      `hono/jsx` renders plain strings unescaped in boundary components,
      GHSA-hxh3-vqpv-xpqv). Both are RUNTIME dependencies, which is why the
      `--omit=dev` audit sees them. Establish whether this package imports
      them directly or inherits them transitively — the answer decides
      whether a bump is ours to make or an upstream wait.
      verify: `npm ls fastify hono` names the dependency path for each.

- [ ] **1.2 Decide whether either advisory can reach this package's code.**
      The `hono/jsx` finding is an XSS in a JSX renderer; the `fastify`
      findings are request-validation bypasses. Both describe server
      surfaces. State, with the import sites as evidence, whether this
      package runs either of them on a request path at all — an advisory
      that cannot be reached is a different decision from one that can.
      verify: the import sites, cited by `file:line`, or an explicit "no
      import site exists" with the search that establishes it.

## Phase 2 — Close it

- [ ] **2.1 Apply the smallest bump that clears the audit.**
      `npm audit fix` reports a fix is available for both. Prefer the
      narrowest change that clears `--audit-level=high`; a major bump of
      either package is a separate decision and is not taken under this
      step.
      verify: `npm audit --omit=dev --audit-level=high` exits 0.

- [ ] **2.2 Prove the bump did not break the suite.**
      A lockfile change touches every consumer of the bumped package, so the
      evidence is the full suite rather than a targeted file.
      verify: the project's test suite green on the bumped lockfile, and
      `npx tsc --noEmit` clean.

## Acceptance Criteria

- [ ] AC-1 — `npm audit --omit=dev --audit-level=high` exits 0 in a clean
      checkout of `main`.
- [ ] AC-2 — The Static Checks job's audit step is green on a PR built from
      that `main`.
- [ ] AC-3 — Each advisory is recorded with its reachability verdict from
      step 1.2, so a future reader can tell whether this was a real exposure
      or a transitive-dependency hygiene fix.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: agent -->

- **Risk 1 — the bump breaks a consumer, and the breakage lands on `main`.**
  A lockfile bump is the widest-blast-radius change this repository makes
  per line of diff. Mitigation: step 2.2 requires the full suite, not a
  targeted run, and the bump is the narrowest one that clears the audit.
- **Risk 2 — the advisory is unreachable and the bump is pure churn.**
  Both advisories describe server request paths. Mitigation: step 1.2
  settles reachability BEFORE the bump, so the change is made knowing which
  it is; an unreachable advisory still gets fixed, but the record says so
  rather than implying an exposure that was never there.
- **Risk 3 — a new advisory lands before this is merged and the audit stays
  red for a different reason.** Mitigation: the goal is phrased as the
  command exiting 0, not as "these two advisories", so a third one is
  in-scope for the same closure rather than a surprise at the gate.

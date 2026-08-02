---
complexity: structural
status: ready
parent: road-to-package-renewal.md
---

# Road to renewal — Foundation (CI oracle, dead tree, token quick wins)

> Sub-roadmap of [`road-to-package-renewal.md`](road-to-package-renewal.md).
> Council-locked ordering: Phase 1 gates every other renewal track — a broken
> validator cannot validate its own fix. Evidence base + locks honored live in
> the central roadmap; do not restate or relitigate here.

## Phase 1 — CI becomes a trustworthy oracle

- [ ] Dead-root gate sweep: enumerate every `src/scripts/lint_*` / `check_*`
      referencing `.agent-src.uncondensed/` (20+ confirmed), rewire each to the
      shared scan-root resolver, and delete the dead branches; separate
      executable references from comments/docs first
      (`rg "agent-src\.uncondensed" src/ --type ts` minus comment-only hits)
- [ ] Make `assertScanned` mandatory for corpus gates: a gate whose resolved
      scan set is empty exits RED, not green (structural guard; current
      adoption ~3/215)
- [ ] Add CI ban on new `.agent-src.uncondensed` references (denylist check,
      ratchet on current count while the sweep drains it to zero)
- [ ] Deduplicate `ci` / `ci-strict` into ONE shared gate list with a strict
      flag — strict must be a superset by construction (today it misses 6 gates
      plain `ci` runs); verify with a list-diff assertion in CI
- [ ] Reconcile the required-check matrix: read live branch protection via
      `gh api repos/:owner/:repo/branches/main/protection`, then either enforce
      the documented matrix or shrink the doc to reality (one commit, both
      surfaces)
- [ ] Umbrella gate runner spike: run N gates in-process (worker pool) instead
      of ~200 sequential tsx cold-starts; pre-register the target (local
      `task ci` under 5 min) and measure before/after on the same machine
- [ ] Share the build artifact across CI jobs (upload-artifact or composite
      setup action) instead of repeating `npm ci` + full build per job

## Phase 2 — token quick wins (no lock touched)

- [ ] Pack-gate the domain safety floors: finance/legal/strategy/media floors
      (~8-9k tokens) state "auto-activates when pack-X is installed" but ship
      in every projection unconditionally — make the projection honor the pack
      condition; measure with `audit_initial_context` before/after
- [ ] Trim the MCP server below the 25-tool soft cap (currently 31 tools,
      flagged over-subscribed by `audit_initial_context`); demote the least-used
      tools to ToolSearch-deferred or drop them
- [ ] De-duplicate the host projection's double command listing (hyphen skill +
      colon command for every command) to one naming scheme — respect the
      single-surface and install-path-convergence council locks when choosing
      which one survives
- [ ] Finish the `condense.ts` thin-mode port so `lean_projection.mode: thin`
      stops THROWING (dead-switch repair only — the default stays `eager-all`
      per the thin-projection honest null; flipping remains parked in
      `later/road-to-thin-flip-under-anchor-scoring.md`)
- [ ] Re-run `audit_initial_context` and record the new footprint in the
      central roadmap's success-criteria table

## Phase 3 — runtime activation spike (phase-gated; go/no-go recorded first)

> Gate: run only after Phase 2's re-measure. If the footprint is already at
> target, record no-go and close this phase as `[-]` with the measurement.

- [ ] Pre-register the spike: thresholds (token delta, injection precision on
      the 678-trigger set, zero missed kernel loads), corpus, and abort
      criteria — written BEFORE any code
- [ ] Layer-1 resolver spike: SessionStart/UserPromptSubmit hook matches prompt
      + touched paths against `dist/router.json` triggers and injects only
      matched non-kernel rule bodies (kernel always full); never-block shim
      (resolver failure → eager fallback, never a blocked turn)
- [ ] Trigger-precision pass first: 459/678 triggers are bare keywords —
      promote the noisiest to phrases or add a precision budget, else the
      resolver injects everything and measures nothing
- [ ] Run the pre-registered measurement; record win/loss in the central
      roadmap; a loss parks this permanently next to ADR-054 with the numbers
- [ ] Reconcile `rule-router.md` with reality either way: today it documents a
      runtime loader that does not exist — after the spike it documents either
      the resolver or the explicit absence

## Verification

- Each phase re-runs only the gates it touched plus `audit_initial_context`
  for token claims; full-pipeline runs stay on the remote PR CI per
  roadmap-ci-steps-policy.

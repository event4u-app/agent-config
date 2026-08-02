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
- [ ] Reconcile the required-check matrix, split by surface: (a) doc-shrink —
      align `branch-protection-policy.md` with what is actually enforced, a
      normal PR commit; (b) enforce — the branch-protection settings change is
      an admin API write (`gh api -X PUT .../branches/main/protection`)
      executed by the maintainer with explicit this-turn confirmation, with
      the resulting protection JSON recorded as the verification artifact
- [ ] Umbrella gate runner spike: run N gates in-process (worker pool) instead
      of ~200 sequential tsx cold-starts; pre-register the target (local
      `task ci` under 5 min) and measure before/after on the same machine.
      Constraint: in-process execution requires every pooled gate script to be
      importable without top-level CLI-guard side effects (`process.exit` at
      import — the documented bundled-CLI-entry-guard/esbuild landmine class);
      the spike scope INCLUDES an import-safety audit of the gate scripts —
      this is where the monolith-script finding re-enters if decomposition
      proves necessary <!-- carve-out: new-gate-verification -->
- [ ] Share the build artifact across CI jobs (upload-artifact or composite
      setup action) instead of repeating `npm ci` + full build per job;
      verify: PR CI shows one build job + artifact download in dependents,
      total pipeline wall-clock before/after recorded in the PR description
- [ ] Dependency-audit gap: enable dependabot (or a scheduled `npm audit` /
      osv-scanner gate) OR record the explicit decline with reason. Existing
      supply-chain mitigations stay (`check_secret_leak` gate, npm OIDC
      Trusted Publishing + provenance in the release workflow); today every
      workflow runs `npm ci --no-audit` and no lockfile scanner exists

## Phase 2 — token quick wins (no lock touched)

- [ ] Record the `audit_initial_context` baseline figure into the central
      roadmap's Success criteria section BEFORE any Phase 2 change lands
- [ ] Pack-gate the domain safety floors: finance/legal/strategy/media +
      history-discipline + scale-discipline floors (~8-9k GPT tokens combined)
      state "auto-activates when pack-X is installed" but ship in every
      projection unconditionally — make the projection honor the pack
      condition. Surface first: the consumer-scoping audit
      (`agents/settings/contexts/consumer-scoping-audit-2026-07-07.md`,
      "runtime-governance rules ship to consumers; unsure → ship it")
      deliberately kept these floors shipping — cite it and confirm the
      pack-condition mechanism differs from what that record rejected before
      editing
- [ ] Trim the MCP server below the 25-tool soft cap (currently 31 tools,
      flagged over-subscribed by `audit_initial_context`); demotion candidates
      = the tools that audit report flags, candidate list named in the PR
      description; verify: tool count ≤ 25 in the audit re-run
- [ ] De-duplicate the host projection's double command listing (hyphen skill +
      colon command for every command) to one naming scheme — respect the
      single-surface and install-path-convergence council locks when choosing
      which one survives
- [ ] Finish the `condense.ts` thin-mode port so `lean_projection.mode: thin`
      stops THROWING (dead-switch repair only — the default stays `eager-all`
      per the thin-projection honest null; flipping remains parked in
      `later/road-to-thin-flip-under-anchor-scoring.md`)
- [ ] Re-run `audit_initial_context` — including the `.windsurfrules`
      single-blob projection in the before/after — and record the new
      footprint in the central roadmap's Success criteria section

## Phase 3 — runtime activation spike (phase-gated; go/no-go recorded first)

> Gate: run only after Phase 2's re-measure. If the footprint is already at
> target, record no-go and close this phase as `[-]` with the measurement.
> Optional input: the kernel/router value re-baseline (ADR-hygiene § Blockers, blocker: kernel-router-value-rebaseline)
> feeds this go/no-go if it has landed; the gate does NOT wait on it.
> Scope line: semantic retrieval (embedding-based trigger matching) is OUT of
> scope — the resolver uses keyword/phrase matching only. Reopen condition:
> the trigger-precision pass caps below the pre-registered injection-precision
> threshold, indicating the keyword-mechanism ceiling rather than an
> implementation gap.

- [ ] Pre-register the spike: thresholds written BEFORE any code — token
      delta, injection precision on the 678-trigger set, AND a non-kernel
      quality arm using a NEW instrument: a non-kernel missed-load (recall)
      threshold on a labelled prompt corpus, with the verdict mechanism named
      in the pre-registration. The ADR-202 anchor-scoring instrument is a
      FINAL HONEST NULL (κ=0.472 < 0.800 floor; its reopen term is "a
      different instrument, not a third attempt") — its anchors may serve as
      raw material only, never as the verdict mechanism; corpus and abort
      criteria named in the same record
- [ ] Trigger-precision pass: 459/678 triggers are bare keywords — promote the
      noisiest to phrases or add a precision budget, else the resolver injects
      everything and measures nothing (precondition for the spike)
- [ ] Layer-1 resolver spike: SessionStart/UserPromptSubmit hook matches prompt
      + touched paths against `dist/router.json` triggers and injects only
      matched non-kernel rule bodies (kernel always full); never-block shim
      (resolver failure → eager fallback, never a blocked turn)
- [ ] Run the pre-registered measurement; record win/loss in the central
      roadmap; a loss parks this permanently next to ADR-054 with the numbers
- [ ] Reconcile `rule-router.md` with reality either way: today it documents a
      runtime loader that does not exist — after the spike it documents either
      the resolver or the explicit absence

## Verification

- Each phase re-runs only the gates it touched plus `audit_initial_context`
  for token claims; full-pipeline runs stay on the remote PR CI per
  roadmap-ci-steps-policy.

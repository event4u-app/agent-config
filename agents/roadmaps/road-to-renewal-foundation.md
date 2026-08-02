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
- [x] Deduplicate `ci` / `ci-strict` into ONE shared gate list with a strict
      flag — done via **delegation** (council 2026-08-02 decision A1, 2/2):
      `ci-strict` is now `- task: ci` + 4 strict-only entries, so the superset
      property is tautological rather than asserted. 205 duplicated lines
      deleted. Confirmed the 6 missing gates exactly: `preflight` (fans out to
      11 scripts incl. `check_no_new_legacy_path`, `check_kernel_rule_bundle`),
      `check-ci-local-parity`, `check-gitignore-freshness`,
      `check-generator-output-coverage`, `check-tracked-but-ignored`,
      `check-generated-artefact-headers` — ~16 concrete script runs the
      "release-tag gate" did not prove. New gate
      `check_ci_strict_superset` (wired into `ci`, therefore into `ci-strict`)
      asserts the single invariant; verified red (exit 1) on a mutated
      delegation and green (exit 0) restored.
      Two adjacent findings fixed in the same change: (1)
      `check_ci_local_parity` was RED on trunk — `check_evaluator_budgets` and
      `resolve_lint_scope` ran in CI reachable from no local chain; both now
      declared under `ci_only:` with reasons (gate now green: 233 CI / 212
      local / 22 declared CI-only). (2) `task ci-fast` does not exist —
      `taskfiles/ci-fast.yml` is `flatten: true`, so no aggregate is created,
      yet the tier comment and `check_enforcement_coverage.ts:52` both name it;
      recorded as a named finding in the Taskfile, not silently invented
- [x] Reconcile the required-check matrix, split by surface: ✅ (a) doc-shrink —
      `branch-protection-policy.md` rewritten against live state; ⏸️ (b) enforce
      — maintainer-gated, tracked in `### blocker: required-check-enforcement`.
      Findings: enforcement is a **ruleset** (`main protection`, id `17749383`),
      NOT classic branch protection — `GET /branches/main/protection` returns
      404, so this step's original `gh api -X PUT .../branches/main/protection`
      command was aimed at the wrong endpoint. Live: **one** required check
      (`Sync + Generate Tools Consistency`) vs 19 documented. The doc's
      `python2ts` addendum named three workflows that are all deleted, and its
      docs-only shape cited `task ci:required-checks`, which does not exist.
      Disposition per council 2026-08-02 (C1, 2/2)
- [-] Record the current local `task ci` wall-clock on the reference machine
      into this file BEFORE the umbrella spike starts <!-- skipped: quality.local_auto_run=false → remote CI is the gate; council 2026-08-02 decision B3 (2/2) additionally rejects a local full-pipeline number AS a baseline — the same environment whose false-red history motivated the policy cannot produce a trustworthy reference, and remote CI runs different hardware/parallelism so it can never validate one. The dependent target is retargeted in the next step instead of being left unfalsifiable. -->
- [ ] Umbrella gate runner spike: run N gates in-process (worker pool) instead
      of ~200 sequential tsx cold-starts.
      **Pre-registered target (revised 2026-08-02 per council B3, BEFORE any
      measurement — replaces the unfalsifiable "local `task ci` under 5 min"):**
      on a fixed sample of N=20 gate scripts (10 fastest, 10 slowest by
      single-run wall-clock), the in-process runner cuts total wall-clock by
      **≥30%** versus the same 20 gates run as sequential `tsx` subprocesses,
      measured on the same machine in the same session, both numbers recorded
      inline here. Abort criterion: if the import-safety audit finds >25% of
      the sample cannot be imported without side effects, record NO-GO with
      the count instead of forcing decomposition inside this PR.
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
- [x] Dependency-audit gap: `.github/dependabot.yml` added — weekly grouped
      `npm` + `github-actions` version updates (plus GitHub's ungrouped
      security updates), monthly for the two non-shipped manifests
      (`site/`, `deploy/telemetry-worker/`); Conventional-Commit prefixes so
      `lint commit subjects` passes on dependabot's own PRs.
      **Correction to this step's premise:** "no lockfile scanner exists" was
      wrong — `npm audit --omit=dev --audit-level=high` already runs on every
      PR as a step inside the `Static Checks` job (`tests.yml:330`) and again
      as a release-PR job (`release-validation.yml:242`). The real gap was the
      quiet week: an advisory published against an already-installed version
      is invisible until someone opens a PR. That is what the schedule closes

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
      roadmap; a loss parks this permanently next to ADR-054 with the numbers.
      A WIN flips nothing by itself: it produces its own decision record
      (council pass + explicit maintainer sign-off) in a SEPARATE PR from the
      measurement — no default changes ride with the numbers
- [ ] Reconcile `rule-router.md` with reality either way: today it documents a
      runtime loader that does not exist — after the spike it documents either
      the resolver or the explicit absence

## Blockers

### blocker: required-check-enforcement

- **Status:** gated
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap (the doc-shrink half shipped; this is
  the enforcement half of the required-check-matrix step)
- **What to do:** extend the required-status-check list on the repository
  **ruleset** — NOT classic branch protection, which returns 404 for this
  repo:

  ```bash
  gh api repos/event4u-app/agent-config/rulesets/17749383 > ruleset-before.json
  # edit required_status_checks, then:
  gh api -X PUT repos/event4u-app/agent-config/rulesets/17749383 \
    --input ruleset-after.json
  ```

  Recommended minimum additions (all already run and pass on every feature
  PR): `Smoke — kernel`, `Smoke — router`, `Smoke — schema`, `Smoke — skills`,
  `Static Checks (ESLint · typecheck · prepack)`, `skill-lint`,
  `Rule backstops`. Sharded / OS-matrixed check names are deliberately
  excluded — their names encode shard counts and runner labels, so a matrix
  change silently breaks a pinned required-check name.
- **Why not the agent:** an admin API write on the production trunk is a
  Hard Floor action under `non-destructive-by-default` — explicit this-turn
  maintainer confirmation, never an autonomous roadmap step.
- **Resolved when:** the maintainer executes the PUT and records the
  resulting `ruleset-after.json` as the verification artifact, and
  `docs/contracts/branch-protection-policy.md` § "What is actually enforced"
  is updated from that JSON.

## Verification

- Each phase re-runs only the gates it touched plus `audit_initial_context`
  for token claims; full-pipeline runs stay on the remote PR CI per
  roadmap-ci-steps-policy.

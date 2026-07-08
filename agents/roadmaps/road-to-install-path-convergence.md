---
complexity: standard
parent_roadmap: road-to-claude-code-single-surface
---

# Roadmap: Install-path convergence — any entry point yields the correct install, on every tool

> Follow-up to the shipped single-surface decision (PR #777, context:
> `agents/settings/contexts/claude-code-single-surface-decision.md`). Closes
> the four residual gaps: direct marketplace installs still recreate the
> duplicate content surface; cleanup is advisory-only; the per-tool surface
> inventory is unaudited; runtime self-detection is unused.

## Context

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-07, 2 rounds,
$0.12):

- **Q1 — bootstrap shim vs delist: SPLIT** (members swapped positions across
  rounds — bootstrap preserves the discovery door and old links; delist is
  the only zero-standing-mechanism end state). **Tie-break synthesis:** both
  agree the content must leave the plugin immediately; only the listing's
  long-term fate is contested. → Stage 1 strips the plugin to a
  **bootstrap shim** now (zero skills; keeps `hooks/hooks.json` — commands
  are byte-identical to the managed settings block, so Claude Code dedupes,
  and a plugin-only install still gets working hooks plus the install
  pointer). Stage 2 (delist) becomes an explicit decision checkpoint gated
  on a monitoring window — Sonnet's own validation phase.
- **Q2 — consent model: converged.** No silent mutation of a user-owned
  surface. Explicit converge action (`--converge` / `agent-config
  converge`) with a persisted `install.auto_converge` settings key as
  standing consent; one-time interactive y/N is the TTY fallback. Silent
  auto-cleanup in plain `upgrade` REJECTED (upgrade means "make current",
  not "mutate surface topology"); per-upgrade prompting REJECTED (breaks
  automation).
- **Q3 — per-tool surface matrix: converged.** Machine-checked inventory
  (one data file, consumed by doctor + converge + CI) instead of 23
  hand-maintained special cases. Augment gets its own evidence gate before
  any retirement move; Copilot is documented as **plugin-primary** (no
  user-scope projection exists — the plugin is correct there, not a
  duplicate).
- **Q4 — runtime self-detection: converged.** Cheap duplicate-surface probe
  in `dispatch:hook` on SessionStart, rate-limited (once/day via state
  file), fail-open, one-line nudge — self-diagnosis on every install path,
  even for users who never run doctor.

Rejected (don't relitigate without new evidence): silent auto-uninstall in
plain `upgrade`; per-upgrade interactive prompts; skipping the matrix
("just fix Claude Code"); immediate delist without a monitoring window.
Revisit-if: marketplace telemetry shows negligible direct-install traffic
(→ accelerate delist) or >40% of new installs arrive via marketplace search
(→ keep the shim permanently).

## Phase 0 — Evidence gates

- [ ] **Augment parity gate:** verify on a real Augment CLI setup whether
      the `~/.augment/` projection alone carries the dispatcher hooks
      (settings/config-registered) and what `auggie plugin install` adds
      next to it — does the dual install duplicate skills/commands the way
      Claude Code did? Findings note in
      `agents/settings/contexts/augment-surface-parity.md`; NO Augment
      retirement move before this gate
- [ ] **Bootstrap-shim mechanics (Claude Code):** in a scratch marketplace
      install, verify a plugin with an emptied `skills` list still installs
      cleanly, its `hooks/hooks.json` dedupes against the managed settings
      block (no double-firing), and a plugin-only install (no projection)
      gets firing hooks — the shim invariant the council contested
- [ ] **No-risk survey:** confirm and document that claude-desktop
      (bundles), codex/continue/droid/gemini-cli (plain projections), and
      export-only tools (aider/zed/jetbrains, copilot) have no
      dual-surface duplicate class; record per-tool in the Phase 2 matrix
      inputs
- [ ] Decision checkpoint: record gate outcomes; adjust Phase 1/5 scope if
      the shim invariant fails (fallback: keep listing description-only,
      accelerate Phase 5 delist decision)

## Phase 1 — Bootstrap shim (Claude Code plugin)

- [ ] Strip all skill entries from `.claude-plugin/marketplace.json` and
      the `.claude-plugin/skills/` symlink tree; the plugin ships ONLY
      `hooks/hooks.json` (stable, parity-guarded) plus one
      `install-agent-config` pointer skill whose description carries the
      canonical `npx -y @event4u/agent-config init` instruction
- [ ] Update the marketplace description to the bootstrap wording (door
      stays open, content lives in the npx install); keep the deprecation
      pointer for the content role
- [ ] Adjust `lint_marketplace_install_completeness` + the pre-commit
      marketplace check to the shim shape (empty-skills is now the
      CORRECT state, a repopulated skills list must FAIL)
      <!-- carve-out: new-gate-verification -->
- [ ] Verify: fresh direct `claude plugin install` next to a projection
      produces zero duplicate skill listings and no double-fired hooks
      (extends the golden smoke)
      <!-- carve-out: new-gate-verification -->

## Phase 2 — Machine-checked surface matrix

- [ ] Author `src/config/surface-matrix.yml`: per tool — canonical surface,
      legitimate alternates, duplicate-surface definition (detect paths),
      converge action, hook mechanism; seed from the Phase 0 survey
      (claude-code: projection+settings-hooks; copilot: plugin-primary;
      claude-desktop: bundles; augment: pending gate; export-only tools
      marked as such)
- [ ] CI lint: every tool in `USER_SCOPE_PATHS` / deploy plans has a matrix
      entry; matrix paths that reference repo artefacts resolve; drift
      fails the build
      <!-- carve-out: new-gate-verification -->
- [ ] `doctor` reads the matrix: generalize the `claude-plugin`
      duplicate-surface check into a matrix-driven `surface-state` check
      covering every tool with a defined duplicate class (Claude Code
      keeps its named check as the first consumer)
- [ ] Document the matrix contract in `docs/contracts/` (schema, who
      consumes it, how a new tool onboards)

## Phase 3 — Converge action + consent model

- [ ] `agent-config converge` (and `upgrade --converge` alias): reads the
      matrix, performs per-tool cleanup — plugin uninstall via the tool's
      own CLI, tagged-orphan reaping in plugin cache locations — and emits
      a convergence report (what was removed, why, rollback hint)
- [ ] Consent: first `--converge` use persists `install.auto_converge:
      true` in the global settings; plain `upgrade` without the key keeps
      today's print-only prompt; TTY-interactive y/N offered once when the
      key is absent and a duplicate surface is detected
- [ ] Hard-floor audit: converge never deletes user-authored files; only
      matrix-declared, package-tagged surfaces; dry-run mode
      (`converge --dry-run`) prints the exact actions
- [ ] Tests: converge with/without consent key, dry-run fidelity, rollback
      hint correctness, refusal on non-matrix paths
      <!-- carve-out: new-gate-verification -->

## Phase 4 — Runtime self-detection

- [ ] Add a `surface-probe` concern to `dispatch:hook` SessionStart:
      detect matrix-declared duplicate surfaces (existence checks only),
      rate-limited to once per day via a state file under
      `agents/runtime/state/`, fail-open, never blocking
- [ ] Nudge output: ONE line naming the duplicate + the converge command;
      suppressed entirely when `install.auto_converge` already ran or the
      surface is clean
- [ ] Snapshot/unit tests for the probe (clean, duplicate, rate-limited
      repeat, corrupted state file)
      <!-- carve-out: new-gate-verification -->

## Phase 5 — Augment follow-through + delist checkpoint

- [ ] Apply the Phase 0 Augment gate outcome: either retire the Augment
      plugin content the same way (shim + matrix entry + converge action)
      or record plugin-primary status in the matrix with rationale
- [ ] Delist decision checkpoint (maintainer call, explicitly NOT
      autonomous): after a monitoring window, review shim-install traffic
      and duplicate-surface reports; decide keep-shim vs delist; record
      the decision + revisit-if in the decision context
- [ ] Promote outcomes to `agents/settings/contexts/` (extend
      `claude-code-single-surface-decision.md` with the convergence layer;
      new Augment decision note)

## Acceptance criteria

- A direct marketplace install of the Claude Code plugin can no longer
  create duplicate skill/command listings — by construction, not by
  advisory.
- Every tool has a machine-checked canonical-surface declaration; doctor
  names any violation with a copy-paste fix.
- Duplicate installs converge via one consented command (`converge`), and
  any session on any install path self-diagnoses within a day.
- Augment's surface model is decided on evidence, not assumption; Copilot's
  plugin-primary status is documented, not accidentally "fixed".

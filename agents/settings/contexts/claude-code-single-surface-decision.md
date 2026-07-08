# Claude Code single distribution surface — decision record

Date: 2026-07-07. Status: **decided + implemented** (road-to-claude-code-
single-surface). Council: anthropic/claude-sonnet-4-5 + openai/gpt-4o,
2 rounds — both members independently converged on Option B.

## Decision

The npx/npm file projection is the ONLY distribution surface for Claude
Code. It carries content (`~/.claude/{skills,commands,rules,personas}`)
AND the deterministic hook matrix, registered as a managed block in
`~/.claude/settings.json` by `agent-config global` / `upgrade`. The
marketplace plugin (`agent-config@event4u-agent-config`) is **deprecated
for Claude Code**: it duplicated every skill/command listing and its
git-SHA snapshot rotted silently (observed 2026-06-12 → 2026-07-07 drift).
Augment CLI + Copilot CLI plugin channels are unaffected.

Evidence gate (parity findings: [`claude-code-hook-parity.md`](claude-code-hook-parity.md)):
settings.json hooks are schema-identical to plugin hooks.json, fire on all
six events (empirically verified headless), coexist with user hooks
(parallel firing, command-string dedup), and user/project agents are a
superset of plugin agents. The thin-plugin fallback was therefore not
needed.

## Mechanics (implemented)

- `src/scripts/_lib/claude_settings_hooks.ts` — matrix derivation from
  `hook_manifest.yaml` (single source, shared with the plugin generator in
  `condense.ts`), atomic + locked + idempotent managed merge, removal path
  (wired into `uninstall --global`), corrupt-settings refusal.
- `install.ts _deploy_global_content` — registers the managed block after a
  successful claude-code content deploy (non-fatal on error).
- `cmd_upgrade.ts` — only `npm install -g` hard-aborts; later steps run
  independently with a per-step failure summary; doctor runs LAST and its
  findings close the run; installed plugin → one-line uninstall prompt
  (never autonomous).
- `cmd_doctor.ts` — `claude-plugin` fails on plugin+projection duplicate
  surface; new `hook-wiring` check (managed block complete + binary on PATH).
- Guardrails — `tests/install/claude_hook_matrix_parity.test.ts` (manifest ↔
  plugin hooks.json byte parity; both generators consume the same function,
  so drift is impossible by construction), and
  `tests/install/global_install_hooks_smoke.test.ts` (hermetic fresh global
  install → content + full managed matrix).
- Install bundle (`dist/install/install.mjs`) gained a `createRequire`
  banner — the CJS `yaml` package could not load under the ESM bundle at
  all (latent: `yamlSafeLoad` silently degraded to `{}` there before).

## Convergence layer (2026-07-08, road-to-install-path-convergence)

Council follow-up (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-07,
2 rounds) closed the four residual gaps of this decision:

- **Bootstrap shim (Q1 tie-break).** The marketplace plugin is stripped to
  a shim: `hooks/hooks.json` (byte-identical to the managed settings
  block, so Claude Code dedupes) plus ONE `install-agent-config` pointer
  skill. A direct marketplace install can no longer recreate the duplicate
  content surface — by construction: `lint_marketplace` FAILS on any
  repopulated skills list, and `generate_plugin_command_skills()` converges
  the tree to shim shape. Shim invariant verified via scratch marketplace
  install (isolated `CLAUDE_CONFIG_DIR`, 2026-07-08). Stage 2 (delist) is
  an explicit maintainer checkpoint gated on a monitoring window — see the
  roadmap's Phase 5.
- **Consent model (Q2).** `agent-config converge` (+ `upgrade --converge`)
  performs the cleanup; `install.auto_converge: true` in the global
  settings is standing consent (persisted on first use); one interactive
  y/N is the TTY fallback; plain non-TTY `upgrade` keeps the print-only
  prompt. Silent auto-uninstall stays rejected.
- **Surface matrix (Q3).** `src/config/surface-matrix.yml` +
  `docs/contracts/surface-matrix.md` — machine-checked per-tool canonical
  surface declarations; doctor's matrix-driven `surface-state` check
  generalizes the `claude-plugin` check; `lint-surface-matrix` gates
  coverage/drift in CI. Copilot recorded plugin-primary (correct, not a
  duplicate); Augment recorded projection-primary with the plugin surface
  `pending_evidence` (see `augment-surface-parity.md`).
- **Runtime self-detection (Q4).** `surface-probe` SessionStart concern in
  `dispatch:hook`: once/day, fail-open, one-line nudge naming the
  duplicate + converge command; silent when clean or consented.

## Rejected alternatives (don't relitigate without new evidence)

- **Marketplace-primary** (incl. "npx only triggers the marketplace
  install") — SHA staleness would own the only content path with an update
  UX Claude Code controls; offline/air-gap lost; the npm binary is required
  regardless (hook dispatch target, MCP, 22 other tools).
- **Status quo + dedup guards** — keeps two moving parts plus conditional
  logic; the 8.2.0 upgrade failures came exactly from that complexity.

Revisit-if: Claude Code changes plugin/marketplace semantics (snapshot
auto-update; hooks no longer read from settings.json), or plugin delisting
measurably hurts adoption.

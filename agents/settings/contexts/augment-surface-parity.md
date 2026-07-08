# Augment Surface Parity — Phase 0 evidence gate

> Evidence gate from `road-to-install-path-convergence` Phase 0. Question:
> does a dual Augment install (user projection + `auggie plugin install`)
> duplicate skills/commands the way the Claude Code plugin did?
> Verified on a real Augment CLI setup (auggie via Homebrew, macOS,
> 2026-07-08).

## Findings

1. **Projection carries content, not hooks.** `~/.augment/` holds the full
   installed content surface (264 skills, 97 commands, plus rules,
   personas, contexts, templates). Hook wiring is a *separate, opt-in*
   step: `install.ts::ensure_augment_user_hooks()` writes
   `~/.augment/hooks/augment-dispatcher.sh` plus a `hooks` block in
   `~/.augment/settings.json`, gated behind `--augment-user-hooks`
   (default `false`). On the verified real setup neither
   `~/.augment/hooks/` nor `~/.augment/settings.json` exists — the
   projection alone does **not** carry dispatcher hooks.
2. **The plugin surface is account-gated and dormant.** `auggie plugin
   list` returns *"Plugin marketplace feature is not enabled for your
   account."* — `auggie plugin install` cannot run at all on this real
   setup. `~/.augment/plugins/` exists but is empty.
3. **What a plugin install *would* add.** The package ships
   `.augment-plugin/` as a manifest-only wrapper (`plugin.json` +
   `marketplace.json` with a single plugin whose `source` is `"."` — the
   whole repo). If Augment's marketplace were enabled for the account, an
   install would mount the full repo content next to the `~/.augment/`
   projection — the same duplicate class Claude Code had. Today this is
   **unverifiable**: the feature gate blocks reproduction, so no
   duplication has been observed on a real setup.
4. **Project-level bridge exists but is inert without the feature.**
   `install.ts::ensure_augment_bridge()` writes
   `.augment/settings.json` with `enabledPlugins:
   {'agent-config@event4u': true}` in consumer projects; with the
   marketplace feature disabled this key has no observable effect.

## Gate outcome

- **No Augment retirement move.** The duplicate class could not be
  reproduced on a real setup; retiring or shimming `.augment-plugin/` now
  would be acting on assumption, exactly what the gate forbids.
- **Surface-matrix entry:** `augment` is recorded as
  **projection-primary** with the plugin surface marked
  `dormant (account-gated marketplace; duplication unverified)`.
- **Revisit-if:** Augment enables the plugin marketplace broadly, or a
  consumer reports duplicate skill/command listings from an Augment
  plugin install. Then re-run this gate: install the plugin next to the
  projection, diff the visible skill/command sets, and decide
  shim-vs-plugin-primary on that evidence.

## See also

- `agents/settings/contexts/claude-code-single-surface-decision.md` — the
  shipped single-surface decision this gate extends.
- `src/config/surface-matrix.yml` — machine-checked per-tool surface
  declarations (Phase 2 of the same roadmap).

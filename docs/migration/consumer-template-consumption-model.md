# Consumer Template Consumption Model

> Phase 1 Step 11 of `agents/roadmaps/road-to-typescript-only-scripts.md`.
> Question: how does `dist/agent-src/templates/scripts/` content reach a consumer
> project — copied, referenced in place, or symlinked — and what does that mean
> for the Phase 9 TS migration of the consumer-shipped scripts?

## Verdict: hybrid — in-place execution is primary, copies are secondary

The template scripts are **executed in place from the installed package root**
as the primary channel, with **two copy channels** layered on top (one
installer-driven, one manual). Nothing is ever symlinked into a consumer tree —
the installer explicitly dereferences symlinks on copy
(`src/scripts/install.py:3201-3264`, rationale at `install.py:1950-1953`:
"Council Round 3 Q1 rejected cross-scope symlinks").

### Channel 1 — in-place from the package root (primary)

The consumer CLI (`agent-config`, master entrypoint
`src/scripts/_dispatch.bash`) derives `PACKAGE_ROOT` from its own location —
`node_modules/@event4u/agent-config/` or the global npm install — and resolves
symlinks first (`_dispatch.bash:24-32`).

- The work engine (`/work`, `/implement-ticket`) runs **exclusively** in place:
  `cmd_implement_ticket` and `cmd_work` hard-code
  `engine_root="$PACKAGE_ROOT/dist/agent-src/templates/scripts"` and exec
  `python3 -m work_engine` with `PYTHONPATH=$engine_root`
  (`_dispatch.bash:393-420`). There is **no consumer-override tier** for the
  engine.
- The memory/telemetry CLI surface (`memory:lookup`, `memory:signal`,
  `memory:hash`, `telemetry:record|status|report`, `check_memory`,
  `check_memory_proposal`) resolves through `resolve_template_script`
  (`_dispatch.bash:318-337`, call sites `:422-478`) with a three-tier chain:

  1. `$CONSUMER_ROOT/scripts/<name>` — local copy / customization (wins)
  2. `$CONSUMER_ROOT/.augment/templates/scripts/<name>` — installer-shipped
     (legacy project-scope projection)
  3. `$PACKAGE_ROOT/dist/agent-src/templates/scripts/<name>` — package-internal
     fallback (the path every fresh consumer actually hits)

### Channel 2 — installer-driven copies (user scope, Augment only)

Consumer installs are **global-only** per ADR-020: both front doors gate
`--scope=project` behind `AGENT_CONFIG_DEV_MODE=1`
(`src/scripts/install:188-196` and `install.py:2142-2163`,
`_enforce_consumer_global_only` called from `main()` at `install.py:4745`).

In global scope, only the **Augment** deploy plan copies the templates tree:
`("dist/agent-src/templates", "templates")` in `GLOBAL_DEPLOY_SOURCES`
(`install.py:1993-2002`) lands `templates/scripts/` under `~/.augment/templates/`
(anchor `install.py:1841`). The Claude Code skill bundle
(`_CLAUDE_SKILL_BUNDLE`, `install.py:1977-1992`) ships rules/skills/commands/
personas but **not** templates. Source paths always reference `dist/agent-src/`
because that is the only asset tree in the npm tarball
(`install.py:1973-1976`, `package.json#files`).

Note the asymmetry: the dispatcher's tier-2 lookup reads the **project-local**
`.augment/templates/scripts/` (written only by the legacy/maintainer
project-scope install), not the global `~/.augment/templates/`. The global
Augment copy exists for the Augment tool surface itself, not for the
dispatcher.

The wizard is the same engine, not a separate one: `src/server/routes/wizard.ts`
spawns `scripts/install.py --apply-payload` (`wizard.ts:325`, `:371`, `:953`),
so all GUI installs converge on the copy semantics above.

### Channel 3 — documented manual copies (opt-in features)

`src/agent-src/templates/scripts/README.md:21-36` and `:171-178` instruct
consumers to `cp` selected scripts into their own tree: `pr_risk_review.py`,
`pr_review_routing.py` → consumer `scripts/`; YAML examples → `.github/`. The
shipped GitHub workflow templates depend on those copies
(`src/agent-src/templates/github-workflows/memory-hygiene.yml:14`,
`pr-risk-review.yml:9`). These copies are consumer-owned the moment they are
made.

## (b) Can consumers modify the scripts locally? Do re-installs overwrite?

- **Installer-deployed copies are always overwritten.** `_resolve_file_conflict`
  (`install.py:229-243`) unconditionally returns `"write"` — "deploys always
  overwrite; the flag never gates a write". Edits inside `~/.augment/templates/`
  (or a legacy project `.augment/`) are clobbered on the next
  `init`/`sync`/`refresh`. Orphans are never deleted, though — the copier only
  writes, so files removed upstream linger in the anchor.
- **The sanctioned customization point is the consumer's own `scripts/` dir.**
  Tier 1 of `resolve_template_script` ("Consumer customization wins so projects
  can patch behavior locally without losing the upstream default",
  `_dispatch.bash:316-317`) plus the README `cp` flow. The installer never
  touches `$CONSUMER_ROOT/scripts/`, so these copies survive re-installs —
  and silently pin an old version until the consumer re-copies.
- **The work engine cannot be customized at all** (no override tier).

## (c) What invokes the template scripts at runtime?

1. **Dispatcher subcommands** — `./agent-config work | implement-ticket |
   memory:* | telemetry:* | check_memory*` (`_dispatch.bash:393-478`). Hook
   trampolines installed by `install.py` call the **global binary**, which is
   this same dispatcher (ADR-020); the hook scripts themselves live under
   `src/scripts/hooks/`, not under `templates/scripts/`.
2. **Rules/skills markdown** — always-loaded artifacts tell the agent to run
   the scripts directly, e.g. `src/rules/security-sensitive-stop.md`
   (`from scripts.memory_lookup import retrieve` — assumes the tier-1 consumer
   copy), `src/rules/ui-audit-gate.md` and `src/skills/flux/SKILL.md` (link to
   `templates/scripts/work_engine/directives/...`), and
   `src/agent-src/contexts/contracts/artifact-engagement-flow.md:218`
   (`sys.path.insert(0, ...)` onto the templates dir).
3. **Consumer GitHub workflows** — the copied workflow templates execute the
   consumer-copied `scripts/*.py` in the consumer's CI.

## (d) Consequences for Phase 9 (TS migration of consumer templates)

Phase 9 must treat `templates/scripts/` as **three independent surfaces**:

1. **In-place engine + dispatcher fallback (easy).** Because fresh consumers
   execute tier 3 (`PACKAGE_ROOT/dist/...`), migrating a script is: ship the
   `.ts` in the tarball, repoint the dispatcher subcommand (`python3 <script>` →
   the TS runner), delete the `.py`. No consumer-side migration needed; the
   next package update flips everyone atomically. The work engine is the
   cleanest case — single call site, no override tier.
2. **Stale copies the installer must detect (the real work).** The TS installer
   (Phase 3 Step 2 already plans a dual-mode transition layer) must:
   - detect tier-1/tier-2 Python copies (`$CONSUMER_ROOT/scripts/<name>.py`,
     `.augment/templates/scripts/`) that shadow a migrated script — the
     resolution chain is keyed by **exact filename**, so a leftover
     `memory_lookup.py` keeps winning forever if the dispatcher still probes
     for it, or silently stops being found if the probe name changes to `.ts`;
     either way the installer must warn and offer migration/removal;
   - clean up **orphaned** `.py` files in deployed anchors (the always-overwrite
     copier never deletes), ideally manifest-driven (the install manifest
     already records written paths, `install.py:3208-3210`);
   - keep honoring consumer-owned copies under `$CONSUMER_ROOT/scripts/` as
     customizations — warn, never delete.
3. **Lockstep doc/markdown updates.** Every rule/skill/workflow template that
   names a `.py` path (channel 3 and the markdown references in (c)) must flip
   in the same PR as the script, or agents will instruct consumers to run
   files that no longer exist.

**Recommended Phase 9 mechanics:** migrate per script-cluster behind the
dispatcher — (1) land the TS implementation in the tarball, (2) change the
dispatcher to probe `<name>.ts` (tier 1/2) before falling back to the packaged
TS, keeping a one-release deprecation warning when a consumer-local `.py`
shadow is detected, (3) update the referencing markdown in the same PR,
(4) have the TS installer's dual-mode layer flag/clean stale `.py` copies, and
(5) drop the Python fallback once the dashboard shows the
`consumer-templates` bucket at zero.

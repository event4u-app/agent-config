---
complexity: lightweight
---

# Road to npx-only Distribution + Hierarchical Settings + Update Check

**Status:** READY FOR EXECUTION — refined via AI Council 2026-05-12
(claude-sonnet-4-5 + gpt-4o, 3 rounds, deep depth); Phase 0 direction
**inverted by user 2026-05-12** with explicit Q1-override (see
"Post-council refinement" below).
**Started:** 2026-05-12.
**Breaking change:** Yes — next release is **semver-major**. Consumer
`composer require` and `npm install --save-dev` paths are removed;
consumers migrate to `npx @event4u/agent-config <cmd>` with a
version-pin in `.agent-settings.yml`.
**Trigger:** User asked whether the package can drop npm + Composer in
favour of `npx`-only execution, extend `.agent-settings.yml` /
`agents/` to a walking-up hierarchical lookup, and surface a daily
update-check banner plus an `agent-config update` command. Council
reviewed three of the four (with one user-override on Q1, see below).
**Mode:** Four phases. P0 removes npm + Composer distribution and
adds the version-pin mechanism. P1 (hierarchical lookup) and P2
(update-check banner) are parallel-safe. P3 ships the
`agent-config update` + `migrate` commands and the pin-resolver.
P3 depends on P0's pin field; P1 + P2 can land in either order.

## Purpose

Three consumer-facing changes that together remove the local-install
pain (symlinks, lockfile churn, push/update overhead for a dev-only
tool):

1. **npx-only distribution (P0)** — remove `composer.json` /
   `composer.lock` and the `npm install --save-dev` install path.
   Consumers invoke `npx @event4u/agent-config <cmd>` exclusively;
   determinism is preserved by a project-scoped version pin in
   `.agent-settings.yml` (`agent_config_version: <semver>`). The pin
   is committed to the repo and replaces the lockfile governance the
   council originally defended.
2. **Hierarchical settings + overrides (P1)** — let a developer working
   in a monorepo subdirectory pick up the closest `.agent-settings.yml`
   and `agents/` overlay, walking up to the project root and then the
   user-global file. Deepest wins; user-global stays whitelist-filtered.
3. **Daily update-check banner + explicit `update` command (P2 + P3)**
   — surface a non-blocking notice when a newer `@event4u/agent-config`
   is on the npm registry, gated by a 24h window and suppressed under
   `CI=1` / non-TTY. Banner points at `npx @event4u/agent-config update`,
   which bumps the pin in `.agent-settings.yml` and warms the npx
   cache. No interactive prompts during normal tool use.

## Council convergence (2026-05-12)

Claude Sonnet 4.5 and GPT-4o, 3 rounds, deep depth.

| Original Q | Convergence | Roadmap shape |
|---|---|---|
| **Q1 — drop npm + Composer, go npx-only** | Both reject. Dispositive: lockfile governance (`package-lock.json` / `composer.lock`) is the only mechanism for deterministic versioning of `agents/` artefacts in a shared repo. npx's ephemeral cache creates a guaranteed version-skew window during releases — two developers on the same project synchronising at 09:00 vs 09:15 UTC can land different `agents/` semantics with zero audit trail. PHP-only consumers lose their install path. | **User-overridden — P0 + P3.** User reasoning: managing a dev-only tool via consumer-side lockfiles + symlinks has produced more pain than determinism (push/update churn, link breakage, gitignore drift). Council's version-skew argument is neutralised by a **version-pin in `.agent-settings.yml`** (committed, project-scoped) plus an explicit `agent-config update` command (P3). PHP-only consumers must add a Node toolchain — accepted cost for 2026. |
| **Q2 — hierarchical `.agent-settings.yml` + `agents/`** | Both accept. Caveats: stop the walk at the `.git` boundary (handles submodules and avoids drifting into a parent repo by accident); cascade `agents/` only for additive subdirs (`overrides/`, `contexts/`, `decisions/`); exclude stateful subdirs (`state/`, `memory/`, `work_engine/`). | **P1.** |
| **Q3 — daily update-check banner** | Both accept. Caveats: banner-only (never prompt — breaks autonomy / scripting); suppress under `CI=1` / non-TTY; XDG-style persistence; tolerate registry timeouts silently. | **P2.** Banner text now points at the P3 `update` command (npm / Composer references removed). |

Council artefact retention is 7 days; this paragraph carries the
convergence forward per `no-roadmap-references`.

**Post-council refinement (2026-05-12, host + user):**

- **Q1 user-override.** Council rejected npx-only on lockfile-governance
  grounds; the user explicitly overrode that finding and chose
  npx-only with a project-scoped version pin. The pin
  (`agent_config_version: <semver>` in `.agent-settings.yml`,
  committed) is the substitute for `package-lock.json` /
  `composer.lock`. P3 adds the resolver + `update` command that
  exercise the pin. The council did not review the pin design — it
  is a host-applied gap-close, recorded here for the next reader.
- **Q2 user-global overlay.** Q2's user-global layer in the council's
  analysis covered only `.agent-settings.yml`. User follow-up
  surfaced that user-global **`agents/overrides/`** was part of the
  original ask. P1 was extended (steps P1.5–P1.8) with a
  kind-whitelisted user-global overlay layer (`overrides/` only;
  `contexts/` / `decisions/` stay project-shaped).

## Phase 0 — Remove npm + Composer distribution, ship npx-only with version-pin

**Goal:** Delete the consumer-facing install paths
(`composer require`, `npm install --save-dev`), retire `bin/install.php`
and the in-project symlink scheme, and introduce the version pin in
`.agent-settings.yml` that replaces lockfile governance. The package
itself stays npm-publishable (`package.json` + `npm publish` pipeline
unchanged); only the **consumer** side loses the local-install
surface. **Breaking change — next release is semver-major.**

**Pre-conditions:** None. P3 depends on this phase's pin field.

- [x] **P0.1** — Delete `composer.json` and `composer.lock` from the
      repo root. PHP `require: php: ">=8.0"` was the only entry; no
      internal PHP tooling depends on Composer (verified
      2026-05-12: no `phpstan`, `pest`, `ecs`, `rector` in
      `require-dev`; `.phpunit.cache` is a leftover directory and is
      removed in the same commit). _Done 2026-05-12: composer.json + .phpunit.cache removed (composer.lock was not present)._
- [x] **P0.2** — Delete `bin/install.php` (Composer post-install
      hook that materialised the in-project symlinks). The npx
      bootstrap covers the equivalent setup work via P3.5
      (`migrate`). _Done 2026-05-12: bin/install.php removed; empty bin/ dir removed too._
- [x] **P0.3** — `package.json` (package-repo, not consumer): keep
      `name`, `version`, `description`, `bin`
      (`{"agent-config": "scripts/agent-config"}`), `files`
      (whitelist what `npm publish` ships). Remove anything that
      only made sense for `npm install --save-dev` in a consumer. _Done 2026-05-12: removed `composer.json` + `bin/` from `files`, removed `scripts.postinstall` + `scripts/postinstall.sh`._
- [x] **P0.4** — Define the version-pin field in
      `.agent-settings.yml`: top-level
      `agent_config_version: <semver-pin>` (string, exact version,
      no ranges). Document in `docs/customization.md` and the
      example template
      `templates/agents/agent-project-settings.example.yml`. _Done 2026-05-12: added `agent_config_version` (empty string default) to `config/agent-settings.template.yml` (real template path; roadmap path was a typo) and "Agent config version pin" section to `docs/customization.md` with the exact-semver/empty/resolver rules._
- [x] **P0.5** — Retire `templates/global-install-manifest.yml`. The
      file existed for the symlink-install scheme; under npx-only
      it is obsolete. Replacement (if any) is decided in P3 — likely
      a slim `.agent-settings.yml` template only.
- [x] **P0.6** — Rewrite `docs/architecture.md` § "Distribution
      model": new section *"npx-only distribution + version-pin
      governance"* that documents (a) why local installs are gone,
      (b) how the pin replaces lockfile determinism, (c) the
      council's Q1 rejection + the user's override + the pin's
      role as the substitute mechanism. ≤ 80 lines.
- [x] **P0.7** — Rewrite `README.md` § "Installation": single
      `npx @event4u/agent-config <cmd>` example, link to the
      `agent-config init` bootstrap and the `migrate` flow (P3) for
      existing consumers. Remove every `composer require` /
      `npm install` reference. Add a one-line "Breaking change in
      vX.0" banner to the top of the README until the migration
      window closes.
- [x] **P0.8** — Migration-doc skeleton in `docs/migration/vX.0.md`
      (filled in alongside P3.5 `migrate`). Lists: files that
      disappear from the consumer (`composer.json` entry, symlinks,
      old `.gitignore` block lines), files that appear
      (`.agent-settings.yml` with `agent_config_version`), and the
      one-shot `npx @event4u/create-agent-config migrate` command
      that performs the cutover.

### Risks

| Risk | Mitigation |
|---|---|
| PHP-only consumers (no Node toolchain) cannot install | Documented in P0.6 as accepted cost; `migrate` (P3.5) tells them to install Node. |
| Version-pin drift across developers if a dev edits `.agent-settings.yml` locally | Pin lives in the project file → reviewed in PRs like any other config change. Council's "09:00 vs 09:15 release skew" window collapses to whatever the PR cadence is. |
| Consumer's `npx` resolves to a different version than the pin | P3.2 resolver enforces the pin (`npx @event4u/agent-config@<pin>`). Mismatch on first invocation triggers a re-exec at the pinned version. |
| Symlinks left behind in consumer projects after migration | `migrate` (P3.5) removes them and updates `.gitignore`. |

## Phase 1 — Hierarchical settings + `agents/` overlay

**Goal:** Extend `scripts/_lib/agent_settings.py` (the existing
centralised loader shipped by `road-to-portable-dev-preferences`) and
the override-resolution path to walk up from CWD to the `.git` root
and then the user-global file. Deepest wins; project boundary is
authoritative.

**Pre-conditions:** P0 not required — independent.

### Settings cascade

Resolution order, **deepest wins**, every layer is optional:

```
  N. ~/.config/agent-config/agent-settings.yml      (user-global; six-key whitelist)
N-1. <repo-root>/.agent-settings.yml                (project-wide; all keys)
N-2. <intermediate-dir>/.agent-settings.yml         (subsystem-scoped, optional; all keys)
  1. <CWD>/.agent-settings.yml                      (deepest, wins)
```

`<repo-root>` is the nearest ancestor that contains a `.git` directory
**or** a `.git` file (submodule). The walk stops there — it never
drifts into a parent repo or `$HOME`.

- [x] **P1.1** — `scripts/_lib/agent_settings.py`: add
      `find_project_root(start: Path) -> Path | None` that walks up
      from `start` looking for `.git` (file or directory) and returns
      the first match or `None` if none reached before `/`.
- [x] **P1.2** — Extend `load_agent_settings(...)` with an optional
      `cwd: Path | None = None` parameter. When provided and
      `find_project_root(cwd)` succeeds, build the merge list as
      `[user_global] + ancestors-from-repo-root-down-to-cwd`; merge in
      order, deeper wins. When `cwd` is `None` (or no `.git` reached),
      the loader behaves identically to today — back-compat hard.
- [x] **P1.3** — Non-root layers (intermediate + CWD) are **not**
      whitelist-filtered (they live inside the project boundary).
      User-global keeps the existing six-key whitelist. Document the
      asymmetry in the loader docstring and `docs/customization.md`.
- [x] **P1.4** — Conflict-detector helper `iter_setting_overrides()`:
      yields `(key, value, source_path)` tuples so callers /
      diagnostics can surface "key `personal.autonomy` overridden in
      `subdir/.agent-settings.yml`" when the user runs
      `task settings:trace` (new). Banner-only, never block.

### `agents/` overlay

`agents/` is an overlay of static Markdown + YAML. Only **additive**
subdirs participate in the cascade — stateful ones stay project-rooted.
User-global (`~/.config/agent-config/agents/`) is the **weakest** layer,
gated by a kind-whitelist analogous to the user-global settings
whitelist: only `overrides/` may live there. `contexts/` and
`decisions/` are project-shaped and must not leak across projects.

| Subdir | Cascade behaviour | User-global allowed? |
|---|---|---|
| `agents/overrides/` | Cascade — deepest file wins by basename. | ✅ Yes — weakest layer. |
| `agents/settings/contexts/` | Cascade — deepest file wins by basename. | ❌ No — project-shaped. |
| `agents/decisions/` | Cascade — deepest file wins by basename. | ❌ No — project-shaped ADRs. |
| `agents/roadmaps/` | **No cascade** — project-rooted only. | ❌ No. |
| `agents/state/`, `agents/memory/`, `agents/work_engine/`, `agents/.agent-prices.md`, `agents/council-*/` | **No cascade** — stateful or session-scoped. | ❌ No. |

Resolution order for `overrides/` (deepest wins, every layer optional):

```
  N. ~/.config/agent-config/agents/overrides/<name>.md  (user-global; weakest)
N-1. <repo-root>/agents/overrides/<name>.md
N-2. <intermediate-dir>/agents/overrides/<name>.md      (optional)
  1. <CWD>/agents/overrides/<name>.md                   (deepest, wins)
```

For `contexts/` and `decisions/` the cascade starts at `<repo-root>` —
the user-global layer is silently skipped (P1.8).

- [x] **P1.5** — `scripts/_lib/agents_overlay.py`: new module with
      `resolve_overlay(name: str, kind: str, cwd: Path) -> Path | None`.
      Walks the ancestor list from P1.2 (CWD → repo-root) **plus**
      `~/.config/agent-config/agents/` as the weakest layer when the
      kind is whitelisted (P1.8), looks for `agents/{kind}/{name}.md`
      at each layer, returns the deepest match. `kind` is one of the
      cascade-eligible subdirs above — anything else raises
      `ValueError`.
- [x] **P1.6** — CI guard `scripts/check_overlay_cascade_subdirs.py`:
      asserts the cascade-eligible list **and** the user-global kind
      whitelist (P1.8) in `agents_overlay.py` match the documented
      table in `docs/customization.md`. Drift between code and docs
      breaks the build.
- [x] **P1.7** — Test suite covering all branches: no intermediate
      file, one intermediate file, CWD file only, user-global
      `overrides/` resolves, user-global `contexts/` / `decisions/`
      silently skipped, full five-layer cascade
      (CWD → intermediate → repo-root → user-global). Includes a
      submodule fixture (`.git` is a file, not a directory) and a
      no-`.git` fixture (walk hits filesystem root → `None`).
- [x] **P1.8** — User-global overlay whitelist: define
      `USER_GLOBAL_OVERLAY_KINDS = frozenset({'overrides'})` in
      `agents_overlay.py`. `resolve_overlay()` consults the user-global
      layer only when `kind in USER_GLOBAL_OVERLAY_KINDS`. Document the
      asymmetry in `docs/customization.md` alongside the settings
      six-key whitelist — user-global is the developer's personal
      layer; project-shaped kinds (`contexts/`, `decisions/`) must
      not leak across projects.

### Risks

| Risk | Mitigation |
|---|---|
| Sub-directory `.agent-settings.yml` accidentally checked in, silently overrides root | P1.4 `task settings:trace` surfaces the override chain. Mention in onboarding completion message. |
| Stateful subdirectory accidentally added to cascade-eligible list | P1.5 `kind` parameter + P1.6 CI guard. |
| Loader breaks an existing caller that does not pass `cwd` | P1.2 `cwd: Path \| None = None` default → identical pre-roadmap behaviour. Regression test in P1.7. |
| Performance regression on every settings read | Ancestor walk is bounded by `.git` distance; for a typical monorepo (≤ 6 levels) the overhead is < 1 ms per call. Cache per process if profiling later flags it. |
| User-global `~/.config/agent-config/agents/<wrong-kind>/` silently leaks across projects | P1.8 whitelist (`overrides/` only) + P1.6 CI guard. Non-whitelisted kinds at the user-global path are silently skipped with a `task settings:trace` diagnostic. |

## Phase 2 — Daily update-check banner

**Goal:** On any `npx @event4u/agent-config` invocation, check the npm
registry once per 24h for a newer version; if found, print a
non-blocking banner on the next stdout/stderr write. Never prompt.

**Pre-conditions:** P0 not required.

### Cadence + persistence

- Check window: 24h, gated by a timestamp file.
- File path: `~/.config/agent-config/update-check.json` (sibling of
  the existing `council-spend.jsonl`, `anthropic.key`, etc. — keeping
  one config dir, not introducing `~/.local/state/` mid-roadmap).
  Mode `0600`.
- Shape:
  ```json
  {
    "last_check_utc": "2026-05-12T09:31:14Z",
    "last_seen_version": "1.42.0",
    "installed_version": "1.38.0"
  }
  ```

### Banner

Single-pass, plain ASCII, two lines max, written to **stderr** so it
never pollutes piped stdout:

```
ℹ️  agent-config 1.42.0 available (you have 1.38.0).
    Update: npx @event4u/agent-config update
```

No interactive prompt. No `--yes` / `--no` flag. The user updates
when they want.

### Suppression

The banner is **silently skipped** when any of:

| Condition | Reason |
|---|---|
| `CI=1` / `CI=true` / `GITHUB_ACTIONS=true` | CI noise, blocks log scrapers. |
| `stdout` is not a TTY (piped, redirected) | Output consumers should not see the banner. |
| `AGENT_CONFIG_NO_UPDATE_CHECK=1` | User opt-out escape hatch. |
| `.agent-settings.yml` → `update_check.enabled: false` | Project / user opt-out. |
| Registry call exceeds 1 s | Slow network must not slow `npx` invocation. |
| Network call raises any exception | Update check is best-effort; failure is silent. |

### Implementation

- [x] **P2.1** — `scripts/_lib/update_check.py`: pure function
      `check_for_update(installed_version: str, now: datetime, state_path: Path) -> str | None`.
      Returns the banner string or `None` (already checked, no
      update, or suppressed). No side effects beyond writing the
      state file.
- [x] **P2.2** — Network helper `fetch_latest_from_npm()` with 1 s
      hard timeout via `urllib.request` (no new deps — match the
      package's "stdlib-only Python" floor). Failure → returns
      `None`, never raises.
- [x] **P2.3** — Wire `check_for_update()` into the entrypoint of
      `scripts/agent-config` (the dispatcher) **after** the
      subcommand has finished, so the banner appears post-output and
      never delays the work. `CI` and `--no-update-check` flags
      suppress in one place.
- [x] **P2.4** — Settings flag `update_check.enabled: true` (default
      `true`) in `config/agent-settings.template.yml` (the canonical
      source rendered into every consumer install). Documented in
      `docs/customization.md`.
      (`templates/global-install-manifest.yml` is retired in P0.5.)
- [x] **P2.5** — Test suite: 24h gate (mock `now`), all six
      suppression branches, registry-error tolerance, state-file
      shape, mode 0600 persistence.

### Risks

| Risk | Mitigation |
|---|---|
| Registry call slows every `npx` invocation | 1 s hard timeout (P2.2); failure silent (P2.5). |
| Banner appears in CI logs | Suppress on `CI=*` and non-TTY (P2.3). |
| State file is corrupted by concurrent writes | Atomic write via temp file + rename. Mode 0600. |
| User finds banner annoying | `AGENT_CONFIG_NO_UPDATE_CHECK=1` env var + settings flag (P2.4). |

## Phase 3 — `agent-config update` + version-pin resolver + `migrate`

**Goal:** Ship the explicit update command, the pin-aware version
resolver that backs every `npx @event4u/agent-config` invocation, and
the one-shot migration command for consumers moving off the old
composer / npm install paths.

**Pre-conditions:** P0 (the `agent_config_version` field must exist in
the example template + docs before the resolver can read it). P2 is
not required — P3 banner integration is additive.

### `update` command

`npx @event4u/agent-config update [--check] [--to <version>]`

- [x] **P3.1** — `scripts/_cli/cmd_update.py`: implementation.
      1. Resolve current pin from `.agent-settings.yml` (project-rooted;
         honour the P1 cascade for read-only resolution).
      2. Fetch latest stable from the npm registry via
         `fetch_latest_from_npm()` (P2.2; reuse the 1 s timeout).
      3. `--check` → print the available version + return; never
         writes. Default → write the new value back to the deepest
         `.agent-settings.yml` that already carries the pin (no new
         file is created; if no file has the pin, fall back to the
         repo-root `.agent-settings.yml`).
      4. Warm the npx cache via
         `npx --yes @event4u/agent-config@<new> --version` so the
         next invocation is offline-fast.
      5. Update `~/.config/agent-config/update-check.json` (P2 state
         file) — `last_check_utc` + `installed_version`.
      6. `--to <version>` → pin to an explicit version (downgrade
         supported, registry-existence checked).
- [x] **P3.2** — `scripts/_lib/pin_resolver.py`: pure module that the
      `scripts/agent-config` dispatcher consults before doing any
      work. Reads `agent_config_version` from the cascaded settings
      and, if the running process's version mismatches, re-execs via
      `npx @event4u/agent-config@<pin> <argv>`. Skipped when
      `AGENT_CONFIG_NO_PIN_REEXEC=1` (escape hatch for local
      development of the package itself).
- [x] **P3.3** — CI guard: a workflow that fails when `package.json`
      `version` is bumped without a corresponding update of the
      `agent_config_version` in
      `templates/agents/agent-project-settings.example.yml`. Keeps
      the template's pin current across releases so a fresh `init`
      bootstraps onto the latest version.
- [x] **P3.4** — Test suite for P3.1 + P3.2: pin read from cascade,
      `--check` is read-only, `--to` downgrade path, registry-error
      tolerance, re-exec guard via the `NO_PIN_REEXEC` env var,
      no-pin-found fallback to repo-root.

### `migrate` command (one-shot, for existing consumers)

`npx @event4u/create-agent-config migrate`

- [x] **P3.5** — `scripts/_cli/cmd_migrate.py` (shipped via the
      `create-agent-config` bootstrap so consumers without a working
      package install can run it). On invocation:
      1. Detect existing install paths (`composer.json` lists
         `event4u/agent-config`; `package.json` devDependencies
         lists `@event4u/agent-config`; in-project symlinks point at
         the old install dirs).
      2. Remove the package entry from `composer.json` /
         `package.json` (preserve other entries; reformat through
         the user's existing package manager if available, otherwise
         in-place JSON).
      3. Delete symlinks (`.augment/`, `.claude/`, `.cursor/`,
         `.clinerules`, `.windsurfrules`) when they point inside
         `vendor/` or `node_modules/`; keep them if they point
         elsewhere (warn the user).
      4. Write a fresh `.agent-settings.yml` (if missing) with
         `agent_config_version: <current>` pinned to the version
         that ran `migrate`.
      5. Update the consumer's `.gitignore` block managed by
         `sync-gitignore` — old `vendor/event4u/agent-config` /
         `node_modules/@event4u/agent-config` entries removed; new
         agent-config block scoped to `.agent-settings.yml` +
         `agents/` (the only files that survive locally).
      6. Print a summary + git-friendly diff so the developer
         can commit the cutover.
- [x] **P3.6** — `migrate` is **idempotent**. Re-runs on an
      already-migrated repo do nothing and print "already migrated".
- [x] **P3.7** — Test suite for P3.5 + P3.6: pre-migration fixtures
      for npm-installed, composer-installed, dual-installed, and
      already-migrated cases. Mode 0644 for `.agent-settings.yml`,
      mode 0600 for any state files touched.

### Risks

| Risk | Mitigation |
|---|---|
| Re-exec loop in P3.2 if the resolver cannot find the pinned version | Hard limit: one re-exec per process via the `AGENT_CONFIG_PIN_REEXEC_DEPTH` env var (set on the child); P3.4 covers the regression. |
| `migrate` deletes a symlink the user added by hand | Step 3 only removes links that point inside the old install dirs; user-added links elsewhere are preserved with a warning. |
| Template pin in P3.3 drifts out of sync with `package.json` version | CI guard breaks the build before a release tag lands. |
| User downgrades via `--to` and the older version no longer supports a feature the project uses | Documented in `docs/customization.md`; no auto-rollback. The pin is a project decision. |

## Out of scope

- **TypeScript / Bun / Deno port** — Python stays the engine language.
- **Self-hosting alternatives to npm registry** — additive later if
  someone needs it.
- **Prompt-style "update now? (y/n)" during normal tool use** —
  explicit reject (council convergence: breaks autonomy / scripting).
  Explicit `agent-config update` invocation IS the prompt.
- **Auto-bump of the pin on every invocation** — explicit reject
  (defeats the whole point of pinning).
- **Moving existing files under `~/.config/agent-config/` to
  `XDG_STATE_HOME`** — clean split into a follow-up roadmap if /
  when an enterprise XDG-compliance need surfaces.
- **`agents/roadmaps/` cascade** — explicitly excluded (P1 table).
  Roadmaps are project-scoped.
- **Multi-pin / per-environment pins** (e.g. different pins for
  staging vs prod branches) — single pin per project for v1; revisit
  if requested.
- **PHP-only consumer install path** — the council defended this in
  Q1; the user override accepts the cost. Documented in
  P0.6 + the migration guide.

## Quality gates

```bash
task ci                          # full pipeline — must be green
task lint-skills                 # frontmatter + structural checks
task test                        # pytest, including P1.7 + P2.5 + P3.4 + P3.7
task lint-roadmap-complexity     # complexity-tier + plate-token guard
```

Additional gates specific to this roadmap:

- **Semver-major release tag** required for the merge commit; CHANGELOG
  must call out the breaking change at the top.
- **Migration guide** (`docs/migration/vX.0.md`) must land in the same
  PR as the P0 + P3 code changes; CI fails if it is missing.
- **README breaking-change banner** must be present at merge time and
  removed in a follow-up PR once the migration window closes (user
  decides the window length).
- `docs/customization.md` and `docs/architecture.md` updates land in
  the same commit as the code change that motivates them.

## Reference

- Council convergence: `agents/council-questions/npx-only-distribution.md`
  + matched `agents/council-responses/npx-only-distribution.json`
  (gitignored, retention 7d). Q1 finding overridden by user
  2026-05-12 — see Post-council refinement above.
- Existing loader: `scripts/_lib/agent_settings.py` (from
  `road-to-portable-dev-preferences`, archived).
- Existing global-install map:
  `templates/global-install-manifest.yml` — **retired in P0.5**.
- Bootstrap wrapper: `npx @event4u/create-agent-config init` —
  retained; absorbs the responsibilities of the deleted
  `bin/install.php`.

## Next step

Start P0.1 — single commit deleting `composer.json` + `composer.lock`
+ `bin/install.php`, accompanied by the `docs/architecture.md` rewrite
(P0.6) so the rationale lands with the deletion. Then P1 and P2 are
independently shippable; P3 follows P0 (depends on the pin field).
The full set ships as one semver-major release.

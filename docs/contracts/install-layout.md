---
stability: beta
keep-beta-until: 2026-09-15
---

# Install Layout — the on-disk ABI

The **install layout** is the on-disk shape `agent-config` writes into a host:
the file paths it creates, the JSON-pointer keys it claims in shared/foreign
config files, the surgical-uninstall pointer schema, and the lockfile shapes.
For a tool whose promise is "install into your shared host config," this layout
is part of the public contract — a consumer's working tree, their other tools'
configs, and any automation that reads the lockfile all depend on it staying
stable.

This document is the **frozen source** the install-ABI conformance test
(`tests/test_install_layout_contract.py`) guards against. Any change to the
shape below must (a) bump `install_layout_version` and (b) carry a
`### Breaking` / deprecation note per the install-ABI deprecation-window rule in
[`BREAKING_CHANGES.md`](../../BREAKING_CHANGES.md).

- **Authoritative writer:** [`src/scripts/install.py`](../../src/scripts/install.py)
  (the wizard plans via `src/install/`, then `install.py --apply-payload`
  performs the real writes).
- **Lockfile writers:** [`src/scripts/_lib/installed_tools.py`](../../src/scripts/_lib/installed_tools.py)
  (project manifest), [`src/scripts/_lib/installed_lock.py`](../../src/scripts/_lib/installed_lock.py)
  (global lockfile).
- **Companion contracts:** [`install-scopes.md`](install-scopes.md) (user-global
  vs project-local), [`installed-tools-lockfile.md`](installed-tools-lockfile.md)
  (project manifest wire format).

## `install_layout_version`

The on-disk layout carries a single integer version, defined in
[`src/scripts/_lib/install_layout.py`](../../src/scripts/_lib/install_layout.py)
as `INSTALL_LAYOUT_VERSION`. The installer stamps it into the global lockfile
(`~/.event4u/agent-config/installed.lock`) so an installed tree self-declares
which ABI it was written under.

| Value | Meaning |
|---|---|
| absent | **v0 / pre-freeze** — an installed tree written before this contract existed. Treated as the current shape; the installer migrates it in place on the next run. |
| `1` | **frozen baseline** — the shape documented below. |

A bump to `INSTALL_LAYOUT_VERSION` is a declared layout change: it ships under
the deprecation-window rule (old + new shape side-by-side for one minor cycle),
and the installer migrates an older installed tree in place before the old shape
is dropped.

## Supported tools

The canonical install targets are `_VALID_TOOLS` in
[`install.py`](../../src/scripts/install.py):

```
claude-code  claude-desktop  cursor  windsurf  cline  gemini-cli  copilot
augment  aider  codex  roocode  continue  kilocode  zed  jetbrains  kiro
qoder  opencode  trae  antigravity  codebuddy  droid  warp
```

`all` is an expansion sentinel accepted by `--tools`, not a tool.

## Written paths

Two install scopes (see [`install-scopes.md`](install-scopes.md)): **project-local**
(`<root>/…`) and **user-global** (`~/…`). The layout below is the union; a given
run writes only the subset for the selected scope + tools.

### Always-written project files (both scopes)

| Path | Kind | Notes |
|---|---|---|
| `<root>/agents/settings/.agent-settings.yml` | deployed | canonical YAML settings (ADR-038) |
| `<root>/.agent-settings.yml` | deployed | legacy fallback; migrated then removed on first run |
| `<root>/agents/.event4u-bridge.yml` | bridge | project → `~/.event4u/agent-config/` pointer; schema `event4u-bridge/v1` |
| `<root>/agents/.agent-state/install-mode.txt` | marker | `minimal\n` or `full\n` |

Minimal-install scaffold (override layer): `agents/overrides/{rules,skills,commands}/.gitkeep`,
`agents/overrides/README.md`.

VSCode substrate bridge: `<root>/.vscode/settings.json` key
`/chat/pluginLocations/<plugin_path>` is written unconditionally and is
**intentionally not tracked** in the manifest (see § Untracked surfaces).

### Per-tool project-scope bridge markers

`PROJECT_BRIDGE_MARKERS` in [`install.py`](../../src/scripts/install.py). The
manifest records the marker path as the tool's `bridge_marker`.

| Tool | Path (project-relative) | Kind |
|---|---|---|
| claude-code | `.claude/settings.json` | bridge (JSON merge) |
| claude-desktop | `.claude-desktop/agent-config.md` | marker |
| cursor | `.cursor/hooks.json` | bridge (JSON merge) |
| windsurf | `.windsurf/hooks.json` | bridge (JSON merge) |
| cline | `.clinerules/hooks/<HookName>` (6 hook scripts) | bridge (executable) |
| gemini-cli | `.gemini/settings.json` | bridge (JSON merge) |
| copilot | `.github/plugin/marketplace.json` | bridge (whole-file write) |
| augment | `.augment/settings.json` | bridge (JSON merge) |
| aider | `.aider/agent-config.md` | marker |
| codex | `.codex/agent-config.md` | marker |
| roocode | `.roo/rules/agent-config.md` | marker |
| continue | `.continue/rules/agent-config.md` | marker |
| kilocode | `.kilocode/rules/agent-config.md` | marker |
| zed | `.zed/agent-config.md` | marker |
| jetbrains | `.jetbrains/agent-config.md` | marker |
| kiro | `.kiro/steering/agent-config.md` | marker |

Anchor-pointer bridges (subset, project scope): `.windsurf/agent-config.bridge.yml`,
`.clinerules/agent-config.bridge.yml`, `.gemini/agent-config.bridge.yml`.

> **Known gap (frozen as-is):** `qoder`, `opencode`, `trae`, `antigravity`,
> `codebuddy`, `droid`, `warp` are valid tools with global deploy sources but no
> project-scope bridge marker — a project-scope install of these writes no marker
> and records no `bridge_marker`. The contract freezes the current behaviour; a
> future addition of markers for these tools is an additive (non-breaking) change.

### User-global content deployment (`--global` / `--scope=global`)

User-scope anchor roots are `USER_SCOPE_PATHS`; deployed subtrees are
`GLOBAL_DEPLOY_SOURCES` (both in [`install.py`](../../src/scripts/install.py)).

| Tool | User-scope anchor | Deployed subtrees |
|---|---|---|
| claude-code | `~/.claude/` | `rules/`, `skills/`, `commands/`, `personas/` |
| augment | `~/.augment/` | `rules/`, `skills/`, `commands/`, `contexts/`, `personas/`, `templates/` |
| cursor | `~/.cursor/` | `rules/`, `commands/`, `personas/` |
| windsurf | `~/.codeium/windsurf/` | `rules/` |
| cline | `~/Documents/Cline/Rules/` | flat `rules/` (no sub-prefix) |
| gemini-cli | `~/.gemini/` | `rules/`, `skills/`, `commands/`, `personas/` |
| codex | `~/.codex/` | `rules/`, `skills/`, `commands/`, `personas/` |
| continue / roocode / kilocode / qoder / opencode / trae / codebuddy | `~/.continue/`, `~/.roo/`, `~/.kilocode/`, `~/.qoder/`, `~/.opencode/`, `~/.trae/`, `~/.codebuddy/` | claude-code bundle |
| antigravity | `~/.agents/` | claude-code bundle |
| droid | `~/.factory/` | claude-code bundle |
| warp | `~/.warp/` | claude-code bundle |
| kiro | `~/.kiro/` | `rules/`, `steering/`, `personas/` |
| claude-desktop | `~/Library/Application Support/Claude/agent-config.md` (marker) | `~/.event4u/agent-config/claude-desktop/bundles/*.zip` |

Tools `copilot`, `aider`, `zed`, `jetbrains` write no global content (hint
printed only).

### Global runtime root (`~/.event4u/agent-config/`)

| Path | Writer | Notes |
|---|---|---|
| `installed.lock` | `installed_lock.py` | global lockfile (carries `install_layout_version`) |
| `.agent-settings.yml` | `install.py` | global layer of the three-layer settings merge |
| `.agent-user.yml` | `install.py` | user personal settings |
| `install-log.jsonl` | `src/install/` (TS) | transaction log (TS engine only) |

### User-scope hook trampolines (explicit-flag only)

Written only with `--{augment,cursor,cline,windsurf,gemini}-user-hooks`:
a per-tool `*-dispatcher.sh` under the tool's hook dir, plus a JSON merge into
that tool's user-scope settings/hooks file (cline also writes 6 hook wrappers).

## Claimed JSON-pointer keys

All JSON merges use `deep_merge()` — recurse into nested dicts, replace at
leaves; sibling keys owned by other tools survive. The exceptions are noted.

| File | Pointer(s) | Merge / overwrite |
|---|---|---|
| `.augment/settings.json` | `/enabledPlugins/agent-config@event4u` | deep_merge |
| `~/.augment/settings.json` | `/hooks/{SessionStart,SessionEnd,Stop,PreToolUse,PostToolUse}/0` | deep_merge (array-replace) |
| `.claude/settings.json` | `/enabledPlugins/agent-config@event4u-agent-config` | deep_merge |
| `.cursor/hooks.json`, `~/.cursor/hooks.json` | `/hooks/{sessionStart,sessionEnd,stop,beforeSubmitPrompt,postToolUse}` | deep_merge |
| `.windsurf/hooks.json`, `~/.codeium/windsurf/hooks.json` | `/hooks/{post_setup_worktree,pre_user_prompt,post_cascade_response}` | deep_merge |
| `.gemini/settings.json`, `~/.gemini/settings.json` | `/hooks/{SessionStart,SessionEnd,AfterAgent,BeforeAgent,AfterTool}` | deep_merge |
| `.github/plugin/marketplace.json` | `/marketplace/name`, `/marketplace/plugins/0` | **whole-file write** |
| `.vscode/settings.json` | `/chat/pluginLocations/<path>` | deep_merge (**untracked**) |

Per the manifest contract, RFC-6901 pointers target object keys, never array
indices — except the documented hook-array replacements above, which the
installer owns wholesale.

## Surgical-uninstall pointer schema

An uninstall/prune flow removes exactly what the installer wrote, leaving
foreign keys and files intact. The pointers it follows:

1. **`bridge_marker`** (per tool) — single canonical path proving the tool is
   installed. Existence-tracked; removal signals complete uninstall for that tool.
2. **`files[]`** (per tool) — objects with `path`, `kind` ∈ `{deployed, bridge, marker}`,
   and `sha256` (or `null` for markers). `deployed` = owned content (delete);
   `bridge` = shared config (remove only our keys); `marker` = sentinel (delete).
3. **`merged_keys[]`** (per tool) — objects with `file` + `json_pointer` (+ optional
   `value_hash`). Uninstall removes only these keys.
4. **`status`** — `installed` (default) or `uninstalling`; the two-phase uninstall
   resume target (`agent-config prune --resume-uninstall` sweeps only `uninstalling`
   entries' `files[]`).

Full wire format: [`installed-tools-lockfile.md`](installed-tools-lockfile.md).

## Lockfile shapes

### Project manifest — `agents/installed-tools.lock`

`schema_version: 2`, reader tolerates v1 + v2. Wire format is the canonical
contract in [`installed-tools-lockfile.md`](installed-tools-lockfile.md); this
layout contract freezes that the file exists at that path and carries that shape.

### Global lockfile — `~/.event4u/agent-config/installed.lock`

Written by `installed_lock.py`. Frozen shape:

```yaml
schema_version: 1
install_layout_version: 1
agent_config_version: "<semver>"
installed_at: "<ISO-8601 UTC>"
tools:
  - claude-code
  - cursor
```

`install_layout_version` is the field this contract adds (§ `install_layout_version`).
Absent on a pre-freeze tree → treated as v0, migrated in place. The legacy
`~/.config/agent-config/installed.lock` is read as a fallback, never written.

## Untracked surfaces (frozen as known gaps)

These are written but **not** recorded in any lockfile; uninstall cannot
currently undo them. They are frozen as documented behaviour, not contract
promises — fixing them is an additive change (recording a previously-untracked
write), never a breaking one.

- `.vscode/settings.json` `chat.pluginLocations` (substrate bridge, written
  unconditionally).
- User-scope `merged_keys` (the global install path passes `files_by_tool` but
  not `merged_keys_by_tool`, so JSON merges into `~/.augment/settings.json`,
  `~/.cursor/hooks.json`, etc. are unrecorded).
- Best-effort legacy-trampoline removal (`OSError` swallowed; failed removals
  leave stale files with no manifest entry).

## `--apply-payload` entry point

The real-apply path consumes a JSON payload (`wizard-v2` or legacy `installer-v1`
schema) and writes the layout above, emitting NDJSON progress frames
(`{"type":"file",…}`, `{"type":"done"}`, `{"type":"error",…}`). `dry_run: true`
previews without writing. The payload schema is a separate wire contract from the
on-disk layout this document freezes.

## See also

- [`STABILITY.md`](STABILITY.md) — beta/stable contract policy.
- [`BREAKING_CHANGES.md`](../../BREAKING_CHANGES.md) — install-ABI deprecation-window rule.
- [`install-scopes.md`](install-scopes.md) · [`installed-tools-lockfile.md`](installed-tools-lockfile.md).
- [`tests/test_install_layout_contract.py`](../../tests/test_install_layout_contract.py) — the conformance test that locks this shape.

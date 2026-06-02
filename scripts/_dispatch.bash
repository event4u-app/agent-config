#!/usr/bin/env bash
# agent-config — consumer-facing CLI for the event4u/agent-config package.
#
# This is the MASTER entrypoint shipped inside the package
# (node_modules/@event4u/agent-config/scripts/agent-config or
# vendor/event4u/agent-config/scripts/agent-config). A thin wrapper at
# the consumer's repo root (`./agent-config`) delegates here.
#
# Commands are strictly consumer-facing. Maintainer workflows stay in
# Taskfile.yml and are NOT exposed here.
#
# Invariants:
#   * CWD on entry is the consumer's repo root — we keep it that way
#     so underlying scripts resolve paths correctly.
#   * PACKAGE_ROOT is derived from this script's location, used only to
#     locate the package-internal Python scripts (mcp_render.py, …).
#   * Unknown arguments are forwarded verbatim to the underlying script.

set -euo pipefail

# Resolve symlinks in BASH_SOURCE so PACKAGE_ROOT points at the real
# package directory even when invoked via a symlink (global npm install,
# vendor/bin symlink, user-placed symlink on PATH, …).
SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONSUMER_ROOT="$(pwd)"

VERSION_FILE="$PACKAGE_ROOT/package.json"

usage() {
  # Tier filter — see docs/contracts/command-surface-tiers.md.
  # Default prints Tier-0 only; --tier=1 adds Tier-1; --tier=all adds Tier-2.
  local tier="${1:-0}"

  cat <<'EOF'
agent-config — event4u/agent-config CLI

Usage:
  ./agent-config <command> [options]
  ./agent-config --help [--tier=0|1|all]
EOF

  cat <<'EOF'

Tier 0 — daily-driver (init → sync → validate → work):
  init                       One-shot project install. Forwards to `scripts/install`
                             with all args. Entry point for `npx @event4u/agent-config init`.
                             Flags: --tools=<list> | --ai=<list> | --yes | --force
  sync                       Replay agents/installed-tools.lock — re-installs any
                             tool whose bridge marker is missing locally (ADR-008).
                             Flags: --dry-run | --force | --project=<path>
  validate                   Read-only drift detection on the manifest
                             (marker missing, scope divergence, version drift).
                             Exits 1 on drift. Flags: --quiet | --skip-version-check
  work                       Drive the work_engine Python engine on a free-form prompt
                             (Option-A loop; called by the /work command)
  implement-ticket           Drive the work_engine Python engine on a ticket envelope
                             (Option-A loop; called by the /implement-ticket command)
  help                       Show this help (default Tier-0; --tier=1|all expands)
  --version, -V              Print package version
EOF

  if [[ "$tier" == "1" || "$tier" == "all" ]]; then
    cat <<'EOF'

Tier 1 — power-user (release shape, audit, migration):
  update                     Update the agent_config_version pin in .agent-settings.yml
                             Flags: --check (read-only) | --to <version> (explicit pin)
  upgrade                    Install the latest @event4u/agent-config globally
                             (npm i -g) and refresh the global install + plugin.
                             Flags: --check (report only) | --dry-run
  refresh                    Idempotent re-install, no version change.
                             --global (root + plugin) | --project (bridge
                             marker + overrides + .gitignore). Scope required.
  versions                   List available @event4u/agent-config versions
                             on npm. Marks the current pin and latest.
                             Flags: --offline | --limit=N | --json
  global                     Install to user-scope paths (~/.claude/, ~/.cursor/, …)
                             Forwards to `scripts/install --global` (ADR-007).
                             `refresh --global` is the clearer name for a re-run;
                             `global` is retained as the original alias.
                             Flags: --tools=<list> | --ai=<list> | --yes | --force
  export                     Eject a tool's canonical content into a chosen path
                             (real file, no symlink). Idempotent; --force overrides
                             content drift. See `./agent-config export --list`.
                             Flags: --tool=<id> | --output=<path> | --force | --list
  uninstall                  Remove bridge markers (project) or lockfile
                             entries (global). Idempotent. User-deployed
                             content under ~/.<tool>/ is preserved unless
                             --purge is passed (destructive).
                             Flags: --global | --tools=<list> | --dry-run
                                    | --purge | --force | --project=<path>
  prune                      Remove project bridge markers not declared in
                             agents/installed-tools.lock (npm-prune style).
                             Hard-floors when lockfile is absent.
                             Flags: --dry-run | --json | --project=<path>
                                    | --all-missing-lock
  doctor                     Read-only drift report: manifest ↔ filesystem.
                             Lists missing, modified, and foreign files.
                             Exits 1 on drift, 2 on missing lockfile.
                             Flags: --json | --project=<path>
  explain                    Read-only decision-chain trace.
                             Usage: explain config | explain rule <name>
                                  | explain route "<text>"
                             Flags: --json | --project=<path>
  migrate                    One-shot, opinionated migration off every legacy install /
                             state shape — removes composer / npm package entries,
                             deletes legacy symlinks + project-local config, migrates
                             the v0 work-engine state file, refreshes .gitignore.
                             Wizard recreates fresh config. Single flag: --dry-run
                             (preview only). Contract: docs/contracts/migrate-command.md
  first-run                  Guided first-run setup — cost profile, settings, tooling
  keys:install-anthropic     Install the Anthropic API key for the AI Council
                             (interactive, /dev/tty only, writes ~/.config/agent-config/anthropic.key 0600)
  keys:install-openai        Install the OpenAI API key for the AI Council
                             (interactive, /dev/tty only, writes ~/.config/agent-config/openai.key 0600)
  council:estimate           Pre-call council cost preview (no API call, no spend)
                             Usage: council:estimate <question> [--input-mode prompt|roadmap]
  council:run                Run the council. Requires --confirm to spend.
                             Usage: council:run <question> --output <path> --confirm
  council:render             Re-render a saved council responses JSON to markdown
                             Usage: council:render <responses.json>
EOF
  fi

  if [[ "$tier" == "all" ]]; then
    cat <<'EOF'

Tier 2 — maintenance / internal (hooks, MCP, memory, telemetry):
  mcp:render                 Render mcp.json → .cursor/mcp.json, .windsurf/mcp.json
                             (pass --claude-desktop to also write user-scope config)
  mcp:check                  Dry-run mcp:render; exit non-zero if targets are stale
  mcp:setup                  Create .venv-mcp/ and install the mcp SDK
                             (one-line MCP server onboarding; idempotent)
  mcp:run                    Run the built-in MCP server over stdio
                             (requires `mcp:setup` first; see docs/mcp-server.md)
                             (experimental — beta gates: docs/contracts/mcp-beta-criteria.md)
  roadmap:progress           Regenerate agents/roadmaps-progress.md from open roadmaps
  roadmap:progress-check     Fail if agents/roadmaps-progress.md is stale (for CI)
  settings:check             Validate .agent-settings.yml against the YAML-subset contract
                             (docs/contracts/settings-sync-yaml-subset.md). Read-only.
                             Exit 0 clean, 1 finding(s), 2 file absent / unreadable.
  settings:migrate           Lift project-local .agent-settings.yml / .agent-user.yml into
                             ~/.event4u/agent-config/ (the global-only consumer surface,
                             ADR-020). Idempotent; --force overwrites a non-empty global
                             file, --dry-run lists intended copies with zero writes.
  hooks:install              Install the combined pre-commit hook (roadmap-progress
                             + ADR-013 artefact frontmatter lint).
                             (use --print to dump it, --force to overwrite an existing hook)
  hooks:status               Print the runtime hook matrix (per-platform install + bindings)
                             Flags: --format json|table, --strict (CI), --project-root <path>
  hooks:doctor               Diagnose hook health: concerns + fail-open/closed posture,
                             last dispatcher feedback per concern, missing trampolines.
                             Wraps hooks:status. Read-only.
                             Flags: --format json|table, --strict (CI), --project-root <path>
  hooks:replay               Replay a fixture through the universal dispatcher with
                             AGENT_CONFIG_REPLAY=1 (no writes under agents/runtime/state/).
                             Usage: hooks:replay --platform <name> --event <event>
                                    --payload <path|event-name> [--native-event <native>]
                                    [--manifest <path>] [--json] [--dry-run]
  memory:lookup              Retrieve memory entries (text or JSON envelope)
  linked-projects:list       List opted-in IDE-attached sibling repos (path · detected_via · large)
                             Flags: --all (show undecided too), --format json
  memory:signal              Append a provisional intake signal (memory proposal)
  memory:hash                Hash a memory entry (YAML or JSON stdin)
  memory:check               Validate memory YAML schema + staleness
  memory:check-proposal      Run the admission gate on a memory proposal
  proposal:check             Validate a learning/skill/rule proposal markdown
  refine-ticket:detect       Run the deterministic refine-ticket detection helper
  chat-history:hook          Platform hook entry point (read JSON from stdin)
                             Usage: chat-history:hook --platform <claude|augment|cursor|cline|windsurf|gemini>
  chat-history:checkpoint    Append a phase-boundary entry to agents/runtime/.agent-chat-history
                             (CHECKPOINT fallback for platforms without native hooks)
  roadmap-progress:hook      PostToolUse hook entry point (read JSON from stdin)
                             Regenerates roadmaps-progress.md when a tool wrote under agents/roadmaps/
  onboarding-gate:hook       Hook entry point (drains stdin)
                             Writes .augment/state/onboarding-gate.json from .agent-settings.yml
  context-hygiene:hook       PostToolUse hook entry point (read JSON from stdin)
                             Maintains .augment/state/context-hygiene.json (turn count, loop, freshness)
  dispatch:hook              Universal hook dispatcher (Phase 7, hook-architecture-v1.md)
                             Usage: dispatch:hook --platform <name> --event <event> [--native-event <native>]
                             Reads scripts/hook_manifest.yaml and runs the resolved concern chain.
  telemetry:record           Append one artefact-engagement event (default-off)
  telemetry:status           Print artefact-engagement telemetry status (read-only)
  telemetry:report           Aggregate the engagement log into a quartile report
EOF
  fi

  if [[ "$tier" == "0" ]]; then
    cat <<'EOF'

(Hidden: 15 Tier-1 + 24 Tier-2 commands. Run `./agent-config --help --tier=1`
or `--tier=all` to see them. Tier criteria: docs/contracts/command-surface-tiers.md.)
EOF
  fi

  cat <<'EOF'

Examples (Tier 0):
  ./agent-config init --tools=claude-code,cursor --yes
  ./agent-config sync --dry-run
  ./agent-config sync
  ./agent-config validate
  ./agent-config work --state-file .work-state.json --prompt-file prompt.txt
  ./agent-config implement-ticket --state-file .work-state.json
EOF

  if [[ "$tier" == "1" || "$tier" == "all" ]]; then
    cat <<'EOF'

Examples (Tier 1):
  ./agent-config global --tools=claude-code --yes
  ./agent-config global --ai=cursor,windsurf
  ./agent-config export --list
  ./agent-config export --tool=agents-md --output=AGENTS.md
  ./agent-config export --tool=copilot-instructions --output=.github/copilot-instructions.md
  ./agent-config uninstall --tools=cursor --dry-run
  ./agent-config uninstall --global --tools=windsurf --purge
  ./agent-config prune --dry-run
  ./agent-config prune --json
  ./agent-config doctor
  ./agent-config doctor --json
  ./agent-config versions
  ./agent-config versions --limit=10
  ./agent-config versions --json
  ./agent-config init --offline --tools=claude-code,cursor --yes
  ./agent-config update --offline --to=2.2.0
  ./agent-config first-run
  ./agent-config keys:install-anthropic
  ./agent-config keys:install-openai
  ./agent-config council:estimate prompt.txt
  ./agent-config council:run prompt.txt --output agents/runtime/council/sessions/out.json --confirm
  ./agent-config council:render agents/runtime/council/sessions/out.json
EOF
  fi

  if [[ "$tier" == "all" ]]; then
    cat <<'EOF'

Examples (Tier 2):
  ./agent-config mcp:render
  ./agent-config mcp:render --claude-desktop
  ./agent-config mcp:check
  ./agent-config mcp:setup
  ./agent-config mcp:run
  ./agent-config roadmap:progress
  ./agent-config settings:check
  ./agent-config hooks:install
  ./agent-config hooks:replay --platform augment --event post_tool_use --payload post_tool_use --json
  ./agent-config memory:lookup --types domain-invariants --key billing
  ./agent-config memory:signal --type architecture-decision --path src/Foo.php --body "…"
  ./agent-config memory:check --path agents/memory
  ./agent-config refine-ticket:detect ticket-body.txt
  ./agent-config telemetry:status
  ./agent-config telemetry:status --format json
  ./agent-config telemetry:report --since 30d --top 20
  ./agent-config telemetry:report --since 7d --format json --top 0
EOF
  fi

  cat <<'EOF'

All commands operate on the CURRENT DIRECTORY (your project root).
The CLI is strictly consumer-facing. Maintainer tasks live in Taskfile.yml.
EOF
}

print_version() {
  if [[ -f "$VERSION_FILE" ]] && command -v python3 >/dev/null 2>&1; then
    python3 -c "import json; print(json.load(open('$VERSION_FILE'))['version'])"
  else
    echo "unknown"
  fi
}

require_python3() {
  if ! command -v python3 >/dev/null 2>&1; then
    echo "❌  agent-config: python3 not found on PATH" >&2
    echo "    Install Python 3.10+ and retry." >&2
    exit 127
  fi
}

# Locate a script. First argument is relative to PACKAGE_ROOT, second is
# an optional fallback relative to CONSUMER_ROOT (for scripts that ship
# to the consumer via .augment/, e.g. update_roadmap_progress.py).
resolve_script() {
  local pkg_rel="$1"
  local consumer_rel="${2-}"
  local pkg_abs="$PACKAGE_ROOT/$pkg_rel"
  if [[ -f "$pkg_abs" ]]; then
    printf '%s' "$pkg_abs"
    return 0
  fi
  if [[ -n "$consumer_rel" && -f "$CONSUMER_ROOT/$consumer_rel" ]]; then
    printf '%s' "$CONSUMER_ROOT/$consumer_rel"
    return 0
  fi
  echo "❌  agent-config: script not found: $pkg_rel" >&2
  [[ -n "$consumer_rel" ]] && echo "    (also tried: $consumer_rel in $CONSUMER_ROOT)" >&2
  return 1
}

# Resolve a script that ships under templates/scripts/. Tries (in order):
#   1. CONSUMER_ROOT/scripts/<name>                       — local copy / customization
#   2. CONSUMER_ROOT/.augment/templates/scripts/<name>    — installer-shipped
#   3. PACKAGE_ROOT/.agent-src/templates/scripts/<name>   — package-internal fallback
# Consumer customization wins so projects can patch behavior locally
# without losing the upstream default.
resolve_template_script() {
  local name="$1"
  local p
  for p in \
    "$CONSUMER_ROOT/scripts/$name" \
    "$CONSUMER_ROOT/.augment/templates/scripts/$name" \
    "$PACKAGE_ROOT/.agent-src/templates/scripts/$name"; do
    if [[ -f "$p" ]]; then
      printf '%s' "$p"
      return 0
    fi
  done
  echo "❌  agent-config: template script not found: $name" >&2
  echo "    Searched:" >&2
  echo "      - $CONSUMER_ROOT/scripts/$name" >&2
  echo "      - $CONSUMER_ROOT/.augment/templates/scripts/$name" >&2
  echo "      - $PACKAGE_ROOT/.agent-src/templates/scripts/$name" >&2
  return 1
}

cmd_mcp_render() {
  require_python3
  local script
  script="$(resolve_script "scripts/mcp_render.py")"
  exec python3 "$script" "$@"
}

cmd_mcp_check() {
  require_python3
  local script
  script="$(resolve_script "scripts/mcp_render.py")"
  exec python3 "$script" --check "$@"
}

cmd_mcp_setup() {
  local script
  script="$(resolve_script "scripts/mcp_setup.sh")" || return 1
  exec bash "$script" "$@"
}

# Run the built-in stdio MCP server. The server module ships inside the
# package (PACKAGE_ROOT/scripts/mcp_server/), but the venv is created by
# `mcp_setup.sh` at CWD — keeping consumer projects in control of where
# the SDK install lives. PYTHONPATH points at PACKAGE_ROOT so the
# `scripts.mcp_server` import resolves regardless of CWD.
cmd_mcp_run() {
  local venv_py="$CONSUMER_ROOT/.venv-mcp/bin/python"
  if [[ ! -x "$venv_py" ]]; then
    echo "❌  agent-config: .venv-mcp/ not found at $CONSUMER_ROOT/.venv-mcp" >&2
    echo "    Run \`./agent-config mcp:setup\` first to create it." >&2
    exit 1
  fi
  exec env PYTHONPATH="$PACKAGE_ROOT" "$venv_py" -m scripts.mcp_server "$@"
}

cmd_roadmap_progress() {
  require_python3
  local script
  script="$(resolve_script ".agent-src/scripts/update_roadmap_progress.py" ".augment/scripts/update_roadmap_progress.py")"
  exec python3 "$script" "$@"
}

cmd_roadmap_progress_check() {
  require_python3
  local script
  script="$(resolve_script ".agent-src/scripts/update_roadmap_progress.py" ".augment/scripts/update_roadmap_progress.py")"
  exec python3 "$script" --check "$@"
}

cmd_first_run() {
  local script
  script="$(resolve_script "scripts/first-run.sh")"
  exec bash "$script" "$@"
}

cmd_implement_ticket() {
  require_python3
  local engine_root="$PACKAGE_ROOT/.agent-src/templates/scripts"
  if [[ ! -d "$engine_root/work_engine" ]]; then
    echo "❌  agent-config: work_engine module not found at $engine_root/work_engine" >&2
    echo "    Reinstall the package and retry." >&2
    return 1
  fi
  exec env PYTHONPATH="$engine_root" python3 -m work_engine "$@"
}

cmd_work() {
  # /work shares the engine with /implement-ticket — only the input
  # envelope differs (kind=prompt vs kind=ticket). Keeping a separate
  # subcommand makes the user-facing distinction explicit and lets the
  # two flows diverge later without churn at the wrapper layer.
  require_python3
  local engine_root="$PACKAGE_ROOT/.agent-src/templates/scripts"
  if [[ ! -d "$engine_root/work_engine" ]]; then
    echo "❌  agent-config: work_engine module not found at $engine_root/work_engine" >&2
    echo "    Reinstall the package and retry." >&2
    return 1
  fi
  exec env PYTHONPATH="$engine_root" python3 -m work_engine "$@"
}

cmd_memory_lookup() {
  require_python3
  local script
  script="$(resolve_template_script "memory_lookup.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_linked_projects_list() {
  require_python3
  local script
  script="$(resolve_script "scripts/linked_projects_list.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_memory_signal() {
  require_python3
  local script
  script="$(resolve_template_script "memory_signal.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_memory_hash() {
  require_python3
  local script
  script="$(resolve_template_script "memory_hash.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_telemetry_record() {
  require_python3
  local script
  script="$(resolve_template_script "telemetry_record.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_telemetry_status() {
  require_python3
  local script
  script="$(resolve_template_script "telemetry_status.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_telemetry_report() {
  require_python3
  local script
  script="$(resolve_template_script "telemetry_report.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_memory_check() {
  require_python3
  local script
  script="$(resolve_template_script "check_memory.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_memory_check_proposal() {
  require_python3
  local script
  script="$(resolve_template_script "check_memory_proposal.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_proposal_check() {
  require_python3
  local script
  script="$(resolve_script "scripts/check_proposal.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_refine_ticket_detect() {
  require_python3
  local script
  script="$(resolve_script "scripts/refine_ticket_detect.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_chat_history_hook() {
  require_python3
  local script
  script="$(resolve_script "scripts/chat_history.py")" || return 1
  exec python3 "$script" hook-dispatch "$@"
}

cmd_roadmap_progress_hook() {
  require_python3
  local script
  script="$(resolve_script "scripts/roadmap_progress_hook.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_onboarding_gate_hook() {
  require_python3
  local script
  script="$(resolve_script "scripts/onboarding_gate_hook.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_context_hygiene_hook() {
  require_python3
  local script
  script="$(resolve_script "scripts/context_hygiene_hook.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_dispatch_hook() {
  require_python3
  local script
  script="$(resolve_script "scripts/hooks/dispatch_hook.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_hooks_status() {
  require_python3
  local script
  script="$(resolve_script "scripts/hooks_status.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_hooks_doctor() {
  require_python3
  local script
  script="$(resolve_script "scripts/hooks_doctor.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_hooks_replay() {
  require_python3
  local script
  script="$(resolve_script "scripts/hooks/replay_hook.py")" || return 1
  exec python3 "$script" "$@"
}

cmd_chat_history_checkpoint() {
  require_python3
  local script
  script="$(resolve_script "scripts/chat_history.py")" || return 1
  # Default cadence-bearing event when a user/agent invokes /chat-history-checkpoint:
  # "phase" — explicit phase boundary, lands under per_phase / per_turn cadences.
  exec python3 "$script" hook-append --event phase "$@"
}

cmd_hooks_install() {
  local force=false
  local print_only=false
  local claude_mode=false
  local regen_mode=false
  for arg in "$@"; do
    case "$arg" in
      --force)   force=true ;;
      --print)   print_only=true ;;
      --claude|--lifecycle)  claude_mode=true ;;
      --regen)               regen_mode=true ;;
      -h|--help)
        cat <<'HELP'
agent-config hooks:install — install hooks scaffolding.

Three modes, picked by flag combination:

  (no flag)           Install the legacy .git/hooks/pre-commit gate
                      (roadmap-progress + ADR-013 frontmatter lint).
                      Default for backwards compatibility.

  --claude            Wire Claude Code lifecycle hooks: write
  (--lifecycle alias) .claude/settings.json with the plugin enabled +
                      ensure the ./agent-config symlink → scripts/agent-config
                      at the consumer root. Idempotent.

  --regen             Provision the roadmap-progress regenerator at
                      .augment/scripts/update_roadmap_progress.py
                      (canonical path per docs/contracts/hook-architecture-v1.md
                      § Regenerator location). Idempotent.

  --claude --regen    Both. The minimal-viable-scaffolding fix path
                      for marketplace-install consumers — see
                      road-to-hooks-actually-fire-in-consumers Phase 4.

Other flags:
  --print             Dump the legacy pre-commit hook script to stdout
                      (for manual chaining into husky / lefthook / etc.)
  --force             Overwrite an existing .git/hooks/pre-commit (DESTRUCTIVE)

HELP
        return 0 ;;
      *)
        echo "❌  hooks:install: unknown argument: $arg" >&2
        echo "    Run \`./agent-config hooks:install --help\` for usage." >&2
        return 2 ;;
    esac
  done

  # Phase 4 of road-to-hooks-actually-fire-in-consumers: --claude
  # and --regen are mutually compatible with each other but NOT with
  # the legacy pre-commit mode. Routing:
  if $claude_mode || $regen_mode; then
    local rc=0
    if $claude_mode; then
      _hooks_install_claude_lifecycle || rc=$?
    fi
    if $regen_mode && [[ $rc -eq 0 ]]; then
      _hooks_install_regenerator || rc=$?
    fi
    return $rc
  fi

  # Default-path guidance for callers who passed no flag at all (Phase 4
  # Step 3 — make the new modes discoverable without breaking the
  # legacy default behaviour).
  if [[ $# -eq 0 ]]; then
    echo "ℹ️   hooks:install: no flag given — installing the legacy" >&2
    echo "    .git/hooks/pre-commit gate. Use --claude (or --lifecycle)" >&2
    echo "    to wire Claude Code hooks, --regen to install the" >&2
    echo "    regenerator. See --help for details." >&2
  fi

  local hook_src
  hook_src="$(resolve_script ".agent-src/templates/hooks/pre-commit-roadmap-progress" ".augment/templates/hooks/pre-commit-roadmap-progress")" || return 1

  if $print_only; then
    cat "$hook_src"
    return 0
  fi

  local git_dir
  git_dir="$(git -C "$CONSUMER_ROOT" rev-parse --git-dir 2>/dev/null || true)"
  if [[ -z "$git_dir" ]]; then
    echo "❌  hooks:install: $CONSUMER_ROOT is not a git repository." >&2
    return 1
  fi
  # Resolve relative git-dir paths (worktrees, submodules) against CONSUMER_ROOT.
  [[ "$git_dir" != /* ]] && git_dir="$CONSUMER_ROOT/$git_dir"

  local hook_dir="$git_dir/hooks"
  local target="$hook_dir/pre-commit"
  mkdir -p "$hook_dir"

  if [[ -f "$target" ]] && ! $force; then
    if grep -q "pre-commit-roadmap-progress" "$target" 2>/dev/null; then
      echo "✅  hooks:install: already installed at $target"
      return 0
    fi
    echo "⚠️   hooks:install: $target already exists and looks unrelated." >&2
    echo "    Options:" >&2
    echo "      1. Inspect it and append the snippet manually:" >&2
    echo "         ./agent-config hooks:install --print >> $target" >&2
    echo "      2. Replace it (destructive):" >&2
    echo "         ./agent-config hooks:install --force" >&2
    return 1
  fi

  cp "$hook_src" "$target"
  chmod +x "$target"
  echo "✅  hooks:install: pre-commit hook installed at $target"
  echo "    To uninstall: rm $target"
}

# Phase 4 of road-to-hooks-actually-fire-in-consumers — `--claude`
# (and its `--lifecycle` alias) path. Writes the minimal-viable Claude
# Code lifecycle wiring: enables the plugin in `.claude/settings.json`
# (idempotent dict-merge) AND ensures `./agent-config` is executable
# at the consumer root (symlink → scripts/agent-config in the package).
_hooks_install_claude_lifecycle() {
  local settings_dir="$CONSUMER_ROOT/.claude"
  local settings_file="$settings_dir/settings.json"
  mkdir -p "$settings_dir"

  # Idempotent merge using python3 — bash JSON edits are unsafe with
  # nested keys. Falls back to a fresh-write when the file is absent.
  python3 - "$settings_file" <<'PY' || return 1
import json
import sys
from pathlib import Path

target = Path(sys.argv[1])
data = {}
if target.is_file():
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"❌  hooks:install --claude: existing {target} is not valid JSON ({exc})", file=sys.stderr)
        sys.exit(1)
    if not isinstance(data, dict):
        print(f"❌  hooks:install --claude: existing {target} is not a JSON object", file=sys.stderr)
        sys.exit(1)
enabled = data.setdefault("enabledPlugins", {})
if not isinstance(enabled, dict):
    print(f"❌  hooks:install --claude: enabledPlugins in {target} is not an object", file=sys.stderr)
    sys.exit(1)
enabled["agent-config@event4u-agent-config"] = True
target.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
print(f"✅  hooks:install --claude: enabled plugin in {target}")
PY

  # Symlink the package's agent-config wrapper into the consumer root.
  # Idempotent — replace stale symlinks; skip if already correct.
  local link="$CONSUMER_ROOT/agent-config"
  local link_target
  # The package script lives at <package_root>/scripts/agent-config.
  # Try to resolve the package root via the dispatcher's own location.
  local package_root
  package_root="$(dirname "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")")"
  link_target="$package_root/scripts/agent-config"

  if [[ ! -e "$link_target" ]]; then
    echo "⚠️   hooks:install --claude: package script not found at $link_target" >&2
    echo "    Skipping symlink; the plugin-enable step succeeded." >&2
    return 0
  fi

  if [[ -L "$link" ]]; then
    local current
    current="$(readlink "$link" 2>/dev/null || true)"
    if [[ "$current" == "$link_target" ]]; then
      echo "✅  hooks:install --claude: ./agent-config symlink already current"
      return 0
    fi
    rm "$link"
  elif [[ -e "$link" ]]; then
    echo "⚠️   hooks:install --claude: ./agent-config exists but is not a symlink — leaving it alone" >&2
    return 0
  fi

  if ln -s "$link_target" "$link" 2>/dev/null; then
    echo "✅  hooks:install --claude: ./agent-config symlink → $link_target"
  else
    echo "⚠️   hooks:install --claude: could not create ./agent-config symlink" >&2
    return 1
  fi
}

# Phase 4 of road-to-hooks-actually-fire-in-consumers — `--regen` path.
# Provisions the canonical regenerator via the shared helper module.
# We invoke the script by path (not module form) so it works from any
# CONSUMER_ROOT — module form requires the package's `scripts` dir to
# be on PYTHONPATH which is not the case when invoked from a consumer.
_hooks_install_regenerator() {
  local package_root
  package_root="$(dirname "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")")"
  python3 "$package_root/scripts/_lib/install_regenerator.py" "$CONSUMER_ROOT" "$package_root" 2>&1
  return $?
}

# Wrap the interactive key installers under a stable CLI entry. The shell
# scripts themselves enforce /dev/tty, 0600, and atomic write — this is
# pure routing so consumers never have to know the package layout.
cmd_keys_install_anthropic() {
  local script
  script="$(resolve_script "scripts/install_anthropic_key.sh")" || return 1
  exec bash "$script" "$@"
}

cmd_keys_install_openai() {
  local script
  script="$(resolve_script "scripts/install_openai_key.sh")" || return 1
  exec bash "$script" "$@"
}

# Council CLI — non-interactive wrapper around scripts.ai_council.orchestrator.
# Three subcommands share one Python entry point; we forward the subcommand
# verb so `./agent-config council:run --confirm` lands on `council_cli.py run`.
cmd_council() {
  require_python3
  local sub="$1"; shift || true
  local script
  script="$(resolve_script "scripts/council_cli.py")" || return 1
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 "$script" "$sub" "$@"
}

# `use --profile=<id>` — switch the active experience/profile. Writes
# profile.id into the canonical .agent-settings.yml; the explicit
# profile-switch seam named by ADR-040 (road-to-6.0.0-a Step 8).
cmd_use() {
  require_python3
  local script
  script="$(resolve_script "scripts/profile_use.py")" || return 1
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 "$script" "$@"
}

# `agent-config update` — flip the agent_config_version pin in
# .agent-settings.yml. See scripts/_cli/cmd_update.py (P3.1 of
# road-to-portable-runtime-and-update-check.md).
cmd_update() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_update "$@"
}

cmd_upgrade() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_upgrade "$@"
}

cmd_refresh() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_refresh "$@"
}

# `agent-config migrate` — one-shot migration off legacy composer / npm
# install paths onto the npx-only runtime. See scripts/_cli/cmd_migrate.py
# (P3.5 of road-to-portable-runtime-and-update-check.md).
cmd_migrate() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_migrate "$@"
}

# `agent-config init` — project-scope install entry point. Forwards
# unmodified args to the bash installer. This is the canonical
# `npx @event4u/agent-config init` consumer entry point (replaces the
# deprecated @event4u/create-agent-config wrapper package).
cmd_init() {
  local script
  script="$(resolve_script "scripts/install")" || return 1
  exec bash "$script" "$@"
}

# `agent-config global` — user-scope install entry point. Forwards to the
# bash installer with `--global` set (ADR-007). Phase 1.2 of
# road-to-global-first-install.md. The bash wrapper handles option parsing
# and forwards to `scripts/install.py --global`, where `install_global()`
# currently scaffolds the per-tool anchor paths from USER_SCOPE_PATHS.
# Concrete writes land in Phase 1.5 (export) and Phase 1.6 (lockfile).
cmd_global() {
  local script
  script="$(resolve_script "scripts/install")" || return 1
  exec bash "$script" --global "$@"
}

# `agent-config export` — write a tool's canonical content into a
# user-chosen path. ADR-007 D3 / Phase 1.5 of
# road-to-global-first-install.md. Replaces the rejected symlink-bridge.
# See scripts/_cli/cmd_export.py for the registry and idempotency logic.
cmd_export() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_export "$@"
}

# `agent-config sync` — replay agents/installed-tools.lock (ADR-008
# Phase 3.3). Re-installs any tool whose bridge marker is missing on
# disk. Typical onboarding flow: clone → `./agent-config sync` → done.
cmd_sync() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_sync "$@"
}

# `agent-config validate` — read-only drift detection (ADR-008 Phase 3.4).
# Surfaces marker-missing, scope-divergence, and version-drift; exits 1 on
# any drift. Never edits the manifest or re-runs the installer.
cmd_validate() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_validate "$@"
}

# `agent-config settings:check` — read-only YAML-subset validator for
# `.agent-settings.yml` (P3.2 of road-to-proof-not-features.md). Contract
# pinned in docs/contracts/settings-sync-yaml-subset.md. Exit 0 clean,
# 1 finding(s), 2 file absent / unreadable.
cmd_settings_check() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_settings_check "$@"
}

# `agent-config settings:migrate` — lift project-local
# .agent-settings.yml / .agent-user.yml into ~/.event4u/agent-config/.
# Phase 2.4 of road-to-global-only-install.md. Read-only on the source —
# the destructive move step is owned by the unified `agent-config migrate`
# (see docs/contracts/migrate-command.md).
# Exit 0 success / no-op, 1 non-empty global without --force or parse error.
cmd_settings_migrate() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_settings_migrate "$@"
}

# `agent-config uninstall` — remove bridge markers (project) or lockfile
# entries (global). Idempotent. Pass `--purge` to also delete deployed
# content directories under user-scope anchors (destructive). See
# scripts/_cli/cmd_uninstall.py.
cmd_uninstall() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_uninstall "$@"
}

# `agent-config prune` — remove orphaned project bridge markers.
# Drift-cleanup sibling to `uninstall`: compares on-disk markers
# against agents/installed-tools.lock and unlinks anything not
# declared. Hard-floors when lockfile is absent. See
# scripts/_cli/cmd_prune.py.
cmd_prune() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_prune "$@"
}

# `agent-config doctor` — read-only drift report against the manifest.
# Surfaces missing / modified / foreign files. Exit 0 clean, 1 drift,
# 2 manifest-absent. See scripts/_cli/cmd_doctor.py.
cmd_doctor() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_doctor "$@"
}

# `agent-config versions` — list available @event4u/agent-config versions
# on the npm registry. Marks the current pin (from .agent-settings.yml)
# and the latest published version. Offline-tolerant. See
# scripts/_cli/cmd_versions.py.
cmd_versions() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_versions "$@"
}

# `agent-config explain <config|rule|route>` — print the decision chain
# behind a configuration or routing outcome. Read-only diagnostic; never
# edits state. See scripts/_cli/cmd_explain.py.
cmd_explain() {
  require_python3
  exec env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._cli.cmd_explain "$@"
}

main() {
  local cmd="${1-}"
  [[ $# -gt 0 ]] && shift || true

  case "$cmd" in
    mcp:render)              cmd_mcp_render "$@" ;;
    mcp:check)               cmd_mcp_check "$@" ;;
    mcp:setup)               cmd_mcp_setup "$@" ;;
    mcp:run)                 cmd_mcp_run "$@" ;;
    use)                     cmd_use "$@" ;;
    roadmap:progress)        cmd_roadmap_progress "$@" ;;
    roadmap:progress-check)  cmd_roadmap_progress_check "$@" ;;
    hooks:install)           cmd_hooks_install "$@" ;;
    keys:install-anthropic)  cmd_keys_install_anthropic "$@" ;;
    keys:install-openai)     cmd_keys_install_openai "$@" ;;
    first-run)               cmd_first_run "$@" ;;
    implement-ticket)        cmd_implement_ticket "$@" ;;
    work)                    cmd_work "$@" ;;
    memory:lookup)           cmd_memory_lookup "$@" ;;
    linked-projects:list)    cmd_linked_projects_list "$@" ;;
    memory:signal)           cmd_memory_signal "$@" ;;
    memory:hash)             cmd_memory_hash "$@" ;;
    memory:check)            cmd_memory_check "$@" ;;
    memory:check-proposal)   cmd_memory_check_proposal "$@" ;;
    proposal:check)          cmd_proposal_check "$@" ;;
    refine-ticket:detect)    cmd_refine_ticket_detect "$@" ;;
    chat-history:hook)       cmd_chat_history_hook "$@" ;;
    chat-history:checkpoint) cmd_chat_history_checkpoint "$@" ;;
    roadmap-progress:hook)   cmd_roadmap_progress_hook "$@" ;;
    onboarding-gate:hook)    cmd_onboarding_gate_hook "$@" ;;
    context-hygiene:hook)    cmd_context_hygiene_hook "$@" ;;
    dispatch:hook)           cmd_dispatch_hook "$@" ;;
    hooks:status)            cmd_hooks_status "$@" ;;
    hooks:doctor)            cmd_hooks_doctor "$@" ;;
    hooks:replay)            cmd_hooks_replay "$@" ;;
    telemetry:record)        cmd_telemetry_record "$@" ;;
    telemetry:status)        cmd_telemetry_status "$@" ;;
    telemetry:report)        cmd_telemetry_report "$@" ;;
    council:estimate)        cmd_council estimate "$@" ;;
    council:run)             cmd_council run "$@" ;;
    council:render)          cmd_council render "$@" ;;
    update)                  cmd_update "$@" ;;
    upgrade)                 cmd_upgrade "$@" ;;
    refresh)                 cmd_refresh "$@" ;;
    migrate)                 cmd_migrate "$@" ;;
    init)                    cmd_init "$@" ;;
    global)                  cmd_global "$@" ;;
    export)                  cmd_export "$@" ;;
    sync)                    cmd_sync "$@" ;;
    validate)                cmd_validate "$@" ;;
    settings:check)          cmd_settings_check "$@" ;;
    settings:migrate)        cmd_settings_migrate "$@" ;;
    uninstall)               cmd_uninstall "$@" ;;
    prune)                   cmd_prune "$@" ;;
    doctor)                  cmd_doctor "$@" ;;
    versions)                cmd_versions "$@" ;;
    explain)                 cmd_explain "$@" ;;
    help|--help|-h|"")
      # Optional `--tier=0|1|all` filter (default 0).
      local tier_arg="0"
      for arg in "$@"; do
        case "$arg" in
          --tier=0|--tier=1|--tier=all) tier_arg="${arg#--tier=}" ;;
          --tier|-t) ;; # next arg
          0|1|all)
            # Positional after --tier/-t.
            tier_arg="$arg" ;;
          --all) tier_arg="all" ;;
        esac
      done
      usage "$tier_arg" ;;
    --version|-V)            print_version ;;
    *)
      echo "❌  agent-config: unknown command: $cmd" >&2
      echo "    Run \`./agent-config help\` for the command list." >&2
      exit 2
      ;;
  esac
}

# Pre-flight pin resolver: when `.agent-settings.yml` carries a
# non-empty `agent_config_version` that differs from the running
# package version, re-exec via `npx @event4u/agent-config@<pin>`.
# Skipped for `--version`, `help`, `update` and `migrate` (so consumers
# can escape a bad pin or run the legacy-cleanup before a pin exists),
# and when `AGENT_CONFIG_NO_PIN_REEXEC=1`. See P3.2 of
# road-to-portable-runtime-and-update-check.md.
maybe_pin_reexec() {
  local cmd="${1-}"
  case "$cmd" in
    help|--help|-h|--version|-V|update|migrate|init|"") return 0 ;;
  esac
  if ! command -v python3 >/dev/null 2>&1; then
    return 0
  fi
  local installed
  installed="$(print_version)"
  [[ -z "$installed" || "$installed" == "unknown" ]] && return 0
  env PYTHONPATH="$PACKAGE_ROOT" python3 -m scripts._lib.pin_resolver \
    --cwd "$CONSUMER_ROOT" --installed "$installed" -- "$@" || true
}

# Post-subcommand banner: best-effort daily update-check notice on
# stderr. Runs after the dispatch returns (subshell wrapper below)
# so the banner appears post-output and never delays the subcommand.
# Suppressed in CI, on non-TTY stdout, by AGENT_CONFIG_NO_UPDATE_CHECK=1,
# or by `update_check.enabled: false` in settings. See P2 of
# road-to-portable-runtime-and-update-check.md.
run_update_check_banner() {
  local cmd="${1-}"
  case "$cmd" in
    help|--help|-h|--version|-V|"") return 0 ;;
  esac
  if ! command -v python3 >/dev/null 2>&1; then
    return 0
  fi
  local banner_script="$PACKAGE_ROOT/scripts/check_update_banner.py"
  [[ -f "$banner_script" ]] || return 0
  python3 "$banner_script" --cwd "$CONSUMER_ROOT" 2>/dev/null || true
}

# Global `--root <path>` / `--root=<path>` parsing (Step 8 A3).
# Strips the flag from $@, validates the path is an existing directory,
# and exports `AGENT_CONFIG_PROJECT_ROOT` + `AGENT_CONFIG_ROOT_OVERRIDE=1`
# so the Python resolver picks origin=root-flag with fail-loud semantics.
# Invalid path → exit 2 immediately, no fallback to anchor walk or CWD.
parse_global_root_flag() {
  local -a filtered=()
  local root_value=""
  local saw_flag=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --root)
        saw_flag=true
        if [[ $# -lt 2 ]]; then
          echo "❌  agent-config: --root requires a path argument" >&2
          exit 2
        fi
        root_value="$2"
        shift 2
        ;;
      --root=*)
        saw_flag=true
        root_value="${1#--root=}"
        shift
        ;;
      *)
        filtered+=("$1")
        shift
        ;;
    esac
  done
  if $saw_flag; then
    if [[ -z "$root_value" ]]; then
      echo "❌  agent-config: --root requires a non-empty path" >&2
      exit 2
    fi
    if [[ ! -e "$root_value" ]]; then
      echo "❌  agent-config: --root points to a path that does not exist: $root_value" >&2
      exit 2
    fi
    if [[ ! -d "$root_value" ]]; then
      echo "❌  agent-config: --root points to a non-directory: $root_value" >&2
      exit 2
    fi
    # Absolutize so downstream Python sees a fully-resolved path.
    root_value="$(cd "$root_value" && pwd)"
    export AGENT_CONFIG_PROJECT_ROOT="$root_value"
    export AGENT_CONFIG_ROOT_OVERRIDE=1
    # Wrapper-coupling guard: when invoked through a consumer-root wrapper
    # (CONSUMER_ROOT != root_value), surface a one-line warning on stderr
    # so the operator notices the divergence. Non-fatal: --root is the
    # deliberate override channel.
    if [[ "$CONSUMER_ROOT" != "$root_value" ]]; then
      echo "⚠️   agent-config: --root ($root_value) differs from wrapper CWD ($CONSUMER_ROOT)" >&2
    fi
  fi
  # Re-emit the filtered argv via a global array consumed by main().
  GLOBAL_FILTERED_ARGS=("${filtered[@]+"${filtered[@]}"}")
}

declare -a GLOBAL_FILTERED_ARGS
parse_global_root_flag "$@"
set -- "${GLOBAL_FILTERED_ARGS[@]+"${GLOBAL_FILTERED_ARGS[@]}"}"

# Pin re-exec runs before dispatch — if it triggers, the process is
# replaced and nothing else here matters.
maybe_pin_reexec "$@"

# Dispatch in a subshell so internal ``exec`` calls do not replace this
# process — we still get to run the post-subcommand banner.
( main "$@" )
rc=$?
run_update_check_banner "${1-}"
exit "$rc"

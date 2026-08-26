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
#     locate the package-internal TypeScript scripts (mcp_render.ts, …).
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
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
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

TS-shell native (run via the installed `agent-config` binary):
  setup                      Open the onboarding wizard in the browser (UI server)
  install                    Open the install wizard (UI server, Step 1 / AI tools)
  config                     Open the configuration GUI (global default; --project for the project surface)
  settings                   Open the local Settings GUI (alias of config)
  ui:serve                   Start the local UI server (127.0.0.1, auto-picked port)
  ui:audit [path]            Inventory a UI tree into agents/runtime/state/ui-audit.json
                             (Class A). The artefact ui-audit-gate reads.
  ui:render <path|url>       Headless capture at desktop / 375px / 320px into
                             agents/runtime/state/render/ (Class A; no process survives).
  workspaces ls              List workspaces from the discovery manifest
  packs ls                   List packs from the discovery manifest
  brand:status               Is a consumer brand layer present, and at which of the
                             four canonical tokens.json paths. Flags a dot-prefixed
                             .tokens.json, which nothing reads.
  packs:active               Which packs are active HERE, and from which file.
                             Names the degraded case (settings file without a
                             profile.id → zero packs) that nothing else reports.
  commands [ls|explain]      List/explain the command surface from the discovery manifest
                             (ls --candidates: surface-reduction report, report-only)
  mcp-server                 Turnkey read-only stdio MCP server (no repo clone; ADR-085)
  doctor-shell               Probe the TS-shell environment
  rtk:detect                 rtk (Rust Token Killer) presence + identity readout (--json)
  eval:record                Record a live trigger-eval result into a corpus manifest
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
  converge                   Consented cleanup of duplicate install surfaces
                             (surface-matrix driven). Never touches
                             user-authored files; persists standing consent
                             (install.auto_converge) on first use.
                             Flags: --dry-run | --yes
  conformance:behavior       Replay local transcripts through the mechanised conformance checks (--why <id> traces one)
  conformance                Consumer conformance contract: doctor --ci +
                             installed-and-firing checks. Exits non-zero on
                             a failed check.
  use                        Switch the active experience/profile
                             (writes profile.id). Usage: use <profile-id>
  explain                    Read-only decision-chain trace.
                             Usage: explain config | explain rule <name>
                                  | explain route "<text>"
                             Flags: --json | --project=<path>
  migrate                    One-shot, opinionated migration off every legacy install /
                             state shape — removes composer / npm package entries,
                             deletes legacy symlinks + project-local config, migrates
                             the v0 work-engine state file, refreshes .gitignore.
                             Wizard recreates fresh config. Flags: --dry-run
                             (preview), --check (probe: exit 0 clean / 2 pending),
                             --from 4|5 (declare source major).
                             Contract: docs/contracts/migrate-command.md
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
  council:status             Report whether an AI council is configured, and from where
                             (no API call, no spend)
  council:grant-billing      Record the human yes that lets an exhausted plan quota
                             retry on the metered rung, for ONE run.
                             Usage: council:grant-billing <run-id>
  council:revoke-billing     End a run-scoped billing grant (exit 0 when none)
                             Usage: council:revoke-billing <run-id>
  council:quota              Show today's per-provider CLI-call usage against the
                             enforced cap; --reset <provider> --confirm clears one
                             (no API call, no spend)
  self-repair:status         List queued agent-config defect records (read-only)
  self-repair:release        Publish one defect record — a PR when the fix can be
                             pushed, else an issue. Running it is your Hard-Floor
                             confirmation.
                             Usage: self-repair:release <fingerprint> [--dry-run]
  decision:memo              Record or list a question the run resolved without
                             asking you, so it stays reviewable afterwards.
                             Local-only (gitignored); the locked decision
                             classes are refused at the config schema, not here.
                             Usage: decision:memo write --run <id> --question <q>
                             --chosen <c> --reasoning <r> --resolver <who>
                             --confidence <high|medium|low>
                                    decision:memo list --run <id>
  run:supervise              Report runs whose session died with open steps
                             left. Report-only; --relaunch is the acting path.
                             NEVER merges, pushes, or closes anything.
                             Usage: run:supervise --once [--root PATH]
EOF
  fi

  if [[ "$tier" == "all" ]]; then
    cat <<'EOF'

Tier 2 — maintenance / internal (hooks, MCP, memory, telemetry):
  mcp:render                 Render mcp.json → .cursor/mcp.json, .windsurf/mcp.json
                             (pass --claude-desktop to also write user-scope config)
  mcp:check                  Dry-run mcp:render; exit non-zero if targets are stale
  mcp:available              What is declared in mcp.json, whether each server's
                             command is launchable, and the separate static tool
                             registry. No handshake — says so in the output.
  mcp:setup                  Verify the tsx runtime + MCP server module and
                             print the client config snippet
                             (one-line MCP server onboarding; idempotent)
  mcp:run                    Run the built-in MCP server over stdio
                             (requires `mcp:setup` first; see docs/mcp-server.md)
                             (experimental — beta gates: docs/contracts/mcp-beta-criteria.md)
  affected                   Show artefacts related to <artefact> via the discovery
                             relation-graph (relation-filtered BFS). Flags: --depth N
  graph-explain              Seed on a <concept>, expand 2 hops over the discovery
                             relation-graph with a node budget. Flags: --budget N
  benchmark                  Report context-token reduction vs the full always-loaded
                             projection (from the pinned token baseline). Flags: --format
  code-graph                 Deterministic code-graph engine (ADR-124, Class A).
                             Usage: code-graph build|validate|detect|query|explain|affected|path [options]
  sessions:list              List live agent sessions on this repository (shared
                             session register) PLUS the unmerged branches checked
                             out in other worktrees — the axis that needs no
                             claim. Flags: --json, --branches (adds the branch
                             axis to the JSON; the human form always shows it)
  sessions:claim             Claim a roadmap for this session so other sessions skip
                             it; --release clears the claim
  session:recycle            Validate + write the main-session recycle envelope (--verify validates only)
                             (deliberate recycle instead of auto-compact). Flags:
                             --file <json> | --template; default reads stdin
  roadmap:context            One live situational-awareness probe: open PRs and the
                             files they change, remote branches carrying a roadmap
                             slug, live sessions, agents/tmp/ note NAMES, and sibling
                             roadmaps on the same topic. --roadmap <slug>, --json
  roadmap:progress           Regenerate agents/roadmaps-progress.md from open roadmaps
                             (archives completed roadmaps; --no-archive to skip)
  roadmap:progress-check     Fail if agents/roadmaps-progress.md is stale (for CI)
  roadmap:set-step           Flip ONE checkbox glyph safely (lock + line anchor +
                             live invariant + survival check)
  roadmap:archive            Archive completed roadmaps (branch-touched by default;
                             --all for every complete one; --dry-run to preview)
  gates                      Open decisions that need you, rendered as actions —
                             roadmap blockers filtered by owner, most-unblocking
                             first. Flags: --all (include maintainer/external),
                             --json, --reply (reply-close form: the one blocking
                             decision in full, the rest as a count; prints
                             nothing when none are yours), --pending (staged
                             requires_confirmation actions awaiting you),
                             --sheet (ONE consolidated decision sheet: every
                             user-owned decision, sorted by unblock count, each
                             with a default and that default's provenance —
                             accept-all-defaults is a valid answer)
  capabilities:index         Regenerate CAPABILITIES.yaml — the package coverage index
                             (capability area → coverage → backing skills/commands → gaps).
                             Pass --check to fail if stale (for CI). Reads src/ (package repo).
  adr:effective              Effective state of one decision record: status, the
                             Decision section verbatim, clauses its own amendments
                             superseded, active amendments, provenance, evidence,
                             review trigger and trigger state. Read-only, and it
                             authorizes nothing. Exit 1 when the record still
                             asserts what its own amendment retired. Flag: --json
  settings:check             Validate .agent-settings.yml against the YAML-subset contract
                             (docs/contracts/settings-sync-yaml-subset.md). Read-only.
                             Exit 0 clean, 1 finding(s), 2 file absent / unreadable.
  settings:sync              Additively merge new template keys into an existing
                             .agent-settings.yml (user lines preserved verbatim).
                             Run automatically by `upgrade`. Flags: --path <file>
                             | --dry-run | --check (exit 2 on drift) | --profile.
  settings:migrate           Lift project-local .agent-settings.yml / .agent-user.yml into
                             ~/.event4u/agent-config/ (the global-only consumer surface,
                             ADR-020). Idempotent; --force overwrites a non-empty global
                             file, --dry-run lists intended copies with zero writes.
  settings:get               Read one setting: its value, the file it came from, its
                             class, and whether "absent" differs from the default.
                             Usage: settings:get <key> [--json]
  settings:set               Set one setting in the global file. Refuses every class-C
                             (guarded) key from docs/contracts/settings-classes.md, and
                             refuses everything when that contract is unreadable.
                             --source auto-detected|jit-answer|manual|gui, --dry-run.
  hooks:install              Install the combined pre-commit hook (roadmap-progress
                             + ADR-013 artefact frontmatter lint).
                             (use --print to dump it, --force to overwrite an existing hook)
  hooks:status               Print the runtime hook matrix (per-platform install + bindings)
                             Flags: --format json|table, --strict (CI), --project-root <path>
  hooks:doctor               Diagnose hook health: concerns + fail-open/closed posture,
                             last dispatcher feedback per concern, missing trampolines.
                             Wraps hooks:status. Read-only.
                             Flags: --format json|table, --strict (CI), --project-root <path>
  routing:doctor             Live routing diagnosis: per-gate ACTIVE/INACTIVE with the
                             concern's own reason (read-only probes), session_start chain,
                             router + projection freshness, host bridge status.
                             Flags: --platform <p>, --workspace <path>, --json, --strict,
                             --no-freshness
  workspace:doctor           One answer to "where am I": repo root, main worktree, current
                             worktree, branch, PR base — each with its provenance — plus
                             session claim, conflicting records and worktree pressure.
                             Read-only; no disposal path by design.
                             Flags: --from <dir>, --json, --strict
  route:explain              Deterministic rule-routing trace for one prompt: matched
                             triggers, tier, injected-vs-pointer disposition, budget
                             consumption, rejected candidates. Trigger-match level only
                             (what the host invokes is not measured).
                             Flags: --files a,b, --profile full|balanced, --json
  route:audit                Replay the router matcher over the last N user prompts of
                             the chat-history log; renders matched rules per prompt.
                             Trigger-match level only; read-only, no LLM call.
                             Flags: --last N, --record (opt-in recorder), --weekly, --json
  hooks:replay               Replay a fixture through the universal dispatcher with
                             AGENT_CONFIG_REPLAY=1 (no writes under agents/runtime/state/).
                             Usage: hooks:replay --platform <name> --event <event>
                                    --payload <path|event-name> [--native-event <native>]
                                    [--manifest <path>] [--json] [--dry-run]
  reach:doctor               Health report over the reach channel registry: per channel
                             the active backend, lifecycle, and the pinned install command
                             for this platform when a backend is missing/broken.
                             Read-only — no writes, no installs; NOT a router and NOT an
                             agent-facing recommendation.
                             Flags: --format json|table, --strict (CI), --channel <id>,
                             --registry <path>, --deep (⚠️  opt-in NETWORK: one real
                             read-only request per declared backend; never runs in CI,
                             writes nothing)
  memory:lookup              Retrieve memory entries (text or JSON envelope)
  memory:get                 Batch-fetch full memory entries by id (CLI twin of the
                             memory_get MCP tool). Usage: memory:get <id> [<id> ...] [--format text|json]
  linked-projects:list       List opted-in IDE-attached sibling repos (path · detected_via · large)
                             Flags: --all (show undecided too), --format json
  memory:signal              Append a provisional intake signal (memory proposal)
  memory:hash                Hash a memory entry (YAML or JSON stdin)
  memory:check               Validate memory YAML schema + staleness
  memory:check-proposal      Run the admission gate on a memory proposal
  memory:learn               Aggregate memory intake signals into the local learning
                             sidecar (read-only; --write to emit). Usage: memory:learn [--intake-dir DIR]
                             [--out-dir DIR] [--now ISO] [--write] [--format text|json]
  analytics                  Local-only workspace analytics (emit|show|prune|migrate).
                             Usage: analytics show [--window 30d|7d|24h] · analytics prune
  knowledge                  Global knowledge-card store (list|show|trace|forget|promote|
                             validate|lead-check|purge). Usage: knowledge list [--json]
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
  analyze-session            Read-only post-session report from on-disk runtime state
  handoff                    Pick a recent session, generate a handoff, seed a fresh session
EOF
  fi

  if [[ "$tier" == "0" ]]; then
    cat <<'EOF'

(Hidden: Tier-1 and Tier-2 commands. Run `./agent-config --help --tier=1`
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
  ./agent-config memory:get a1-crosshost-subagent-degradation
  ./agent-config memory:signal --type architecture-decision --path src/Foo.php --body "…"
  ./agent-config memory:check --path agents/memory
  ./agent-config memory:learn --format json
  ./agent-config code-graph detect
  ./agent-config code-graph query <symbol>
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
  if [[ -f "$VERSION_FILE" ]] && command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require(process.argv[1]).version + '\n')" "$VERSION_FILE"
  else
    echo "unknown"
  fi
}

# Resolve the tsx runner (Python→TypeScript migration). tsx is a DEV-ONLY
# dependency since the road-to-credible-install Phase 1 flip — the consumer
# runtime tree ships no tsx, so every consumer-reachable surface must resolve
# a precompiled bundle instead (hooks → dist/hooks/dispatch.js, mcp:run →
# dist/mcp/server.mjs, the `_cli` delegate commands → dist/cli-delegate/,
# see exec_ts below). This resolver therefore only ever fires in a DEV tree
# (node_modules/.bin/tsx present) or as a genuine last-resort fallback.
# `npx tsx` is that last resort: npx runs against the CONSUMER project's cwd,
# so its npm config and devEngines/engines constraints apply — a consumer
# pinning e.g. `node <24` hard-fails with EBADDEVENGINES (the 8.1.0
# regression that silently broke hooks + roadmap:progress in consumer
# projects). Reaching it from a consumer-tier command is a packaging bug, not
# a supported path. Exits 127 when nothing works — the runtime is Node/tsx,
# there is no Python fallback.
require_tsx() {
  if [[ -x "$PACKAGE_ROOT/node_modules/.bin/tsx" ]]; then
    TSX_BIN="$PACKAGE_ROOT/node_modules/.bin/tsx"
    return 0
  fi
  if [[ -f "$PACKAGE_ROOT/node_modules/tsx/dist/cli.mjs" ]] && command -v node >/dev/null 2>&1; then
    TSX_BIN="node $PACKAGE_ROOT/node_modules/tsx/dist/cli.mjs"
    return 0
  fi
  if command -v npx >/dev/null 2>&1; then
    echo "⚠️  agent-config: package-local tsx not found — falling back to \`npx tsx\`" >&2
    echo "    (subject to this project's npm config; reinstall the package to fix:" >&2
    echo "     npm install -g @event4u/agent-config)" >&2
    TSX_BIN="npx tsx"
    return 0
  fi
  echo "❌  agent-config: tsx runner not found" >&2
  echo "    Reinstall the package (npm install -g @event4u/agent-config) to provide" >&2
  echo "    node_modules/tsx, or run \`npm install\` at the package root." >&2
  exit 127
}

# Map a `src/scripts/_cli/<name>.ts` path to its precompiled bundle entry
# under `dist/cli-delegate/<name>.js`, echoing the bundle path when it exists
# and node is available. Empty output means "no bundle — use the tsx path".
#
# Scoped to `_cli/` on purpose: that directory is the consumer-tier delegate
# command surface (`sync`, `doctor`, `validate`, `upgrade`, …) and its
# basenames are unique, so the mapping is collision-free. Other exec_ts
# callers (resolve_script results, the work engine, …) are unaffected.
#
# In a DEV tree the bundle is also suppressed when any `src/**/*.ts` is newer
# than it — see cli_delegate_bundle_is_stale.
cli_delegate_bundle() {
  local ts_abs="$1"
  case "$ts_abs" in
    "$PACKAGE_ROOT/src/scripts/_cli/"*) ;;
    *) return 0 ;;
  esac
  local name
  name="$(basename "${ts_abs%.ts}")"
  local bundle="$PACKAGE_ROOT/dist/cli-delegate/$name.js"
  if [[ -f "$bundle" ]] && command -v node >/dev/null 2>&1; then
    cli_delegate_bundle_is_stale "$bundle" && return 0
    printf '%s' "$bundle"
  fi
}

# Is a `dist/cli-delegate/` bundle older than the sources it was built from?
#
# Only asked in a DEV tree — `$PACKAGE_ROOT/src` exists there and nowhere else.
# A consumer install ships no `src/`, so it returns "not stale" without a single
# stat and the ADR-204 fast path is untouched.
#
# The scan covers `src` WHOLE, not `src/scripts`: `_cli/*.ts` imports reach into
# `src/shared`, `src/install`, `src/server`, `src/agent`, `src/config` and
# `src/agent-src`, and the defect this guard exists for lived two hops away in
# `src/scripts/_lib/cc_transcript.ts` — a scan narrowed to the entry point's own
# directory would have missed it.
#
# Cost, measured 2026-08-14 on the local tree (1075 `.ts` files): 78 ms when the
# bundle is current (the full walk) and ~12 ms when it is not (`-quit` exits at
# the first newer file). The bundle saves ~290 ms against the tsx path, so the
# worst case still leaves most of that — and buys the guarantee that a dev-tree
# edit is never silently ignored in favour of a stale compile.
cli_delegate_bundle_is_stale() {
  local bundle="$1"
  [[ -d "$PACKAGE_ROOT/src" ]] || return 1
  local newer
  newer="$(find "$PACKAGE_ROOT/src" -name '*.ts' -newer "$bundle" -print -quit 2>/dev/null)"
  [[ -n "$newer" ]]
}

# Run an absolute script path. The argument is an absolute path that may carry
# a `.py` (legacy) or `.ts` extension; we resolve the `.ts` twin.
#
# A precompiled `dist/cli-delegate/` bundle wins when present AND not stale —
# the consumer tree ships no tsx (see require_tsx), and the bundle is also
# ~5.7x faster than the npx path it replaces (p50 56-71 ms vs 346-392 ms,
# measured 2026-07-31; see docs/decisions/ADR-204). The tsx path stays as the
# dev-tree route and as the fallback for every non-`_cli` caller.
#
# "Not stale" is the load-bearing qualifier, and it was added because the
# unqualified version shipped a real failure: a dev-tree `dist/cli-delegate/`
# built before a `projectStoreSlug` fix kept running the OLD slug, so
# `agent-config handoff --list` reported "no recent sessions" in any worktree
# whose path carried a `+`, while the fixed source right next to it listed ten.
# A compiled copy that silently outranks the source it was built from turns
# every edit into a coin flip — see cli_delegate_bundle_is_stale.
#
# Argv/stdin/stdout/stderr/exit-code pass through unchanged in both routes —
# mirrors src/scripts/run.ts resolution.
exec_ts() {
  local script="$1"; shift
  local ts_abs="${script%.py}"
  ts_abs="${ts_abs%.ts}.ts"
  local bundle
  bundle="$(cli_delegate_bundle "$ts_abs")"
  if [[ -n "$bundle" ]]; then
    exec node "$bundle" "$@"
  fi
  if [[ ! -f "$ts_abs" ]]; then
    echo "❌  agent-config: script not found: $ts_abs" >&2
    exit 127
  fi
  require_tsx
  # shellcheck disable=SC2086
  exec $TSX_BIN "$ts_abs" "$@"
}

# Run a hook that has been ported to TypeScript: resolve <base>.ts via tsx.
# <base> is relative to PACKAGE_ROOT, WITHOUT extension. Mirrors the
# src/scripts/run.ts dispatcher resolution.
exec_hook() {
  local base="$1"; shift
  local ts_abs="$PACKAGE_ROOT/${base}.ts"
  if [[ ! -f "$ts_abs" ]]; then
    echo "❌  agent-config: hook not found: ${base}.ts" >&2
    return 1
  fi
  require_tsx
  # shellcheck disable=SC2086
  exec $TSX_BIN "$ts_abs" "$@"
}

# Locate a script. First argument is relative to PACKAGE_ROOT, second is
# an optional fallback relative to CONSUMER_ROOT (for scripts that ship
# to the consumer via .augment/, e.g. update_roadmap_progress.ts).
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
#   3. PACKAGE_ROOT/dist/agent-src/templates/scripts/<name>   — package-internal fallback
# Consumer customization wins so projects can patch behavior locally
# without losing the upstream default.
resolve_template_script() {
  local name="$1"
  local p
  for p in \
    "$CONSUMER_ROOT/scripts/$name" \
    "$CONSUMER_ROOT/.augment/templates/scripts/$name" \
    "$PACKAGE_ROOT/dist/agent-src/templates/scripts/$name"; do
    if [[ -f "$p" ]]; then
      printf '%s' "$p"
      return 0
    fi
  done
  echo "❌  agent-config: template script not found: $name" >&2
  echo "    Searched:" >&2
  echo "      - $CONSUMER_ROOT/scripts/$name" >&2
  echo "      - $CONSUMER_ROOT/.augment/templates/scripts/$name" >&2
  echo "      - $PACKAGE_ROOT/dist/agent-src/templates/scripts/$name" >&2
  return 1
}

cmd_mcp_render() {
  local script
  script="$(resolve_script "src/scripts/mcp_render.ts")"
  exec_ts "$script" "$@"
}

cmd_affected() {
  local script
  script="$(resolve_script "src/scripts/discovery_graph.ts")"
  exec_ts "$script" affected "$@"
}

cmd_graph_explain() {
  local script
  script="$(resolve_script "src/scripts/discovery_graph.ts")"
  exec_ts "$script" explain "$@"
}

cmd_benchmark() {
  local script
  script="$(resolve_script "src/scripts/benchmark.ts")"
  exec_ts "$script" "$@"
}

# `agent-config code-graph` — deterministic code-graph engine (ADR-124,
# Class A). Delegates 1:1 to the engine CLI's own subcommand dispatch
# (build|validate|detect|query|explain|affected|path); no re-parsing here.
cmd_code_graph() {
  local script
  script="$(resolve_script "src/scripts/code_graph/cli.ts")"
  exec_ts "$script" "$@"
}

cmd_mcp_check() {
  local script
  script="$(resolve_script "src/scripts/mcp_render.ts")"
  exec_ts "$script" --check "$@"
}

cmd_mcp_setup() {
  local script
  script="$(resolve_script "src/scripts/mcp_setup.sh")" || return 1
  exec bash "$script" "$@"
}

# Run the built-in stdio MCP server. The server module ships inside the
# package (PACKAGE_ROOT/src/scripts/mcp_server/) as a TypeScript module run
# via tsx — no Python venv / SDK install any more (the runtime is Node/tsx).
cmd_mcp_run() {
  # Precompiled bundle first (road-to-credible-install Phase 1 tsx sweep):
  # one node start, no tsx in the runtime tree. tsx path is the dev-tree
  # fallback only.
  local server_bundle="$PACKAGE_ROOT/dist/mcp/server.mjs"
  if [[ -f "$server_bundle" ]]; then
    exec node "$server_bundle" "$@"
  fi
  local server_main="$PACKAGE_ROOT/src/scripts/mcp_server/__main__.ts"
  if [[ ! -f "$server_main" ]]; then
    echo "❌  agent-config: MCP server module not found at $server_main" >&2
    echo "    Reinstall the package and retry." >&2
    exit 1
  fi
  exec_ts "$server_main" "$@"
}

# Shared session register (road-to-parallel-session-coordination). Resolved from
# PACKAGE_ROOT, not the consumer projection: the CLI imports the register library
# under src/scripts/_lib/, which is package-internal and never shipped into
# dist/agent-src/scripts/. Same shape as cmd_settings_set.
# Situational-awareness probe (road-to-roadmap-situational-awareness Phase 1).
# PACKAGE_ROOT, not the consumer projection: it imports src/scripts/_lib/, which
# is package-internal and never shipped into dist/agent-src/scripts/. Same shape
# as cmd_sessions_list below, and for the same reason.
cmd_roadmap_context() {
  exec_ts "$PACKAGE_ROOT/src/scripts/roadmap_context.ts" "$@"
}

cmd_sessions_list() {
  exec_ts "$PACKAGE_ROOT/src/scripts/sessions_cli.ts" list "$@"
}

cmd_sessions_claim() {
  exec_ts "$PACKAGE_ROOT/src/scripts/sessions_cli.ts" claim "$@"
}

# Main-session recycle envelope producer (road-to-token-economy-recycling
# Phase 2.2). PACKAGE_ROOT: imports src/scripts/_lib/ (capsule schema) and
# src/scripts/hooks/state_io.ts, which are never projected into
# dist/agent-src/scripts/.
cmd_session_recycle() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_session_recycle.ts" "$@"
}

# Capability probes (road-to-capability-answerability). All three resolve from
# PACKAGE_ROOT rather than the consumer projection: each imports package-internal
# libraries under src/scripts/_lib/ or src/shared/, which are never projected into
# dist/agent-src/scripts/. Same shape as cmd_settings_set.
cmd_packs_active() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_packs_active.ts" "$@"
}

cmd_settings_get() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_settings_get.ts" "$@"
}

cmd_mcp_available() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_mcp_available.ts" "$@"
}

cmd_brand_status() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_brand_status.ts" "$@"
}

# `--archive`: a completed roadmap is archived here rather than reported as a
# warning the caller has to act on. `roadmap:progress-check` never passes it —
# a CI gate must not mutate the tree it is checking. Pass `--no-archive` to get
# the dashboard-only behaviour back.
cmd_roadmap_progress() {
  local script
  script="$(resolve_script "dist/agent-src/scripts/update_roadmap_progress.ts" ".augment/scripts/update_roadmap_progress.ts")"
  exec_ts "$script" --archive "$@"
}

cmd_roadmap_progress_check() {
  local script
  script="$(resolve_script "dist/agent-src/scripts/update_roadmap_progress.ts" ".augment/scripts/update_roadmap_progress.ts")"
  exec_ts "$script" --check "$@"
}

# The PR-gate archival sweep (`/create-pr` § 1c and roadmap-progress-sync's
# PR-gate) instructs `./agent-config roadmap:archive` — this is that command.
cmd_roadmap_archive() {
  local script
  script="$(resolve_script "dist/agent-src/scripts/archive_completed_roadmaps.ts" ".augment/scripts/archive_completed_roadmaps.ts")"
  exec_ts "$script" "$@"
}

cmd_roadmap_set_step() {
  local script
  script="$(resolve_script "dist/agent-src/scripts/roadmap_set_step.ts" ".augment/scripts/roadmap_set_step.ts")"
  exec_ts "$script" "$@"
}

cmd_gates() {
  local script
  script="$(resolve_script "dist/agent-src/scripts/roadmap_gates.ts" ".augment/scripts/roadmap_gates.ts")"
  exec_ts "$script" "$@"
}

cmd_capabilities_index() {
  local script
  script="$(resolve_script "src/scripts/generate_capabilities_index.ts")"
  exec_ts "$script" "$@"
}

cmd_adr_effective() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_adr_effective.ts" "$@"
}

cmd_first_run() {
  local script
  script="$(resolve_script "src/scripts/first-run.sh")"
  exec bash "$script" "$@"
}

cmd_implement_ticket() {
  local engine_root="$PACKAGE_ROOT/dist/agent-src/templates/scripts"
  if [[ ! -d "$engine_root/work_engine" ]]; then
    echo "❌  agent-config: work_engine module not found at $engine_root/work_engine" >&2
    echo "    Reinstall the package and retry." >&2
    return 1
  fi
  exec_ts "$engine_root/work_engine/__main__.ts" "$@"
}

cmd_work() {
  # /work shares the engine with /implement-ticket — only the input
  # envelope differs (kind=prompt vs kind=ticket). Keeping a separate
  # subcommand makes the user-facing distinction explicit and lets the
  # two flows diverge later without churn at the wrapper layer.
  local engine_root="$PACKAGE_ROOT/dist/agent-src/templates/scripts"
  if [[ ! -d "$engine_root/work_engine" ]]; then
    echo "❌  agent-config: work_engine module not found at $engine_root/work_engine" >&2
    echo "    Reinstall the package and retry." >&2
    return 1
  fi
  exec_ts "$engine_root/work_engine/__main__.ts" "$@"
}

cmd_memory_lookup() {
  local script
  script="$(resolve_template_script "memory_lookup.ts")" || return 1
  exec_ts "$script" "$@"
}

# `agent-config memory:get` — CLI twin of the `memory_get` MCP tool
# (batch full-entry fetch by id). Package-internal handler
# (src/scripts/_cli/cmd_memory_get.ts) reuses `memory_get_v1` from
# src/scripts/memory_lookup.ts — no separate resolve needed, same
# direct-PACKAGE_ROOT pattern as cmd_export / cmd_sync / cmd_validate.
cmd_memory_get() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_memory_get.ts" "$@"
}

# `agent-config memory:learn` — aggregate the memory intake signal log
# into the local, gitignored learning sidecar (road-to-retrieval-
# substrate-hardening B3). Read-only by default (the sidecar's own
# default); `--write` emits `.agent-learning.json` + `LESSONS.md`.
cmd_memory_learn() {
  local script
  script="$(resolve_script "src/scripts/learning_sidecar.ts")" || return 1
  exec_ts "$script" "$@"
}

# `agent-config analytics` — local-only workspace analytics
# (docs/contracts/local-analytics.md). Delegates 1:1 to the module's own
# subcommand dispatch (emit|show|prune|migrate|decrypt-all|rekey).
cmd_analytics() {
  local script
  script="$(resolve_script "src/cli/python/workspace_analytics.ts")" || return 1
  exec_ts "$script" "$@"
}

# `agent-config knowledge` — file-first global knowledge-card store
# (ADR-100). Delegates 1:1 to the store CLI's own subcommand dispatch
# (list|show|trace|forget|promote|validate|lead-check|purge).
cmd_knowledge() {
  local script
  script="$(resolve_script "src/scripts/knowledge_global_cli.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_linked_projects_list() {
  local script
  script="$(resolve_script "src/scripts/linked_projects_list.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_memory_signal() {
  local script
  script="$(resolve_template_script "memory_signal.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_memory_hash() {
  local script
  script="$(resolve_template_script "memory_hash.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_telemetry_record() {
  local script
  script="$(resolve_template_script "telemetry_record.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_telemetry_status() {
  local script
  script="$(resolve_template_script "telemetry_status.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_telemetry_report() {
  local script
  script="$(resolve_template_script "telemetry_report.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_memory_check() {
  local script
  script="$(resolve_template_script "check_memory.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_memory_check_proposal() {
  local script
  script="$(resolve_template_script "check_memory_proposal.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_proposal_check() {
  local script
  script="$(resolve_script "src/scripts/check_proposal.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_refine_ticket_detect() {
  local script
  script="$(resolve_script "src/scripts/refine_ticket_detect.ts")" || return 1
  exec_ts "$script" "$@"
}

cmd_chat_history_hook() {
  local script
  script="$(resolve_script "src/scripts/chat_history.ts")" || return 1
  exec_ts "$script" hook-dispatch "$@"
}

cmd_roadmap_progress_hook() {
  exec_hook "src/scripts/roadmap_progress_hook" "$@"
}

cmd_onboarding_gate_hook() {
  exec_hook "src/scripts/onboarding_gate_hook" "$@"
}

cmd_context_hygiene_hook() {
  exec_hook "src/scripts/context_hygiene_hook" "$@"
}

cmd_dispatch_hook() {
  # Hook hot path (road-to-credible-install Phase 1): prefer the precompiled
  # single-process bundle — one node start, concerns in-process, no tsx.
  # Fallback to the tsx path only on a stale dev tree without dist/.
  local bundle="$PACKAGE_ROOT/dist/hooks/dispatch.js"
  if [[ -f "$bundle" ]]; then
    exec node "$bundle" "$@"
  fi
  exec_hook "src/scripts/hooks/dispatch_hook" "$@"
}

cmd_hooks_status() {
  exec_hook "src/scripts/hooks_status" "$@"
}

cmd_hooks_doctor() {
  exec_hook "src/scripts/hooks_doctor" "$@"
}

cmd_routing_doctor() {
  exec_hook "src/scripts/routing_doctor" "$@"
}

cmd_workspace_doctor() {
  exec_hook "src/scripts/workspace_doctor" "$@"
}

cmd_hooks_replay() {
  exec_hook "src/scripts/hooks/replay_hook" "$@"
}

# Read-only reach-channel health report. Never installs, never writes.
cmd_reach_doctor() {
  exec_hook "src/scripts/reach_doctor" "$@"
}

cmd_chat_history_checkpoint() {
  local script
  script="$(resolve_script "src/scripts/chat_history.ts")" || return 1
  # Default cadence-bearing event when a user/agent invokes /chat-history-checkpoint:
  # "phase" — explicit phase boundary, lands under per_phase / per_turn cadences.
  exec_ts "$script" hook-append --event phase "$@"
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
                      .augment/scripts/update_roadmap_progress.ts
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
  hook_src="$(resolve_script "dist/agent-src/templates/hooks/pre-commit-roadmap-progress" ".augment/templates/hooks/pre-commit-roadmap-progress")" || return 1

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

  # Idempotent merge using node — bash JSON edits are unsafe with
  # nested keys. Falls back to a fresh-write when the file is absent.
  node -e '
const fs = require("fs");
const target = process.argv[1];
let data = {};
if (fs.existsSync(target)) {
  let raw;
  try {
    raw = fs.readFileSync(target, "utf8");
    data = JSON.parse(raw);
  } catch (exc) {
    process.stderr.write(`❌  hooks:install --claude: existing ${target} is not valid JSON (${exc.message})\n`);
    process.exit(1);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    process.stderr.write(`❌  hooks:install --claude: existing ${target} is not a JSON object\n`);
    process.exit(1);
  }
}
let enabled = data.enabledPlugins;
if (enabled === undefined) {
  enabled = {};
  data.enabledPlugins = enabled;
}
if (enabled === null || typeof enabled !== "object" || Array.isArray(enabled)) {
  process.stderr.write(`❌  hooks:install --claude: enabledPlugins in ${target} is not an object\n`);
  process.exit(1);
}
enabled["agent-config@event4u-agent-config"] = true;
fs.writeFileSync(target, JSON.stringify(data, null, 2) + "\n", "utf8");
process.stdout.write(`✅  hooks:install --claude: enabled plugin in ${target}\n`);
' "$settings_file" || return 1

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
  # The helper module lives at src/scripts/_lib/ (6.0.0-D moved tooling under
  # src/). $PACKAGE_ROOT is the package root (two levels above src/scripts) and
  # is the search base the regenerator needs to locate dist/agent-src/ / .augment/.
  require_tsx
  # shellcheck disable=SC2086
  $TSX_BIN "$SCRIPT_DIR/_lib/install_regenerator.ts" "$CONSUMER_ROOT" "$PACKAGE_ROOT" 2>&1
  return $?
}

# Wrap the interactive key installers under a stable CLI entry. The shell
# scripts themselves enforce /dev/tty, 0600, and atomic write — this is
# pure routing so consumers never have to know the package layout.
cmd_keys_install_anthropic() {
  local script
  script="$(resolve_script "src/scripts/install_anthropic_key.sh")" || return 1
  exec bash "$script" "$@"
}

cmd_keys_install_openai() {
  local script
  script="$(resolve_script "src/scripts/install_openai_key.sh")" || return 1
  exec bash "$script" "$@"
}

# Council CLI — non-interactive wrapper around scripts.ai_council.orchestrator.
# Three subcommands share one Python entry point; we forward the subcommand
# verb so `./agent-config council:run --confirm` lands on `council_cli.ts run`.
cmd_council() {
  local sub="$1"; shift || true
  local script
  script="$(resolve_script "src/scripts/council_cli.ts")" || return 1
  exec_ts "$script" "$sub" "$@"
}

# `self-repair:{status,release}` — the queued-defect reader and the single
# gated outward step. `release` publishes (a PR, else an issue); running it IS
# the user's Hard-Floor confirmation, which is why nothing else in the loop
# may publish on its own.
cmd_self_repair() {
  local sub="$1"; shift || true
  local script
  script="$(resolve_script "src/scripts/self_repair_cli.ts")" || return 1
  exec_ts "$script" "$sub" "$@"
}

# `decision:memo {write,list}` — the decision-memo channel (UOTL Phase 4.3).
# A question resolved without contacting the user is only legitimate if the
# resolution is reviewable afterwards; this is where that record goes. Writes
# under agents/runtime/state/decisions/<run>/, which is gitignored, so a memo
# never reaches a commit unless a human copies it out.
cmd_decision_memo() {
  local sub="$1"; shift || true
  local script
  script="$(resolve_script "src/scripts/decision_memo.ts")" || return 1
  exec_ts "$script" "$sub" "$@"
}

# `run:supervise` — the out-of-process watcher for runs whose session died
# with open steps left. Report-only by default; the acting path is behind
# --relaunch because starting a session spends tokens with nobody watching.
# It NEVER merges, pushes, or closes anything — the auto-merge the reference
# design carries is a named rejection, not an unbuilt feature.
cmd_run_supervise() {
  local script
  script="$(resolve_script "src/scripts/run_supervise.ts")" || return 1
  exec_ts "$script" "$@"
}

# `use --profile=<id>` — switch the active experience/profile. Writes
# profile.id into the canonical .agent-settings.yml; the explicit
# profile-switch seam named by ADR-040 (road-to-6.0.0-a Step 8).
cmd_use() {
  local script
  script="$(resolve_script "src/scripts/profile_use.ts")" || return 1
  exec_ts "$script" "$@"
}

# `agent-config update` — flip the agent_config_version pin in
# .agent-settings.yml. See scripts/_cli/cmd_update.ts (P3.1 of
# road-to-portable-runtime-and-update-check.md).
cmd_update() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_update.ts" "$@"
}

cmd_upgrade() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_upgrade.ts" "$@"
}

cmd_refresh() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_refresh.ts" "$@"
}

# `agent-config migrate` — one-shot migration off legacy composer / npm
# install paths onto the npx-only runtime. See scripts/_cli/cmd_migrate.ts
# (P3.5 of road-to-portable-runtime-and-update-check.md).
cmd_migrate() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_migrate.ts" "$@"
}

# `agent-config init` — project-scope install entry point. Forwards
# unmodified args to the bash installer. This is the canonical
# `npx @event4u/agent-config init` consumer entry point (replaces the
# deprecated @event4u/create-agent-config wrapper package).
cmd_init() {
  local script
  script="$(resolve_script "src/scripts/install")" || return 1
  exec bash "$script" "$@"
}

# `agent-config global` — user-scope install entry point. Forwards to the
# bash installer with `--global` set (ADR-007). Phase 1.2 of
# road-to-global-first-install.md. The bash wrapper handles option parsing
# and forwards to `scripts/install.ts --global`, where `install_global()`
# currently scaffolds the per-tool anchor paths from USER_SCOPE_PATHS.
# Concrete writes land in Phase 1.5 (export) and Phase 1.6 (lockfile).
cmd_global() {
  local script
  script="$(resolve_script "src/scripts/install")" || return 1
  exec bash "$script" --global "$@"
}

# `agent-config export` — write a tool's canonical content into a
# user-chosen path. ADR-007 D3 / Phase 1.5 of
# road-to-global-first-install.md. Replaces the rejected symlink-bridge.
# See scripts/_cli/cmd_export.ts for the registry and idempotency logic.
cmd_export() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_export.ts" "$@"
}

# `agent-config sync` — replay agents/installed-tools.lock (ADR-008
# Phase 3.3). Re-installs any tool whose bridge marker is missing on
# disk. Typical onboarding flow: clone → `./agent-config sync` → done.
cmd_sync() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_sync.ts" "$@"
}

# `agent-config validate` — read-only drift detection (ADR-008 Phase 3.4).
# Surfaces marker-missing, scope-divergence, and version-drift; exits 1 on
# any drift. Never edits the manifest or re-runs the installer.
cmd_validate() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_validate.ts" "$@"
}

# `agent-config settings:check` — read-only YAML-subset validator for
# `.agent-settings.yml` (P3.2 of road-to-proof-not-features.md). Contract
# pinned in docs/contracts/settings-sync-yaml-subset.md. Exit 0 clean,
# 1 finding(s), 2 file absent / unreadable.
cmd_settings_check() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_settings_check.ts" "$@"
}

# `agent-config settings:sync` — additive merge of the current
# agent-settings template into an existing .agent-settings.yml. User lines
# are preserved verbatim; only missing template keys are inserted.
# Idempotent. Invoked automatically by `agent-config upgrade` for every
# existing settings file (global + project) so nobody keeps stale settings
# after a release. Flags: --path <file> | --dry-run | --check | --profile.
# Exit 0 in-sync / updated, 2 drift under --check or bad input.
cmd_settings_sync() {
  exec_ts "$PACKAGE_ROOT/src/scripts/sync_agent_settings.ts" "$@"
}

# `agent-config settings:migrate` — lift project-local
# .agent-settings.yml / .agent-user.yml into ~/.event4u/agent-config/.
# Phase 2.4 of road-to-global-only-install.md. Read-only on the source —
# the destructive move step is owned by the unified `agent-config migrate`
# (see docs/contracts/migrate-command.md).
# Exit 0 success / no-op, 1 non-empty global without --force or parse error.
cmd_settings_migrate() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_settings_migrate.ts" "$@"
}

# `agent-config settings:set <key> <value>` — the one agent-reachable settings
# writer. Refuses every C-class key from docs/contracts/settings-classes.md,
# fails closed when that contract is unreadable, zod-validates before writing,
# writes atomically into ~/.event4u/agent-config/settings/.agent-settings.yml,
# and stamps source+timestamp into the .agent-settings.provenance.json sidecar.
# Flags: --source auto-detected|jit-answer|manual|gui | --dry-run.
# Exit 0 written / no-op, 1 refused, 2 usage.
cmd_settings_set() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_settings_set.ts" "$@"
}

# `agent-config uninstall` — remove bridge markers (project) or lockfile
# entries (global). Idempotent. Pass `--purge` to also delete deployed
# content directories under user-scope anchors (destructive). See
# scripts/_cli/cmd_uninstall.ts.
cmd_uninstall() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_uninstall.ts" "$@"
}

# `agent-config prune` — remove orphaned project bridge markers.
# Drift-cleanup sibling to `uninstall`: compares on-disk markers
# against agents/installed-tools.lock and unlinks anything not
# declared. Hard-floors when lockfile is absent. See
# scripts/_cli/cmd_prune.ts.
cmd_prune() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_prune.ts" "$@"
}

# `agent-config doctor` — read-only drift report against the manifest.
# Surfaces missing / modified / foreign files. Exit 0 clean, 1 drift,
# 2 manifest-absent. See scripts/_cli/cmd_doctor.ts.
cmd_doctor() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_doctor.ts" "$@"
}

# `agent-config converge` — consented duplicate-surface cleanup.
# Exit codes: 0 converged/nothing-to-do/dry-run · 1 refused/failed · 2 usage.
# See scripts/_cli/cmd_converge.ts.
cmd_converge() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_converge.ts" "$@"
}

# `agent-config conformance` — consumer conformance contract
# (road-to-flow-learnings Phase 0). Doctor --ci semantics plus the five
# consumer checks (txlog tail, router pointers, dispatcher smoke,
# lean-projection consistency, host-capability manifest). Exit 0 green,
# 1 any fail/drift, 2 environment error. See docs/contracts/conformance.md.
cmd_conformance() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_conformance.ts" "$@"
}

# `agent-config versions` — list available @event4u/agent-config versions
# on the npm registry. Marks the current pin (from .agent-settings.yml)
# and the latest published version. Offline-tolerant. See
# scripts/_cli/cmd_versions.ts.
cmd_versions() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_versions.ts" "$@"
}

# `agent-config explain <config|rule|route>` — print the decision chain
# behind a configuration or routing outcome. Read-only diagnostic; never
# Router-matcher replay over recent chat-history prompts (read-only).
# See scripts/_cli/cmd_route_audit.ts.
cmd_route_audit() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_route_audit.ts" "$@"
}

# Deterministic rule-routing trace (trigger-match measurement level only).
# See scripts/_cli/cmd_route_explain.ts.
cmd_route_explain() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_route_explain.ts" "$@"
}

# edits state. See scripts/_cli/cmd_explain.ts.
cmd_explain() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_explain.ts" "$@"
}

# `agent-config analyze-session` — read-only post-session report from on-disk
# runtime state (.work-state.json + context-hygiene.json). No daemon, no
# network, no model calls. See scripts/_cli/cmd_analyze_session.ts.
cmd_analyze_session() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_analyze_session.ts" "$@"
}

# `agent-config conformance:behavior` — replay the local transcript store
# through the four MECHANISED conformance checks (language pin, git
# authorization, vacuous evidence, evidence steering). Report, not gate:
# exit 0 unless the store is unreadable. See src/scripts/conformance_scan.ts.
cmd_conformance_behavior() {
  local script
  script="$(resolve_script "src/scripts/conformance_scan.ts" "dist/agent-src/scripts/conformance_scan.ts")"
  exec_ts "$script" "$@"
}

# `agent-config handoff` — pick a recent session, generate a deterministic
# handoff into agents/runtime/state/handoff-context.md, optionally --launch a
# fresh host session. See scripts/_cli/cmd_handoff.ts.
cmd_handoff() {
  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_handoff.ts" "$@"
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
    affected)                cmd_affected "$@" ;;
    graph-explain)           cmd_graph_explain "$@" ;;
    benchmark)               cmd_benchmark "$@" ;;
    code-graph)              cmd_code_graph "$@" ;;
    conformance:behavior)    cmd_conformance_behavior "$@" ;;
    sessions:list)           cmd_sessions_list "$@" ;;
    sessions:claim)          cmd_sessions_claim "$@" ;;
    session:recycle)         cmd_session_recycle "$@" ;;
    packs:active)            cmd_packs_active "$@" ;;
    settings:get)            cmd_settings_get "$@" ;;
    mcp:available)           cmd_mcp_available "$@" ;;
    brand:status)            cmd_brand_status "$@" ;;
    roadmap:context)         cmd_roadmap_context "$@" ;;
    roadmap:progress)        cmd_roadmap_progress "$@" ;;
    roadmap:progress-check)  cmd_roadmap_progress_check "$@" ;;
    roadmap:archive)         cmd_roadmap_archive "$@" ;;
    roadmap:set-step)        cmd_roadmap_set_step "$@" ;;
    gates)                   cmd_gates "$@" ;;
    capabilities:index)      cmd_capabilities_index "$@" ;;
    adr:effective)           cmd_adr_effective "$@" ;;
    hooks:install)           cmd_hooks_install "$@" ;;
    keys:install-anthropic)  cmd_keys_install_anthropic "$@" ;;
    keys:install-openai)     cmd_keys_install_openai "$@" ;;
    first-run)               cmd_first_run "$@" ;;
    implement-ticket)        cmd_implement_ticket "$@" ;;
    work)                    cmd_work "$@" ;;
    memory:lookup)           cmd_memory_lookup "$@" ;;
    memory:get)              cmd_memory_get "$@" ;;
    linked-projects:list)    cmd_linked_projects_list "$@" ;;
    memory:signal)           cmd_memory_signal "$@" ;;
    memory:hash)             cmd_memory_hash "$@" ;;
    memory:check)            cmd_memory_check "$@" ;;
    memory:check-proposal)   cmd_memory_check_proposal "$@" ;;
    memory:learn)            cmd_memory_learn "$@" ;;
    analytics)               cmd_analytics "$@" ;;
    knowledge)               cmd_knowledge "$@" ;;
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
    routing:doctor)          cmd_routing_doctor "$@" ;;
    workspace:doctor)        cmd_workspace_doctor "$@" ;;
    route:explain)           cmd_route_explain "$@" ;;
    route:audit)             cmd_route_audit "$@" ;;
    hooks:replay)            cmd_hooks_replay "$@" ;;
    reach:doctor)            cmd_reach_doctor "$@" ;;
    telemetry:record)        cmd_telemetry_record "$@" ;;
    telemetry:status)        cmd_telemetry_status "$@" ;;
    telemetry:report)        cmd_telemetry_report "$@" ;;
    council:estimate)        cmd_council estimate "$@" ;;
    council:run)             cmd_council run "$@" ;;
    council:render)          cmd_council render "$@" ;;
    council:status)         cmd_council status "$@" ;;
    council:quota)           cmd_council quota "$@" ;;
    council:grant-billing)   cmd_council grant-billing "$@" ;;
    council:revoke-billing)  cmd_council revoke-billing "$@" ;;
    self-repair:status)      cmd_self_repair status "$@" ;;
    self-repair:release)     cmd_self_repair release "$@" ;;
    decision:memo)           cmd_decision_memo "$@" ;;
    run:supervise)           cmd_run_supervise "$@" ;;
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
    settings:sync)           cmd_settings_sync "$@" ;;
    settings:migrate)        cmd_settings_migrate "$@" ;;
    settings:set)            cmd_settings_set "$@" ;;
    uninstall)               cmd_uninstall "$@" ;;
    prune)                   cmd_prune "$@" ;;
    doctor)                  cmd_doctor "$@" ;;
    converge)                cmd_converge "$@" ;;
    conformance)             cmd_conformance "$@" ;;
    versions)                cmd_versions "$@" ;;
    explain)                 cmd_explain "$@" ;;
    analyze-session)         cmd_analyze_session "$@" ;;
    handoff)                 cmd_handoff "$@" ;;
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
  # Best-effort: soft tsx probe (no hard-exit — this runs around dispatch).
  local tsx_bin=""
  if [[ -x "$PACKAGE_ROOT/node_modules/.bin/tsx" ]]; then
    tsx_bin="$PACKAGE_ROOT/node_modules/.bin/tsx"
  elif command -v npx >/dev/null 2>&1; then
    tsx_bin="npx tsx"
  else
    return 0
  fi
  local installed
  installed="$(print_version)"
  [[ -z "$installed" || "$installed" == "unknown" ]] && return 0
  # shellcheck disable=SC2086
  $tsx_bin "$PACKAGE_ROOT/src/scripts/_lib/pin_resolver.ts" \
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
  # Best-effort: soft tsx probe (no hard-exit — banner is post-dispatch).
  local tsx_bin=""
  if [[ -x "$PACKAGE_ROOT/node_modules/.bin/tsx" ]]; then
    tsx_bin="$PACKAGE_ROOT/node_modules/.bin/tsx"
  elif command -v npx >/dev/null 2>&1; then
    tsx_bin="npx tsx"
  else
    return 0
  fi
  local banner_script="$PACKAGE_ROOT/src/scripts/check_update_banner.ts"
  [[ -f "$banner_script" ]] || return 0
  # shellcheck disable=SC2086
  $tsx_bin "$banner_script" --cwd "$CONSUMER_ROOT" 2>/dev/null || true
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

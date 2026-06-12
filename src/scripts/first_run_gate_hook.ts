#!/usr/bin/env node
/**
 * First-run gate — surface the marketplace-install-but-unscaffolded shape.
 *
 * TypeScript twin of `src/scripts/first_run_gate_hook.py` (ADR-090 —
 * Python→TS migration, Phase 6 / hooks). Public API mirrors the Python
 * module exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Phase 2 of `road-to-hooks-actually-fire-in-consumers`.
 *
 * When a consumer enables the plugin via `/plugin install` but never
 * runs `agent-config init` (or `hooks:install --claude --regen`), the
 * hooks declared in `hooks/hooks.json` fire but cannot do anything —
 * their commands resolve through an `$CLAUDE_PROJECT_DIR/agent-config`
 * that does not exist, or call a regenerator script that lives only in
 * package source-checkouts. The user has no way to discover this.
 *
 * This hook runs on `session_start` only. It detects the failure shape
 * and surfaces it two ways (Council R3 HIGH — stderr alone is invisible
 * to the average user):
 *
 * 1. One stderr line — Claude shows session-start hook stderr in its
 *    lifecycle log; power users will see it there.
 * 2. A file at `$CLAUDE_PROJECT_DIR/.augment/.first-run-action-needed.md`
 *    that the user discovers on the next `ls` of their tree.
 *
 * Setup-complete detector (Council R3 MEDIUM — prevents banner spam):
 * the hook exits early without writing if the checklist passes
 * (`./agent-config` symlink executable + `.augment/scripts/update_roadmap_progress.py`
 * exists). Once the user runs `hooks:install --claude --regen`, the
 * file written by a prior run gets cleaned up the next time this hook
 * runs successfully.
 *
 * Contract: never blocks. Returns 0 on every path.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PLUGIN_ID = "agent-config@event4u-agent-config";
const ACTION_NEEDED_FILE = ".augment/.first-run-action-needed.md";

const REGENERATOR_PATHS: readonly string[] = [
  ".augment/scripts/update_roadmap_progress.py",
  "dist/agent-src/scripts/update_roadmap_progress.py",
  // 6.0.x (ADR-051): uncondensed source container moved to src/agent-src/.
  "src/agent-src/scripts/update_roadmap_progress.py",
];

const ACTION_NEEDED_BODY = `# First-run action needed — \`agent-config\` plugin

You enabled the \`agent-config@event4u-agent-config\` plugin via
\`/plugin install\`, but your project is missing the prerequisites
the plugin's hooks need to actually fire:

- \`./agent-config\` symlink at the repo root (needed by every hook).
- \`.augment/scripts/update_roadmap_progress.py\` (needed by the
  roadmap-progress hook to regenerate the dashboard).

Fix in one command:

\`\`\`bash
./agent-config hooks:install --claude --regen
\`\`\`

Or run the full installer:

\`\`\`bash
./agent-config init
\`\`\`

After either command, this file deletes itself on the next session
start. If you don't want the plugin's hooks, disable it via
\`/plugin disable agent-config@event4u-agent-config\` and delete
this file manually.
`;

function _isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function _exists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns True iff `.claude/settings.json` has the plugin id under
 * `enabledPlugins` with a truthy value.
 */
function _plugin_enabled(consumer_root: string): boolean {
  const settings = path.join(consumer_root, ".claude", "settings.json");
  if (!_isFile(settings)) {
    return false;
  }
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(settings, "utf-8"));
  } catch {
    return false;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return false;
  }
  const enabled = (data as Record<string, unknown>)["enabledPlugins"];
  if (
    typeof enabled !== "object" ||
    enabled === null ||
    Array.isArray(enabled)
  ) {
    return false;
  }
  return Boolean((enabled as Record<string, unknown>)[PLUGIN_ID]);
}

/** `./agent-config` exists AND is executable (whether file or symlink). */
function _agent_config_executable(consumer_root: string): boolean {
  const p = path.join(consumer_root, "agent-config");
  if (!_exists(p)) {
    return false;
  }
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function _regenerator_present(consumer_root: string): boolean {
  return REGENERATOR_PATHS.some((rel) =>
    _isFile(path.join(consumer_root, rel)),
  );
}

function _setup_complete(consumer_root: string): boolean {
  return (
    _agent_config_executable(consumer_root) &&
    _regenerator_present(consumer_root)
  );
}

/** Best-effort write. Returns True on success. */
function _write_action_file(consumer_root: string): boolean {
  const target = path.join(consumer_root, ACTION_NEEDED_FILE);
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, ACTION_NEEDED_BODY, { encoding: "utf-8" });
    return true;
  } catch (exc) {
    process.stderr.write(
      `first-run-gate: could not write ${target}: ${String(exc)}\n`,
    );
    return false;
  }
}

/** Remove the action-needed file once setup is complete. Best-effort. */
function _cleanup_action_file(consumer_root: string): void {
  const target = path.join(consumer_root, ACTION_NEEDED_FILE);
  if (_exists(target)) {
    try {
      fs.unlinkSync(target);
    } catch {
      /* ignore */
    }
  }
}

export function run(consumer_root: string): number {
  if (process.env["AGENT_CONFIG_REPLAY"] === "1") {
    // Fixture-driven replay must not mutate state.
    return 0;
  }
  if (!_plugin_enabled(consumer_root)) {
    // Plugin not enabled — nothing to gate on. Silent.
    return 0;
  }
  if (_setup_complete(consumer_root)) {
    // Setup checklist passes — clean up any stale action-needed file
    // left by a prior run, then exit silently.
    _cleanup_action_file(consumer_root);
    return 0;
  }

  // Failure shape detected. Two visible surfaces:
  process.stderr.write(
    "first-run-gate: agent-config plugin is enabled but " +
      "scaffolding is missing — run `./agent-config hooks:install " +
      "--claude --regen` (details written to " +
      `${ACTION_NEEDED_FILE})\n`,
  );
  _write_action_file(consumer_root);
  return 0;
}

interface ParsedArgs {
  platform: string;
}

export function parse_args(argv: string[]): ParsedArgs {
  let platform = "generic";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--platform") {
      platform = argv[i + 1] ?? "generic";
      i += 1;
    } else if (arg !== undefined && arg.startsWith("--platform=")) {
      platform = arg.slice("--platform=".length);
    }
  }
  return { platform };
}

function _readStdin(): void {
  try {
    fs.readFileSync(0, "utf-8");
  } catch {
    /* ignore */
  }
}

export function main(argv?: string[]): number {
  parse_args(argv ?? process.argv.slice(2));
  // Drain stdin envelope so the dispatcher pipe contract holds.
  _readStdin();
  const consumer_root =
    process.env["CLAUDE_PROJECT_DIR"] || process.cwd();
  return run(consumer_root);
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}

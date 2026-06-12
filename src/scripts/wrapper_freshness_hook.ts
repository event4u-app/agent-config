#!/usr/bin/env node
/**
 * session_start concern — keep the project-local `./agent-config` fresh.
 *
 * TypeScript twin of `src/scripts/wrapper_freshness_hook.py` (ADR-090 —
 * Python→TS migration, Phase 6 / hooks). Public API mirrors the Python
 * module exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Defense-in-depth twin of the update-command refresh (`upgrade` /
 * `refresh --project`). On every session_start the dispatcher runs this in
 * the consumer workspace; if a `./agent-config` wrapper exists there and
 * differs from the canonical template, it is re-stamped so an outdated,
 * fallback-less copy cannot keep breaking the hooks.
 *
 * Bootstrapping note: this can only heal a wrapper functional enough to
 * invoke the dispatcher in the first place (the current template's global +
 * npx fallbacks guarantee that). A *completely* broken wrapper never reaches
 * this concern — that recovery path is `agent-config upgrade` /
 * `refresh --project`.
 *
 * Contract: never creates a wrapper where none exists (that is an install
 * action); never touches the agent-config source repo; always fail-open
 * (exit 0) — hook self-heal must not block a session.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  install_cli_wrapper,
  needs_refresh,
} from "./_lib/cli_wrapper.js";

export const EXIT_ALLOW = 0;

function _project_root(): string {
  const env =
    process.env["CLAUDE_PROJECT_DIR"] ||
    process.env["AGENT_CONFIG_PROJECT_DIR"];
  if (env) {
    return env;
  }
  return process.cwd();
}

function _isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function _isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * True when project_root is the agent-config package itself.
 *
 * TypeScript twin of `src/scripts/_cli/cmd_refresh.py::_is_source_repo`
 * (unported standalone — inlined here so the hook stays dependency-free
 * and crash-safe). The broader check (condensed output, packaged source,
 * or the package's own `package.json` name) makes the freshness self-heal
 * a no-op in any agent-config checkout. Consumers use dev-mode, not
 * refresh.
 */
function _is_source_repo(project_root: string): boolean {
  if (_isDir(path.join(project_root, "dist/agent-src"))) {
    return true;
  }
  try {
    const packagesDir = path.join(project_root, "packages");
    if (_isDir(packagesDir)) {
      for (const entry of fs.readdirSync(packagesDir)) {
        if (_isDir(path.join(packagesDir, entry, ".agent-src.uncondensed"))) {
          return true;
        }
      }
    }
  } catch {
    /* ignore */
  }
  const pkg = path.join(project_root, "package.json");
  if (_isFile(pkg)) {
    try {
      const data = JSON.parse(fs.readFileSync(pkg, "utf-8"));
      if (
        typeof data === "object" &&
        data !== null &&
        (data as Record<string, unknown>)["name"] === "@event4u/agent-config"
      ) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

function _readStdinIfNotTty(): void {
  try {
    if (!process.stdin.isTTY) {
      fs.readFileSync(0, "utf-8");
    }
  } catch {
    /* ignore */
  }
}

function _parseRoot(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      return argv[i + 1] ?? null;
    }
    if (arg !== undefined && arg.startsWith("--root=")) {
      return arg.slice("--root=".length);
    }
  }
  return null;
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  const rootArg = _parseRoot(args);

  // Drain stdin (the dispatcher passes a JSON envelope); we do not need it.
  _readStdinIfNotTty();

  const root = rootArg !== null ? rootArg : _project_root();
  let wrapper: string | null;
  try {
    if (_is_source_repo(root)) {
      return EXIT_ALLOW;
    }
    if (!_isFile(path.join(root, "agent-config"))) {
      return EXIT_ALLOW; // no wrapper here — never create one
    }
    if (!needs_refresh(root)) {
      return EXIT_ALLOW;
    }
    wrapper = install_cli_wrapper(root);
  } catch {
    return EXIT_ALLOW; // fail-open — never block the session
  }

  if (wrapper !== null) {
    process.stderr.write(
      `[wrapper] re-stamped stale ./agent-config at ${wrapper}\n`,
    );
    // Python json.dumps default separators are (", ", ": ") — build the
    // object string by hand so stdout is byte-identical to the .py twin
    // (JSON.stringify uses no spaces).
    const decision = JSON.stringify("allow");
    const reason = JSON.stringify(
      `refreshed stale ./agent-config wrapper at ${wrapper}`,
    );
    process.stdout.write(
      `{${JSON.stringify("decision")}: ${decision}, ${JSON.stringify(
        "reason",
      )}: ${reason}}`,
    );
  }
  return EXIT_ALLOW;
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}

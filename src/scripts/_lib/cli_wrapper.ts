/**
 * Install / refresh the consumer-facing `./agent-config` wrapper.
 *
 * TypeScript twin of `src/scripts/_lib/cli_wrapper.py` (ADR-088 —
 * Python→TS migration, Phase 2 / Wave 1). Public API mirrors the
 * Python module exactly (snake_case kept deliberately).
 *
 * The wrapper is gitignored and meant to be regenerated on every
 * install, but the normal update cadence (`upgrade`,
 * `refresh --project`) never re-ran the bash installer — so an older,
 * fallback-less wrapper could linger in a consumer project and break
 * every Claude hook (the hook resolves the master CLI *through* this
 * wrapper). These helpers let the update commands re-stamp the wrapper
 * from the canonical template.
 *
 * The template is the single source of truth
 * (`src/templates/agent-config-wrapper.sh`); the installer copies it
 * verbatim with no substitution, so refreshing is a plain copy +
 * `chmod`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// src/scripts/_lib/cli_wrapper.ts → three levels up is the package root
// (mirrors the Python module's parents[3] resolution).
const _PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const _TEMPLATE = path.join(
  _PACKAGE_ROOT,
  "src",
  "templates",
  "agent-config-wrapper.sh",
);

function _is_file(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Absolute path to the canonical wrapper template. */
export function template_path(): string {
  return _TEMPLATE;
}

function _target(project_root: string): string {
  return path.join(project_root, "agent-config");
}

/**
 * True when the project wrapper is missing or differs from the template.
 *
 * Returns `false` when the template itself is unavailable (corrupt /
 * maintainer-only checkout) — there is nothing to refresh *to*.
 */
export function needs_refresh(project_root: string): boolean {
  if (!_is_file(_TEMPLATE)) return false;
  const target = _target(project_root);
  if (!_is_file(target)) return true;
  try {
    return (
      fs.readFileSync(target, "utf-8") !== fs.readFileSync(_TEMPLATE, "utf-8")
    );
  } catch {
    return true;
  }
}

/**
 * Copy the canonical wrapper template to `<project_root>/agent-config`.
 *
 * Returns the written target path, or `null` when the template is
 * missing (corrupt package / maintainer checkout without templates).
 */
export function install_cli_wrapper(project_root: string): string | null {
  if (!_is_file(_TEMPLATE)) return null;
  const target = _target(project_root);
  fs.copyFileSync(_TEMPLATE, target);
  fs.chmodSync(target, 0o755);
  return target;
}

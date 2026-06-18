/**
 * Provision the roadmap-progress regenerator into a consumer.
 *
 * TypeScript twin of `src/scripts/_lib/install_regenerator.py` (ADR-200 —
 * Python→TS migration, Phase 2 / Wave 2a). Public API mirrors the Python
 * module exactly (snake_case kept deliberately).
 *
 * Phase 3 of `road-to-hooks-actually-fire-in-consumers`.
 *
 * The roadmap-progress hook (`scripts/roadmap_progress_hook.ts`) searches
 * three locations for `update_roadmap_progress.ts`. Only the **canonical**
 * location is reliable in marketplace-install consumers:
 * `.augment/scripts/update_roadmap_progress.ts`. This helper pins the contract
 * and copies the script idempotently.
 *
 * Contract: idempotent; preserves executable bit; never throws (callers get a
 * `[success, message]` tuple).
 *
 * The regenerator has been ported to TypeScript; this helper copies the
 * package-side `.ts` regenerator into the consumer. The executable bit is
 * still preserved (a `.ts` run via tsx does not strictly need it, but keeping
 * the chmod preserves the idempotent contract).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/** Path of the script relative to the package's source-of-truth tree. */
export const REGENERATOR_REL = "scripts/update_roadmap_progress.ts";

/** Canonical destination path inside a consumer repo. */
export const CONSUMER_REGENERATOR_REL = ".augment/scripts/update_roadmap_progress.ts";

/**
 * Resolve the package-side source-of-truth for the regenerator.
 *
 * Searches the package layout in priority order:
 *   1. `src/agent-src/scripts/update_roadmap_progress.ts`
 *   2. `packages/core/.agent-src.uncondensed/scripts/update_roadmap_progress.ts`
 *   3. `dist/agent-src/scripts/update_roadmap_progress.ts` (condensed projection)
 *   4. `.augment/scripts/update_roadmap_progress.ts` (tool projection)
 *
 * Returns the first existing file, or `null` if none exist (which is a
 * misconfigured package and should be a hard error at the call site).
 */
export function package_source(package_root: string): string | null {
  const candidates = [
    // 6.0.x (ADR-051): uncondensed source container moved to src/agent-src/.
    path.join(package_root, "src", "agent-src", REGENERATOR_REL),
    // Back-compat: pre-collapse packages/core/ layout.
    path.join(package_root, "packages", "core", ".agent-src.uncondensed", REGENERATOR_REL),
    path.join(package_root, "dist/agent-src", REGENERATOR_REL),
    path.join(package_root, ".augment", REGENERATOR_REL),
  ];
  for (const c of candidates) {
    if (is_file(c)) {
      return c;
    }
  }
  return null;
}

/** Canonical destination path inside the consumer repo. */
export function consumer_target(consumer_root: string): string {
  return path.join(consumer_root, CONSUMER_REGENERATOR_REL);
}

/**
 * Copy the regenerator into the consumer. Idempotent.
 *
 * Returns `[success, message]`. `success=false` means the call site should
 * surface the message; the helper never throws.
 */
export function install_regenerator(
  package_root: string,
  consumer_root: string,
): [boolean, string] {
  const source = package_source(package_root);
  if (source === null) {
    return [
      false,
      "regenerator source not found in package " +
        "(searched src/agent-src/, packages/core/.agent-src.uncondensed/, " +
        "dist/agent-src/, .augment/)",
    ];
  }
  const target = consumer_target(consumer_root);
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Idempotent: skip the copy if content is byte-identical.
    if (fs.existsSync(target) && Buffer.compare(fs.readFileSync(target), fs.readFileSync(source)) === 0) {
      return [true, `regenerator already current at ${target}`];
    }
    fs.copyFileSync(source, target);
    // Preserve executable bit so the hook can subprocess-call it.
    const mode = fs.statSync(target).mode;
    // S_IXUSR | S_IXGRP | S_IXOTH = 0o111.
    fs.chmodSync(target, mode | 0o111);
    return [true, `regenerator installed at ${target}`];
  } catch (exc) {
    return [false, `failed to install regenerator: ${(exc as Error).message}`];
  }
}

/** Quick boolean — does the canonical regenerator exist + is executable? */
export function is_installed(consumer_root: string): boolean {
  const target = consumer_target(consumer_root);
  if (!is_file(target)) {
    return false;
  }
  try {
    fs.accessSync(target, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** `Path.is_file()` — true iff `p` exists and is a regular file. */
function is_file(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * CLI entry point — `tsx install_regenerator.ts <consumer-root> [<package-root>]`.
 * Returns the process exit code.
 */
export function main(argv: string[] = process.argv.slice(2)): number {
  if (argv.length < 1) {
    process.stderr.write(
      "usage: install_regenerator.ts <consumer_root> [<package_root>]\n",
    );
    return 2;
  }
  const consumer_root = path.resolve(argv[0]!);
  let package_root: string;
  if (argv.length > 1) {
    package_root = path.resolve(argv[1]!);
  } else {
    // __file__ = src/scripts/_lib/install_regenerator.ts → package root is
    // three levels up (_lib → scripts → src → root), i.e. parents[3] in Python.
    const here = path.dirname(fileURLToPath(import.meta.url));
    package_root = path.resolve(here, "..", "..", "..");
  }
  const [ok, msg] = install_regenerator(package_root, consumer_root);
  process.stdout.write(msg + "\n");
  return ok ? 0 : 1;
}

// Run as a script when invoked directly (not when imported).
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

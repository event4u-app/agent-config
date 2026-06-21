/**
 * Install-layout ABI version.
 *
 * TypeScript twin of `src/scripts/_lib/install_layout.py` (ADR-200 — Python→TS
 * migration). Public API mirrors the Python module exactly (snake_case kept
 * deliberately — fidelity over TS idiom): the two version constants and the
 * `coerce_layout_version` / `needs_migration` helpers, with Python `int()`
 * coercion semantics replicated.
 *
 * The *install layout* is the on-disk shape the installer writes into a host
 * (paths created, JSON-pointer keys claimed, the surgical-uninstall pointer
 * schema, the lockfile shapes). It is frozen as a versioned contract in
 * `docs/contracts/install-layout.md`.
 *
 * This module owns the single source of truth for the layout version. The
 * installer stamps {@link INSTALL_LAYOUT_VERSION} into the global lockfile
 * (`~/.event4u/agent-config/installed.lock`) so an installed tree
 * self-declares which ABI it was written under.
 *
 * Back-compat: a lockfile written before the freeze has no
 * `install_layout_version` key. Readers treat an absent value as
 * {@link PRE_FREEZE_LAYOUT_VERSION} (v0 / pre-freeze), which the installer
 * migrates in place on the next run. A bump to {@link INSTALL_LAYOUT_VERSION}
 * is a declared layout change governed by the deprecation-window rule in
 * `BREAKING_CHANGES.md`.
 */

/** A lockfile with no `install_layout_version` predates the freeze. */
export const PRE_FREEZE_LAYOUT_VERSION = 0;

/**
 * Current on-disk install-layout ABI version. Bump only with a declared
 * layout change + a deprecation-window entry in `BREAKING_CHANGES.md`.
 */
export const INSTALL_LAYOUT_VERSION = 1;

/**
 * Mirror Python's `int(value)` for the value shapes that reach this module.
 *
 * Returns `null` on the cases where Python raises `TypeError` / `ValueError`
 * so the caller can fall back to {@link PRE_FREEZE_LAYOUT_VERSION}, matching
 * Python's `except (TypeError, ValueError)` branch.
 */
function _pyInt(value: unknown): number | null {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    // Python int(str) accepts optional surrounding whitespace and a sign,
    // base-10 digits only (with optional underscores between digits). No
    // float strings, no hex. Reject anything else with null (ValueError).
    const trimmed = value.trim();
    if (!/^[+-]?\d+(?:_\d+)*$/.test(trimmed)) {
      return null;
    }
    return Number.parseInt(trimmed.replace(/_/g, ''), 10);
  }
  return null;
}

/**
 * Normalise a recorded layout-version value to an int.
 *
 * Absent / unparseable → {@link PRE_FREEZE_LAYOUT_VERSION}, so a hand-edited
 * or pre-freeze lockfile reads as v0 rather than raising.
 */
export function coerce_layout_version(value: unknown): number {
  if (value === null || value === undefined) {
    return PRE_FREEZE_LAYOUT_VERSION;
  }
  const parsed = _pyInt(value);
  if (parsed === null) {
    return PRE_FREEZE_LAYOUT_VERSION;
  }
  return parsed;
}

/** True when an installed tree's layout version is older than current. */
export function needs_migration(recorded: unknown): boolean {
  return coerce_layout_version(recorded) < INSTALL_LAYOUT_VERSION;
}

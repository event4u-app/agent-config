/**
 * Global-install lockfile at `~/.event4u/agent-config/installed.lock`.
 *
 * TypeScript twin of `src/scripts/_lib/installed_lock.py` (ADR-200 — Python→TS
 * migration, Phase 2 / Wave 2a). Public API mirrors the Python module exactly
 * (snake_case kept deliberately — fidelity over TS idiom), including the
 * byte-exact lockfile wire format and the tempfile + rename atomic write.
 *
 * Phase 1.6 of road-to-global-first-install (ADR-007 D5). Records the package
 * version that performed the most recent user-scope install plus the tools
 * that were scaffolded. `init --global` reads this file: on version mismatch
 * the install refuses unless `--force` is passed; the `update` subcommand
 * refreshes the entry in lockstep with the pin flip in `.agent-settings.yml`.
 *
 * The schema is intentionally minimal YAML so the module can read and write
 * without depending on a YAML library. Atomic writes go through tempfile +
 * rename per ADR-007 risk-mitigation row.
 *
 * Path resolution is delegated to `user_global_paths` (Phase 1 of
 * road-to-event4u-namespace-and-claude-desktop.md): writes land at
 * `~/.event4u/agent-config/installed.lock`; reads fall back to the legacy
 * `~/.config/agent-config/installed.lock` if the new path is missing, so
 * pre-2.4 installs keep working during the transition.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as user_global_paths from "./user_global_paths.js";
import {
  INSTALL_LAYOUT_VERSION,
  coerce_layout_version,
  needs_migration,
} from "./install_layout.js";

export type EnvMap = Record<string, string | undefined>;

/** Lockfile dict shape (loosely typed, mirroring Python's `dict`). */
export interface LockfileData {
  schema_version?: number;
  install_layout_version?: number;
  agent_config_version?: string;
  installed_at?: string;
  tools: string[];
}

export const LOCKFILE_ENV = "AGENT_CONFIG_INSTALLED_LOCK";
export const SCHEMA_VERSION = 1;

/** Canonical write target for the lockfile (new namespace). */
function _default_lockfile(): string {
  return user_global_paths.write_target("installed.lock");
}

/**
 * Module-level constant retained for back-compat with importers that read
 * `DEFAULT_LOCKFILE` directly. Derived from the helper so the path tracks any
 * future override of `event4u_root()`.
 */
export const DEFAULT_LOCKFILE = _default_lockfile();

const _VERSION_RE = /^\s*agent_config_version\s*:\s*"?([^"\s]+)"?\s*$/;
const _SCHEMA_RE = /^\s*schema_version\s*:\s*(\d+)\s*$/;
const _LAYOUT_RE = /^\s*install_layout_version\s*:\s*(\d+)\s*$/;
const _INSTALLED_AT_RE = /^\s*installed_at\s*:\s*"?([^"\s]+)"?\s*$/;
const _TOOL_RE = /^\s*-\s*([A-Za-z0-9_\-.]+)\s*$/;

/** Expand a leading `~` like Python's `Path.expanduser()`. */
function expanduser(p: string): string {
  if (p === "~") {
    return os.homedir();
  }
  if (p.startsWith("~/") || (process.platform === "win32" && p.startsWith("~\\"))) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

/**
 * Return the active lockfile path for **reads**, honoring overrides.
 *
 * Resolution order:
 *   1. `$AGENT_CONFIG_INSTALLED_LOCK`  — explicit full-path override.
 *   2. `~/.event4u/agent-config/installed.lock` if it exists on disk.
 *   3. `~/.config/agent-config/installed.lock`  (legacy fallback, read-only).
 *   4. Canonical write target under the new namespace (Step 2 fallthrough).
 */
export function lockfile_path(env?: EnvMap | null): string {
  const env_map = env ?? process.env;
  const override = env_map[LOCKFILE_ENV];
  if (override) {
    return expanduser(override);
  }
  const resolved = user_global_paths.resolve_with_fallback("installed.lock", { env: env ?? null });
  if (resolved !== null) {
    return resolved;
  }
  return user_global_paths.write_target("installed.lock", { env: env ?? null });
}

/**
 * Return the canonical write target for the lockfile.
 *
 * Unlike {@link lockfile_path}, this never falls back to the legacy
 * `~/.config/agent-config/` location. Honors the `$AGENT_CONFIG_INSTALLED_LOCK`
 * override for tests, otherwise pins to `~/.event4u/agent-config/installed.lock`.
 */
export function lockfile_write_path(env?: EnvMap | null): string {
  const env_map = env ?? process.env;
  const override = env_map[LOCKFILE_ENV];
  if (override) {
    return expanduser(override);
  }
  return user_global_paths.write_target("installed.lock", { env: env ?? null });
}

/**
 * Parse `path` (or the default) into a dict; return `null` if absent.
 *
 * Tolerates partial / malformed files: missing keys yield missing dict entries
 * rather than throwing, so a hand-edited corrupt file does not brick `init`.
 */
export function read_lockfile(path?: string | null): LockfileData | null {
  const target = path ?? lockfile_path();
  let text: string;
  try {
    text = fs.readFileSync(target, { encoding: "utf-8" });
  } catch {
    return null;
  }

  const data: LockfileData = { tools: [] };
  let in_tools = false;
  for (const raw_line of splitlines(text)) {
    const schema_m = _SCHEMA_RE.exec(raw_line);
    if (schema_m) {
      data.schema_version = Number.parseInt(schema_m[1]!, 10);
      in_tools = false;
      continue;
    }
    const layout_m = _LAYOUT_RE.exec(raw_line);
    if (layout_m) {
      data.install_layout_version = Number.parseInt(layout_m[1]!, 10);
      in_tools = false;
      continue;
    }
    const version_m = _VERSION_RE.exec(raw_line);
    if (version_m) {
      data.agent_config_version = version_m[1]!;
      in_tools = false;
      continue;
    }
    const installed_m = _INSTALLED_AT_RE.exec(raw_line);
    if (installed_m) {
      data.installed_at = installed_m[1]!;
      in_tools = false;
      continue;
    }
    if (raw_line.trim().startsWith("tools:")) {
      in_tools = true;
      continue;
    }
    if (in_tools) {
      const m = _TOOL_RE.exec(raw_line);
      if (m) {
        data.tools.push(m[1]!);
      } else if (
        raw_line.trim() &&
        !(raw_line.startsWith(" ") || raw_line.startsWith("\t") || raw_line.startsWith("-"))
      ) {
        in_tools = false;
      }
    }
  }
  return data;
}

/** `str.splitlines()` — split on `\n`, dropping a trailing empty segment. */
function splitlines(text: string): string[] {
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

function _render(version: string, tools: string[], installed_at: string): string {
  const lines = [
    `schema_version: ${SCHEMA_VERSION}`,
    `install_layout_version: ${INSTALL_LAYOUT_VERSION}`,
    `agent_config_version: "${version}"`,
    `installed_at: "${installed_at}"`,
    "tools:",
  ];
  for (const tool of tools) {
    lines.push(`  - ${tool}`);
  }
  return lines.join("\n") + "\n";
}

/** Atomically write the lockfile; return the path written. */
export function write_lockfile(
  version: string,
  tools: string[],
  options: { path?: string | null; now?: Date | null } = {},
): string {
  const target = options.path ?? lockfile_path();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const stamp = strftime_iso_z(options.now ?? new Date());
  const rendered = _render(version, sorted_unique(tools), stamp);
  // Atomic write: tempfile in the same dir + rename. The same-dir constraint
  // keeps the rename atomic across all POSIX filesystems and Windows when the
  // file already exists.
  const parent = path.dirname(target);
  const { fd, tmp_name } = mkstemp(parent, ".installed.lock.");
  try {
    fs.writeFileSync(fd, rendered, { encoding: "utf-8" });
    fs.closeSync(fd);
    fs.renameSync(tmp_name, target);
  } catch (err) {
    try {
      fs.closeSync(fd);
    } catch {
      // fd may already be closed.
    }
    try {
      fs.unlinkSync(tmp_name);
    } catch {
      // Best-effort cleanup.
    }
    throw err;
  }
  return target;
}

/** Result of {@link migrate_layout}: from/to layout versions + change log. */
export interface MigrateLayoutResult {
  from: number;
  to: number;
  changed: string[];
}

/**
 * Parse the lockfile's `installed_at` stamp back into a UTC Date.
 *
 * Returns `null` when absent or malformed, so a migration falls back to the
 * current time rather than raising on a hand-edited file. Mirrors Python's
 * `datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ")` — strict, UTC, no other
 * formats accepted.
 */
function _parse_installed_at(stamp?: string | null): Date | null {
  if (!stamp) {
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(stamp);
  if (!m) {
    return null;
  }
  const [, y, mo, d, h, mi, s] = m;
  const ms = Date.UTC(
    Number.parseInt(y!, 10),
    Number.parseInt(mo!, 10) - 1,
    Number.parseInt(d!, 10),
    Number.parseInt(h!, 10),
    Number.parseInt(mi!, 10),
    Number.parseInt(s!, 10),
  );
  // strptime rejects out-of-range fields (e.g. month 13) rather than rolling
  // over the way Date.UTC does; reject any value that round-trips differently.
  const parsed = new Date(ms);
  if (
    parsed.getUTCFullYear() !== Number.parseInt(y!, 10) ||
    parsed.getUTCMonth() !== Number.parseInt(mo!, 10) - 1 ||
    parsed.getUTCDate() !== Number.parseInt(d!, 10) ||
    parsed.getUTCHours() !== Number.parseInt(h!, 10) ||
    parsed.getUTCMinutes() !== Number.parseInt(mi!, 10) ||
    parsed.getUTCSeconds() !== Number.parseInt(s!, 10)
  ) {
    return null;
  }
  return parsed;
}

/**
 * Migrate an installed-tree lockfile to the current install-layout ABI.
 *
 * Idempotent. Detects `install_layout_version < INSTALL_LAYOUT_VERSION`
 * (absent = pre-freeze v0) and migrates the on-disk shape in place,
 * preserving the recorded tools, package version, and `installed_at` stamp
 * and re-stamping the layout version.
 *
 * At the freeze baseline (v0 → v1) the only material change is stamping the
 * version — the on-disk shape is unchanged. Future layout versions extend
 * this function with the concrete shape transforms; surgical-uninstall
 * pointers must always be preserved.
 *
 * Returns:
 *   - `null` — no lockfile exists (nothing installed).
 *   - `{from: v, to: v, changed: []}` — already current (no-op).
 *   - `{from: old, to: current, changed: [...]}` — migrated.
 */
export function migrate_layout(
  options: { path?: string | null; now?: Date | null } = {},
): MigrateLayoutResult | null {
  const target = options.path ?? lockfile_write_path();
  const existing = read_lockfile(target);
  if (existing === null) {
    return null;
  }
  const from_v = coerce_layout_version(existing.install_layout_version);
  if (!needs_migration(existing.install_layout_version)) {
    return { from: from_v, to: from_v, changed: [] };
  }
  const version = existing.agent_config_version || current_package_version();
  const tools = [...(existing.tools ?? [])];
  const when = options.now ?? _parse_installed_at(existing.installed_at);
  write_lockfile(version, tools, { path: target, now: when });
  return {
    from: from_v,
    to: INSTALL_LAYOUT_VERSION,
    changed: [`install_layout_version ${from_v} → ${INSTALL_LAYOUT_VERSION}`],
  };
}

/** `sorted(set(tools))` — de-duplicate then sort ascending (codepoint). */
function sorted_unique(tools: string[]): string[] {
  return [...new Set(tools)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Format a Date as `%Y-%m-%dT%H:%M:%SZ` in UTC. */
function strftime_iso_z(now: Date): string {
  // ISO string is `YYYY-MM-DDTHH:MM:SS.sssZ`; drop milliseconds → `...SSZ`.
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** `tempfile.mkstemp` equivalent: exclusive-create a unique sibling, mode 0600. */
function mkstemp(dir: string, prefix: string): { fd: number; tmp_name: string } {
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const tmp_name = path.join(dir, `${prefix}${randomBytes(6).toString("hex")}`);
    try {
      const fd = fs.openSync(tmp_name, "wx", 0o600);
      return { fd, tmp_name };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        continue;
      }
      throw err;
    }
  }
  throw new Error("mkstemp: could not create a unique temp file");
}

/**
 * Compare `installed_version` against the lockfile's recorded version.
 *
 * Returns `[ok, recorded_version_or_null]`:
 *   - `[true, null]`  — no lockfile yet; `init` may proceed.
 *   - `[true, vX]`    — matches; `init` may proceed.
 *   - `[false, vY]`   — mismatch; caller must refuse without `--force`.
 */
export function check_version(
  installed_version: string,
  options: { path?: string | null } = {},
): [boolean, string | null] {
  const existing = read_lockfile(options.path ?? null);
  if (existing === null) {
    return [true, null];
  }
  const recorded = existing.agent_config_version;
  if (!recorded) {
    return [true, null];
  }
  return [recorded === installed_version, recorded];
}

const _SEMVER_RE = /^\s*v?(\d+)\.(\d+)\.(\d+)/;

/**
 * Parse `X.Y.Z[-suffix]` into a `[major, minor, patch]` tuple.
 *
 * Returns `null` when the leading three numeric segments cannot be extracted.
 * Suffixes (`-rc1`, `+build.5`) are ignored.
 */
function _parse_semver(version: string): [number, number, number] | null {
  const match = _SEMVER_RE.exec(version);
  if (!match) {
    return null;
  }
  return [Number.parseInt(match[1]!, 10), Number.parseInt(match[2]!, 10), Number.parseInt(match[3]!, 10)];
}

/**
 * Classify the relationship between recorded and installed versions.
 *
 * Returns one of: `"none"`, `"match"`, `"upgrade"`, `"downgrade"`,
 * `"unparseable"`.
 */
export function classify_mismatch(
  installed_version: string,
  recorded: string | null,
): string {
  if (recorded === null) {
    return "none";
  }
  if (recorded === installed_version) {
    return "match";
  }
  const rec = _parse_semver(recorded);
  const inst = _parse_semver(installed_version);
  if (rec === null || inst === null) {
    return "unparseable";
  }
  if (tuple_lt(rec, inst)) {
    return "upgrade";
  }
  return "downgrade";
}

/** Lexicographic tuple `<` comparison, mirroring Python's tuple ordering. */
function tuple_lt(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i]!;
    const bv = b[i]!;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

/** Read `version` from the package's own `package.json`. */
export function current_package_version(repo_root?: string | null): string {
  let root = repo_root ?? null;
  if (root === null) {
    // __file__ = src/scripts/_lib/installed_lock.ts → repo root is three
    // levels up (_lib → scripts → src → root), i.e. parents[3] in Python.
    const here = path.dirname(fileURLToPath(import.meta.url));
    root = path.resolve(here, "..", "..", "..");
  }
  try {
    const data = JSON.parse(fs.readFileSync(path.join(root, "package.json"), { encoding: "utf-8" }));
    const version = (data as { version?: unknown }).version;
    if (typeof version === "string" && version.trim()) {
      return version.trim();
    }
  } catch {
    // Missing / unreadable / malformed package.json → fall through.
  }
  return "0.0.0";
}

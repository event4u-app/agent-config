#!/usr/bin/env node
/**
 * Permissions-audit entry-gate for the global install tree.
 *
 * TypeScript twin of `src/scripts/lint_global_paths.py` (ADR-094, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract exactly: same policy source,
 * finding messages, finding order, stdout/stderr split, and exit codes.
 *
 * Policy source: src/scripts/expected_perms.json (parameterised so the policy
 * can evolve without code changes).
 *
 * Exit codes:
 *   0  — all checks pass.
 *   1  — at least one finding (printed to stdout, one finding per line).
 *   2  — bad invocation (missing policy, JSON parse error, etc).
 *
 * The script is intentionally read-only — no fixups, no chmod, no creates.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_POLICY = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "expected_perms.json",
);

type PolicyValue =
  | string
  | number
  | boolean
  | null
  | PolicyValue[]
  | { [key: string]: PolicyValue };
type PolicyObject = { [key: string]: PolicyValue };

function _expand(p: string): string {
  return expanduser(p);
}

// Python os.path.expanduser: only a leading `~` (or `~/`) maps to $HOME.
function expanduser(p: string): string {
  if (p === "~") {
    return os.homedir();
  }
  if (p.startsWith("~/") || p.startsWith("~" + path.sep)) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

// "0{S_IMODE(mode):03o}" — leading 0 then 3-octal-digit permission bits.
function _mode_str(mode: number): string {
  const perm = mode & 0o7777;
  return "0" + perm.toString(8).padStart(3, "0");
}

/** Return finding text or null when path is clean. */
function _check_mode(p: string, expected: string, kind: string): string | null {
  let st: fs.Stats;
  try {
    st = fs.lstatSync(p);
  } catch {
    return null; // missing optional paths are silent
  }
  // Python: if not path.exists() → silent. exists() follows symlinks; but we
  // also need stat() for mode. Mirror: existence via stat-follow, mode via
  // path.stat() (follows symlinks too).
  let statFollow: fs.Stats;
  try {
    statFollow = fs.statSync(p);
  } catch {
    // path.exists() is False (broken symlink / gone) → silent.
    void st;
    return null;
  }
  let actual: string;
  try {
    actual = _mode_str(statFollow.mode);
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    return `${p}: stat failed (${msg})`;
  }
  if (actual !== expected) {
    return `${p}: ${kind} mode ${actual} (expected ${expected})`;
  }
  return null;
}

/** All symlinks under `root` must resolve to paths still under `root`. */
function _check_symlinks(root: string): string[] {
  const findings: string[] = [];
  if (!_exists(root)) {
    return findings;
  }
  let rootResolved: string;
  try {
    rootResolved = fs.realpathSync(root);
  } catch {
    rootResolved = path.resolve(root);
  }
  for (const entry of rglobAll(root)) {
    let isLink = false;
    try {
      isLink = fs.lstatSync(entry).isSymbolicLink();
    } catch {
      isLink = false;
    }
    if (!isLink) {
      continue;
    }
    let target: string;
    try {
      // Python Path.resolve(strict=False) — resolve as far as possible.
      target = resolveNonStrict(entry);
    } catch (exc) {
      const msg = exc instanceof Error ? exc.message : String(exc);
      findings.push(`${entry}: symlink resolve failed (${msg})`);
      continue;
    }
    if (!isRelativeTo(target, rootResolved)) {
      findings.push(`${entry}: symlink escapes global root → ${target}`);
    }
  }
  return findings;
}

function _check_glob(
  root: string,
  glob: string,
  expectedMode: string,
  required: boolean,
  kind: string,
): string[] {
  const findings: string[] = [];
  // Globs anchored at ~ are pre-expanded; reduce them to a root-relative
  // pattern.
  const home = os.homedir();
  const patternPath = expanduser(glob);
  let rel: string;
  if (isRelativeTo(patternPath, home)) {
    rel = path.relative(home, patternPath);
  } else {
    rel = patternPath;
  }
  const matches = homeGlob(home, rel);
  if (matches.length === 0 && required) {
    findings.push(`${glob}: required ${kind} missing`);
    return findings;
  }
  for (const match of matches) {
    const finding = _check_mode(match, expectedMode, kind);
    if (finding) {
      findings.push(finding);
    }
  }
  return findings;
}

export function lint(policyPath: string, quiet = false): number {
  let policy: PolicyValue;
  try {
    policy = JSON.parse(fs.readFileSync(policyPath, "utf-8")) as PolicyValue;
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`error: policy load failed: ${msg}\n`);
    return 2;
  }

  const policyObj: PolicyObject = isObject(policy) ? policy : {};
  const findings: string[] = [];

  const rootSpecRaw = policyObj["global_root"];
  const rootSpec: PolicyObject = isObject(rootSpecRaw) ? rootSpecRaw : {};
  const rootPath = _expand(asString(rootSpec["path"], "~/.event4u/agent-config"));
  if (_exists(rootPath)) {
    const finding = _check_mode(
      rootPath,
      asString(rootSpec["expected_mode"], "0700"),
      "directory",
    );
    if (finding) {
      findings.push(finding);
    }
    findings.push(..._check_symlinks(rootPath));
  }

  for (const spec of asArray(policyObj["files"])) {
    if (!isObject(spec)) {
      continue;
    }
    findings.push(
      ..._check_glob(
        rootPath,
        spec["glob"] as string,
        spec["expected_mode"] as string,
        Boolean(spec["required"] ?? false),
        "file",
      ),
    );
  }
  for (const spec of asArray(policyObj["directories"])) {
    if (!isObject(spec)) {
      continue;
    }
    findings.push(
      ..._check_glob(
        rootPath,
        spec["glob"] as string,
        spec["expected_mode"] as string,
        Boolean(spec["required"] ?? false),
        "directory",
      ),
    );
  }

  if (findings.length === 0) {
    if (!quiet) {
      process.stdout.write(`✅ global paths clean (${rootPath})\n`);
    }
    return 0;
  }
  for (const f of findings) {
    process.stdout.write(`❌ ${f}\n`);
  }
  return 1;
}

// --- helpers ---------------------------------------------------------------

function isObject(v: PolicyValue | undefined): v is PolicyObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: PolicyValue | undefined): PolicyValue[] {
  return Array.isArray(v) ? v : [];
}

function asString(v: PolicyValue | undefined, fallback: string): string {
  return typeof v === "string" && v ? v : fallback;
}

function _exists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function isRelativeTo(child: string, base: string): boolean {
  const rel = path.relative(base, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Path.resolve(strict=False): resolve symlinks where possible, otherwise
// return the absolute path with as much resolved as available.
function resolveNonStrict(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/**
 * Recurse over every path under `root` (files + dirs), mirroring
 * `Path.rglob("*")`. Does not follow directory symlinks for traversal
 * (Python rglob does not recurse into symlinked dirs by default behaviour for
 * this script's needs — but it DOES yield the symlink entries themselves).
 */
function rglobAll(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      out.push(full);
      // Recurse into real directories only (do not follow symlinks, matching
      // pathlib.rglob which yields symlinks but does not descend into them).
      let isDir = false;
      try {
        isDir = !ent.isSymbolicLink() && fs.statSync(full).isDirectory();
      } catch {
        isDir = false;
      }
      if (isDir) {
        walk(full);
      }
    }
  };
  walk(root);
  return out;
}

/** Emulate `home.glob(rel)` for the patterns the policy uses (`*`, `**`). */
function homeGlob(home: string, rel: string): string[] {
  const parts = rel.split("/").filter((p) => p.length > 0);
  let current: string[] = [home];
  for (let i = 0; i < parts.length; i += 1) {
    const seg = parts[i] as string;
    const isLast = i === parts.length - 1;
    const next: string[] = [];
    if (seg === "**") {
      // Match zero or more path segments. Collect this dir and all descendant
      // dirs, then continue matching the rest against each.
      for (const base of current) {
        next.push(base);
        next.push(...descendantDirs(base));
      }
    } else if (seg.includes("*") || seg.includes("?")) {
      const re = globSegToRegExp(seg);
      for (const base of current) {
        for (const name of listdir(base)) {
          if (re.test(name)) {
            next.push(path.join(base, name));
          }
        }
      }
    } else {
      for (const base of current) {
        next.push(path.join(base, seg));
      }
    }
    current = next;
    void isLast;
  }
  // Python Path.glob only yields existing paths.
  const existing = current.filter((p) => _exists(p));
  // After a `**` segment the rest is re-matched; for `**/*.key` the `*.key`
  // segment already filtered by name. Deduplicate + return.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of existing) {
    if (!seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }
  return result;
}

function descendantDirs(base: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      let isDir = false;
      try {
        isDir = !ent.isSymbolicLink() && fs.statSync(full).isDirectory();
      } catch {
        isDir = false;
      }
      if (isDir) {
        out.push(full);
        walk(full);
      }
    }
  };
  walk(base);
  return out;
}

function listdir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function globSegToRegExp(seg: string): RegExp {
  let re = "^";
  for (const ch of seg) {
    if (ch === "*") {
      re += "[^/]*";
    } else if (ch === "?") {
      re += "[^/]";
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  re += "$";
  return new RegExp(re);
}

export function main(argv: string[]): number {
  let policy = DEFAULT_POLICY;
  let quiet = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--policy") {
      policy = argv[i + 1] ?? policy;
      i += 1;
    } else if (a === "--quiet") {
      quiet = true;
    }
  }
  return lint(policy, quiet);
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}

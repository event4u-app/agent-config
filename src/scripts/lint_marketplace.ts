#!/usr/bin/env node
/**
 * Lint .claude-plugin/marketplace.json for the event4u/agent-config package.
 *
 * TypeScript twin of `src/scripts/lint_marketplace.py` (ADR-092, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract exactly: same cwd-relative scan
 * roots, finding messages, stdout output, and exit codes.
 *
 * Validates the Claude Code Plugin Marketplace manifest against the canonical
 * manifest shape:
 *
 *   - Required top-level fields: name, owner, metadata, plugins
 *   - owner must have name + email
 *   - metadata must have description + version
 *   - metadata.version must match package.json (single source of truth)
 *   - every plugins[].skills[] entry must exist on disk and carry a SKILL.md
 *   - every SKILL.md on disk under the committed skill sources must be listed
 *     in some plugin's skills[] (drift detection)
 *
 * Exit codes: 0 = clean, 1 = problems found, 3 = internal error.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = ".";
const MARKETPLACE = path.join(ROOT, ".claude-plugin", "marketplace.json");
const PACKAGE_JSON = path.join(ROOT, "package.json");
// Committed marketplace skill sources (git-consumed): real skills resolve to
// dist/agent-src/skills/<name>; command-as-skill entries to the committed
// .claude-plugin/skills/<slug> projection. .claude/skills/ is a gitignored
// local channel and is intentionally NOT a marketplace source.
const SKILL_SOURCE_DIRS = [
  path.join(ROOT, "dist/agent-src", "skills"),
  path.join(ROOT, ".claude-plugin", "skills"),
];

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

function _exists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function isObject(v: JsonValue | undefined): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Python str.removeprefix — strips ONE leading occurrence only.
function removePrefix(s: string, prefix: string): string {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

function fail(errors: string[]): number {
  process.stdout.write("❌  marketplace.json has problems:\n");
  for (const e of errors) {
    process.stdout.write(`  - ${e}\n`);
  }
  return 1;
}

function require_key(
  obj: JsonObject,
  key: string,
  where: string,
  errors: string[],
): boolean {
  if (!(key in obj)) {
    errors.push(`missing key \`${key}\` in ${where}`);
    return false;
  }
  return true;
}

export function main(): number {
  if (!_exists(MARKETPLACE)) {
    process.stdout.write(`❌  ${MARKETPLACE} not found\n`);
    return 1;
  }

  let data: JsonValue;
  try {
    data = JSON.parse(fs.readFileSync(MARKETPLACE, "utf-8")) as JsonValue;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stdout.write(`❌  ${MARKETPLACE} is not valid JSON: ${msg}\n`);
    return 1;
  }

  const errors: string[] = [];
  const root: JsonObject = isObject(data) ? data : {};

  // Top-level required fields
  for (const k of ["name", "owner", "metadata", "plugins"]) {
    require_key(root, k, "marketplace root", errors);
  }

  // Owner
  const owner = root["owner"] ?? {};
  if (isObject(owner)) {
    for (const k of ["name", "email"]) {
      require_key(owner, k, "owner", errors);
    }
  } else {
    errors.push("`owner` must be an object");
  }

  // Metadata + version sync
  const metadata = root["metadata"] ?? {};
  if (isObject(metadata)) {
    for (const k of ["description", "version"]) {
      require_key(metadata, k, "metadata", errors);
    }
    const mpVersion = metadata["version"];
    if (mpVersion && _exists(PACKAGE_JSON)) {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf-8")) as JsonObject;
      const pkgVersion = pkg["version"];
      if (pkgVersion && mpVersion !== pkgVersion) {
        errors.push(
          `metadata.version \`${String(mpVersion)}\` does not match ` +
            `package.json version \`${String(pkgVersion)}\``,
        );
      }
    }
  } else {
    errors.push("`metadata` must be an object");
  }

  // Plugins
  let plugins = root["plugins"] ?? [];
  if (!Array.isArray(plugins) || plugins.length === 0) {
    errors.push("`plugins` must be a non-empty array");
    plugins = [];
  }

  for (let idx = 0; idx < plugins.length; idx += 1) {
    const plugin = plugins[idx] as JsonValue;
    const where = `plugins[${idx}]`;
    if (!isObject(plugin)) {
      errors.push(`${where} must be an object`);
      continue;
    }
    for (const k of ["name", "description", "source", "skills"]) {
      require_key(plugin, k, where, errors);
    }

    const skills = plugin["skills"] ?? [];
    if (!Array.isArray(skills)) {
      errors.push(`${where}.skills must be an array`);
      continue;
    }

    const seen = new Set<string>();
    for (let sIdx = 0; sIdx < skills.length; sIdx += 1) {
      const p = skills[sIdx] as JsonValue;
      const entry = `${where}.skills[${sIdx}]`;
      if (typeof p !== "string") {
        errors.push(`${entry} must be a string`);
        continue;
      }
      if (seen.has(p)) {
        errors.push(`${entry} is a duplicate: \`${p}\``);
      }
      seen.add(p);

      // Resolve path relative to repo root (strip leading "./" only,
      // NOT every "." and "/" character)
      const rel = removePrefix(p, "./");
      const skillDir = path.join(ROOT, rel);
      if (!_exists(skillDir)) {
        errors.push(`${entry} path does not exist: \`${p}\``);
        continue;
      }
      const skillMd = path.join(skillDir, "SKILL.md");
      if (!_exists(skillMd)) {
        errors.push(`${entry} has no SKILL.md: \`${p}\``);
      }
    }
  }

  // Reverse-completeness: every SKILL.md on disk under the committed skill
  // sources (dist/agent-src/skills/ + .claude-plugin/skills/) must appear in
  // some plugin's skills[].
  const listed = new Set<string>();
  for (const plugin of plugins) {
    if (!isObject(plugin)) {
      continue;
    }
    const skills = plugin["skills"];
    if (Array.isArray(skills)) {
      for (const p of skills) {
        if (typeof p === "string") {
          listed.add(removePrefix(p, "./"));
        }
      }
    }
  }

  for (const sourceDir of SKILL_SOURCE_DIRS) {
    if (!_exists(sourceDir)) {
      continue;
    }
    // source_dir.relative_to(ROOT).as_posix() — ROOT is ".", so this is the
    // dir spelled relative to cwd with POSIX separators.
    const prefix = relPosix(sourceDir, ROOT);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(sourceDir, { withFileTypes: true });
    } catch {
      continue;
    }
    // sorted(source_dir.iterdir()) — full-path string sort.
    const dirs = entries
      .map((e) => ({ name: e.name, full: path.join(sourceDir, e.name) }))
      .sort((a, b) => (a.full < b.full ? -1 : a.full > b.full ? 1 : 0));
    for (const d of dirs) {
      if (!_isDir(d.full)) {
        continue;
      }
      if (!_exists(path.join(d.full, "SKILL.md"))) {
        continue;
      }
      const rel = `${prefix}/${d.name}`;
      if (!listed.has(rel)) {
        errors.push(
          "skill exists on disk but is not listed in marketplace.json: " +
            `\`./${rel}\``,
        );
      }
    }
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  const pluginCount = plugins.length;
  let skillCount = 0;
  for (const p of plugins) {
    if (isObject(p) && Array.isArray(p["skills"])) {
      skillCount += p["skills"].length;
    }
  }
  process.stdout.write(
    `✅  marketplace.json (${pluginCount} plugin` +
      `${pluginCount !== 1 ? "s" : ""}, ${skillCount} skills total)\n`,
  );
  process.stdout.write("  No issues found.\n");
  return 0;
}

function _isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function relPosix(child: string, base: string): string {
  return path.relative(base, child).split(path.sep).join("/");
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  try {
    process.exit(main());
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`❌  internal error: ${msg}\n`);
    process.exit(3);
  }
}

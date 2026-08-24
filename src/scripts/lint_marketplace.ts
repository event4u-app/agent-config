#!/usr/bin/env node
/**
 * Lint .claude-plugin/marketplace.json for the event4u/agent-config package.
 *
 * Ported from the retired Python `src/scripts/lint_marketplace.py` (ADR-200, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract exactly: same cwd-relative scan
 * roots, finding messages, stdout output, and exit codes.
 *
 * Validates the Claude Code Plugin Marketplace manifest against the
 * BOOTSTRAP-SHIM shape (road-to-install-path-convergence): the plugin ships
 * ONLY hooks plus a single install-pointer skill — content skills are
 * distributed via the npx file projection, never through this plugin.
 *
 *   - Required top-level fields: name, owner, metadata, plugins
 *   - owner must have name + email
 *   - metadata must have description + version
 *   - metadata.version must match package.json (single source of truth)
 *   - every version field in BOTH .augment-plugin/ manifests matches
 *     package.json too — see check_augment_manifests()
 *   - the union of plugins[].skills[] must be EXACTLY the pointer skill
 *     (./.claude-plugin/skills/install-agent-config) — a repopulated
 *     content-skill list FAILS by design
 *   - the pointer entry must exist on disk and carry a SKILL.md
 *   - .claude-plugin/skills/ on disk must contain ONLY the pointer dir
 *
 * Exit codes: 0 = clean, 1 = problems found, 3 = internal error.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertWatchlistResolves, DeadScopeError } from "./_lib/scan_scope.js";

const ROOT = ".";
const MARKETPLACE = path.join(ROOT, ".claude-plugin", "marketplace.json");
const PACKAGE_JSON = path.join(ROOT, "package.json");
// Bootstrap shim: the ONLY skill the plugin may list. Content skills live in
// the npx file projection (dist/agent-src/skills/ ships in the npm package,
// not through the marketplace). .claude/skills/ is a gitignored local channel
// and is intentionally NOT a marketplace source.
const POINTER_SKILL_ENTRY = "./.claude-plugin/skills/install-agent-config";
const PLUGIN_SKILLS_DIR = path.join(ROOT, ".claude-plugin", "skills");
const POINTER_SKILL_DIRNAME = "install-agent-config";

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

/**
 * Every version field in both `.augment-plugin/` manifests must equal
 * `package.json`'s.
 *
 * WHY THE AUGMENT TWIN IS IN SCOPE OF THIS GATE. Both files ship in the npm
 * tarball — `src/config/publish-surface.json` lists `.augment-plugin/` as a
 * publish root — and both carried `version: 1.0.0` while `package.json` moved
 * to 14.x. Nothing in the tree ever claimed `1.0.0` was an independent
 * plugin-API version: no comment, no test, no doc, and the only reader anywhere
 * is `src/scripts/probe_skill_registration.ts:137`. `plugin.json` had not been
 * touched since 2026-04-17. An unclaimed constant no reader interprets is
 * drift, not a deliberate independent version — so the Augment manifests are
 * treated as the projection counterpart of the `.claude-plugin` twin this gate
 * already version-syncs, and are held to the same rule.
 *
 * Reversible in one commit if that reading is ever wrong, which is why
 * `docs/CLAIMS.md` records the choice rather than leaving it implicit.
 *
 * The nesting differs between the two files, so the fields are enumerated
 * rather than discovered: a recursive "every key named version" walk would
 * silently start policing a future field that is legitimately independent.
 */
export function check_augment_manifests(
  pkgVersion: string,
  errors: string[],
  base: string = ROOT,
): void {
  const targets: Array<[string, string[][]]> = [
    [path.join(base, ".augment-plugin", "plugin.json"), [["version"]]],
    [
      path.join(base, ".augment-plugin", "marketplace.json"),
      [["version"], ["metadata", "version"], ["plugins", "*", "version"]],
    ],
  ];
  for (const [file, paths] of targets) {
    if (!_exists(file)) {
      errors.push(`${file} not found (listed in publish-surface.json roots)`);
      continue;
    }
    let data: JsonValue;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf-8")) as JsonValue;
    } catch (e) {
      errors.push(`${file} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    for (const keys of paths) {
      for (const [label, value] of _resolveVersionField(data, keys)) {
        if (value !== pkgVersion) {
          errors.push(
            `${file}: ${label} \`${String(value)}\` does not match ` +
              `package.json version \`${pkgVersion}\``,
          );
        }
      }
    }
  }
}

/** Resolve a key path, expanding `*` over array indices. Returns [label, value]. */
function _resolveVersionField(
  data: JsonValue,
  keys: readonly string[],
  prefix = "",
): Array<[string, JsonValue | undefined]> {
  if (keys.length === 0) {
    return [[prefix.replace(/^\./, ""), data]];
  }
  const [head, ...rest] = keys as [string, ...string[]];
  if (head === "*") {
    if (!Array.isArray(data)) {
      return [[`${prefix}[*]`.replace(/^\./, ""), undefined]];
    }
    return data.flatMap((item, i) => _resolveVersionField(item, rest, `${prefix}[${String(i)}]`));
  }
  if (!isObject(data)) {
    return [[`${prefix}.${head}`.replace(/^\./, ""), undefined]];
  }
  return _resolveVersionField(data[head] ?? null, rest, `${prefix}.${head}`);
}

export function main(): number {
  // No corpus to count — the shim is exactly one manifest plus one pointer
  // skill, and every count the shape offers (plugins, skill entries, dirs under
  // .claude-plugin/skills/) is a value an existing negative case drives to zero
  // on purpose. What CAN vanish is the fixed set of paths this resolves against
  // cwd, so the watch list is the honest guard: run from the wrong directory
  // and the gate now says so instead of reporting a missing manifest.
  try {
    assertWatchlistResolves({
      gate: "lint_marketplace",
      candidates: [
        ".claude-plugin/marketplace.json",
        ".augment-plugin/plugin.json",
        ".augment-plugin/marketplace.json",
        "package.json",
        `${POINTER_SKILL_ENTRY.replace(/^\.\//, "")}/SKILL.md`,
      ],
      repoRoot: path.resolve(ROOT),
    });
  } catch (exc) {
    if (exc instanceof DeadScopeError) {
      process.stdout.write(`❌  ${exc.message}\n`);
      return 1;
    }
    throw exc;
  }

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
      if (typeof pkgVersion === "string") {
        check_augment_manifests(pkgVersion, errors);
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

      // Bootstrap-shim invariant: any entry other than the pointer skill is
      // a repopulated content-skill list and must FAIL.
      if (p !== POINTER_SKILL_ENTRY) {
        errors.push(
          `${entry} violates the bootstrap shim: the plugin must not ship ` +
            `content skills (only \`${POINTER_SKILL_ENTRY}\` is allowed), ` +
            `got \`${p}\` — content is distributed via ` +
            "`npx -y @event4u/agent-config init`",
        );
        continue;
      }

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

  // Shim completeness: the pointer skill must be listed by some plugin.
  const listed = new Set<string>();
  for (const plugin of plugins) {
    if (!isObject(plugin)) {
      continue;
    }
    const skills = plugin["skills"];
    if (Array.isArray(skills)) {
      for (const p of skills) {
        if (typeof p === "string") {
          listed.add(p);
        }
      }
    }
  }
  if (plugins.length > 0 && !listed.has(POINTER_SKILL_ENTRY)) {
    errors.push(
      `bootstrap shim: pointer skill \`${POINTER_SKILL_ENTRY}\` is not ` +
        "listed in any plugin's skills[]",
    );
  }

  // Shim disk shape: .claude-plugin/skills/ must contain ONLY the pointer
  // dir — a repopulated symlink tree (e.g. from a stale generator) FAILS.
  if (_exists(PLUGIN_SKILLS_DIR)) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(PLUGIN_SKILLS_DIR, { withFileTypes: true });
    } catch {
      /* unreadable → nothing to assert */
    }
    const extra = entries
      .filter((e) => _isDir(path.join(PLUGIN_SKILLS_DIR, e.name)))
      .map((e) => e.name)
      .filter((name) => name !== POINTER_SKILL_DIRNAME)
      .sort();
    for (const name of extra) {
      errors.push(
        "bootstrap shim: unexpected skill dir on disk (plugin ships no " +
          `content skills): \`.claude-plugin/skills/${name}\` — remove it ` +
          "or re-run the generator",
      );
    }
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  const pluginCount = plugins.length;
  process.stdout.write(
    `✅  marketplace.json (${pluginCount} plugin` +
      `${pluginCount !== 1 ? "s" : ""}, bootstrap shim: 1 pointer skill)\n`,
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

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const isCliEntry =
  _isCliEntry();
if (isCliEntry) {
  try {
    process.exit(main());
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    process.stderr.write(`❌  internal error: ${msg}\n`);
    process.exit(3);
  }
}

/**
 * Per-tool inventory of files written by global deploys — and stale reaping.
 *
 * TypeScript twin of `src/scripts/_lib/global_deploy_inventory.py` (ADR-200 —
 * Python→TS migration, Phase 2 / Wave 2a). Public API mirrors the Python
 * module exactly (snake_case kept deliberately), including the JSON
 * serialization shape (`indent=2, sort_keys=True` + trailing newline) and the
 * inventory-walk / orphan-reap semantics.
 *
 * Sidecar at `~/.event4u/agent-config/deployed-files.json`. Records, per tool,
 * the anchor directory and the relative paths of every file the most recent
 * global deploy maintains there. On the next deploy the previous inventory is
 * diffed against the current expected file set and **only** previously-recorded,
 * now-orphaned files are deleted.
 *
 * Why this exists (2026-06 Zed fix follow-up): deploy anchors are SHARED
 * directories — `~/.agents/skills/` holds the user's own Zed skills next to
 * agent-config's deployed bundle, `~/.claude/commands/` holds user-authored
 * commands. A naive "delete everything not in the source" sync would destroy
 * user files, so the installer historically deleted nothing — and renamed or
 * removed package skills rotted in place. The inventory provides the ownership
 * proof that makes reaping safe: a path is deleted only if a previous
 * agent-config deploy recorded writing it AND the current deploy no longer
 * ships it.
 *
 * Safety properties:
 *
 * - Never deletes a path that was not recorded by a previous deploy.
 * - Never deletes outside the recorded anchor (resolved containment check).
 * - Never deletes directories — only files/symlinks, then prunes empty dirs.
 * - Anchor moved between installs → no reaping (the old tree is unknown
 *   territory; the new inventory simply replaces the record).
 * - Missing / corrupt inventory → no reaping (first run records only).
 *
 * Schema (JSON):
 *
 *     {
 *       "schema_version": 1,
 *       "tools": {
 *         "<tool_id>": {
 *           "anchor": "/abs/path/to/anchor",
 *           "files": ["skills/foo/SKILL.md", ...]   // anchor-relative, sorted
 *         }
 *       }
 *     }
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import * as user_global_paths from "./user_global_paths.js";

export type EnvMap = Record<string, string | undefined>;

/** Loosely-typed inventory dict, mirroring Python's `dict`. */
export type Inventory = Record<string, unknown>;

export const SCHEMA_VERSION = 1;
export const INVENTORY_BASENAME = "deployed-files.json";
export const INVENTORY_ENV = "AGENT_CONFIG_DEPLOY_INVENTORY";

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
 * Resolve a path the way `Path.resolve()` does: expand-free `realpath`-style
 * resolution that follows existing symlinks and normalises `..`, but does not
 * fail when the path does not exist (the trailing non-existent components are
 * resolved lexically). Used for containment checks and anchor comparison.
 */
function resolve_path(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    // Path (or a parent) does not exist — resolve lexically against the
    // longest existing prefix, mirroring Python's strict=False resolve.
    const abs = path.resolve(p);
    const parts = abs.split(path.sep);
    // Find the longest existing ancestor, realpath it, then re-append the
    // remaining (non-existent) components.
    for (let i = parts.length; i > 0; i -= 1) {
      const prefix = parts.slice(0, i).join(path.sep) || path.sep;
      try {
        const real = fs.realpathSync(prefix);
        const rest = parts.slice(i);
        return rest.length > 0 ? path.join(real, ...rest) : real;
      } catch {
        continue;
      }
    }
    return abs;
  }
}

/** Python `Path.exists()` — follows symlinks; False for a dangling symlink. */
function path_exists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Canonical inventory location, honoring the test/env override. */
export function inventory_path(env?: EnvMap | null): string {
  const env_map = env ?? process.env;
  const override = env_map[INVENTORY_ENV];
  if (override) {
    return expanduser(override);
  }
  return user_global_paths.write_target(INVENTORY_BASENAME, { env: env ?? null });
}

/** Read the inventory; missing or malformed files yield an empty shell. */
export function load_inventory(p?: string | null): Inventory {
  const target = p ?? inventory_path();
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(target, { encoding: "utf-8" }));
  } catch {
    return { schema_version: SCHEMA_VERSION, tools: {} };
  }
  if (
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data) ||
    typeof (data as Inventory)["tools"] !== "object" ||
    (data as Inventory)["tools"] === null ||
    Array.isArray((data as Inventory)["tools"])
  ) {
    return { schema_version: SCHEMA_VERSION, tools: {} };
  }
  return data as Inventory;
}

/** Atomically write the inventory (tempfile + rename). */
export function save_inventory(data: Inventory, p?: string | null): string {
  const target = p ?? inventory_path();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const payload = json_dumps_sorted(data, 2) + "\n";
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  const parent = path.dirname(target);
  let fd: number | null = null;
  let tmp_name = "";
  for (let attempt = 0; attempt < 32; attempt += 1) {
    tmp_name = path.join(parent, `${path.basename(target)}.${randomBytes(6).toString("hex")}`);
    try {
      fd = fs.openSync(tmp_name, "wx", 0o600);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        continue;
      }
      throw err;
    }
  }
  if (fd === null) {
    throw new Error("save_inventory: could not create a unique temp file");
  }
  try {
    fs.writeFileSync(fd, payload, { encoding: "utf-8" });
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

/**
 * Serialize like Python's `json.dumps(data, indent=2, sort_keys=True)`.
 * Object keys are emitted in sorted order; arrays keep their order; non-ASCII
 * characters are `\uXXXX`-escaped (Python's `ensure_ascii=True` default).
 * Mirrors Python's separators for `indent` mode (`","` line separator, `": "`
 * key separator).
 */
function json_dumps_sorted(value: unknown, indent: number): string {
  return render_json(value, indent, 0);
}

function render_json(value: unknown, indent: number, depth: number): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return json_string_ascii(value);
  }
  const pad = " ".repeat(indent * (depth + 1));
  const close_pad = " ".repeat(indent * depth);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((v) => pad + render_json(v, indent, depth + 1));
    return "[\n" + items.join(",\n") + "\n" + close_pad + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (keys.length === 0) {
      return "{}";
    }
    const items = keys.map(
      (k) => pad + json_string_ascii(k) + ": " + render_json(obj[k], indent, depth + 1),
    );
    return "{\n" + items.join(",\n") + "\n" + close_pad + "}";
  }
  // Fallback for unsupported types (undefined, function) — Python would raise;
  // here we coerce to null to avoid producing invalid JSON.
  return "null";
}

/**
 * JSON-encode a string the way Python's `json.dumps(s, ensure_ascii=True)`
 * does: standard escapes plus `\uXXXX` for any codepoint > 0x7e. Astral
 * codepoints are emitted as UTF-16 surrogate pairs, matching CPython.
 */
function json_string_ascii(s: string): string {
  // JSON.stringify handles the standard escapes (\", \\, \n, \t, control
  // chars) and surrogate-pair structure; we then escape any remaining
  // non-ASCII code units to \uXXXX, which is exactly Python's ensure_ascii.
  const base = JSON.stringify(s);
  let out = "";
  for (let i = 0; i < base.length; i += 1) {
    const code = base.charCodeAt(i);
    if (code > 0x7e) {
      out += "\\u" + code.toString(16).padStart(4, "0");
    } else {
      out += base[i];
    }
  }
  return out;
}

/**
 * Anchor-relative paths the deploy of `src` → `<anchor>/<dest_rel>` maintains
 * — written OR skipped-as-identical.
 *
 * Mirrors the traversal of `install._copy_dir_dereferencing_symlinks`:
 * symlinked files resolve to file entries, symlinked subdirectories are walked
 * through their resolved targets. `dest_rel` may be empty (`""`) for plan
 * entries that deploy into the anchor root.
 */
export function expected_deploy_files(src: string, dest_rel: string): Set<string> {
  const out = new Set<string>();
  let src_stat: fs.Stats;
  try {
    src_stat = fs.statSync(src);
  } catch {
    // Source does not exist (or a broken symlink) → empty set.
    return out;
  }
  if (!src_stat.isDirectory()) {
    out.add(as_posix(dest_rel));
    return out;
  }

  const _walk = (node: string, prefix: string): void => {
    const entries = fs.readdirSync(node).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const name of entries) {
      const entry = path.join(node, name);
      const rel = join_rel(prefix, name);
      const lst = fs.lstatSync(entry);
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        _walk(entry, rel);
        continue;
      }
      // Resolve the entry; symlinked dirs are walked through their target.
      let resolved_is_dir = false;
      try {
        resolved_is_dir = fs.statSync(entry).isDirectory();
      } catch {
        resolved_is_dir = false;
      }
      if (resolved_is_dir) {
        _walk(fs.realpathSync(entry), rel);
        continue;
      }
      out.add(as_posix(rel));
    }
  };

  _walk(src, dest_rel);
  return out;
}

/** Join a prefix path fragment with a child name, tolerating an empty prefix. */
function join_rel(prefix: string, name: string): string {
  return prefix ? path.join(prefix, name) : name;
}

/** Convert a path to POSIX (forward-slash) form, like `PurePath.as_posix()`. */
function as_posix(p: string): string {
  if (p === "") {
    // Python's `Path('').as_posix()` is `"."`.
    return ".";
  }
  return p.split(path.sep).join("/");
}

/**
 * Delete previously-deployed files that the current deploy dropped.
 *
 * Returns the absolute paths actually deleted. Mutates nothing in `inventory`
 * — callers record the new state via {@link record_deploy}.
 *
 * `dry_run=true` computes and returns the would-delete set (only paths that
 * currently exist on disk) WITHOUT unlinking anything or pruning empty
 * directories — the preview surface for `install.py --dry-run`. The selection
 * logic (orphan diff, containment proof, directory guard) is identical to the
 * live path, so the preview is exact.
 */
export function reap_stale(
  tool_id: string,
  anchor: string,
  current_files: Set<string>,
  inventory: Inventory,
  dry_run = false,
): string[] {
  const tools = (inventory["tools"] as Record<string, unknown> | undefined) ?? {};
  const entry = tools[tool_id];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return [];
  }
  const e = entry as Record<string, unknown>;
  const recorded_anchor = e["anchor"];
  const prev_files = e["files"];
  if (typeof recorded_anchor !== "string" || !Array.isArray(prev_files)) {
    return [];
  }
  const anchor_resolved = resolve_path(expanduser(anchor));
  if (resolve_path(expanduser(recorded_anchor)) !== anchor_resolved) {
    // Anchor moved between installs — the old tree is not provably ours
    // anymore; record-only, never delete.
    return [];
  }

  const deleted: string[] = [];
  const prune_candidates = new Set<string>();
  const orphans = difference(prev_files as unknown[], current_files);
  for (const rel of sorted_strings(orphans)) {
    if (typeof rel !== "string" || !rel || rel.startsWith("/") || rel.startsWith("..")) {
      continue;
    }
    const target = path.join(anchor_resolved, rel);
    try {
      // Containment proof: the path (sans final component, which may be a
      // dangling symlink) must stay inside the anchor.
      relative_to(resolve_path(path.dirname(target)), anchor_resolved);
    } catch {
      continue;
    }
    let lst: fs.Stats | null = null;
    try {
      lst = fs.lstatSync(target);
    } catch {
      lst = null;
    }
    if (lst && lst.isDirectory() && !lst.isSymbolicLink()) {
      continue; // never delete directories
    }
    if (dry_run) {
      // Preview: report only what is actually on disk and would go.
      if (path_exists(target) || (lst !== null && lst.isSymbolicLink())) {
        deleted.push(target);
      }
      continue;
    }
    try {
      fs.unlinkSync(target);
    } catch {
      continue;
    }
    deleted.push(target);
    prune_candidates.add(path.dirname(target));
  }

  prune_empty_dirs(prune_candidates, anchor_resolved);
  return deleted;
}

/**
 * Marker-based reaping of package-tagged orphans — runs EVERY deploy.
 *
 * This is the self-healing reaping path, complementary to {@link reap_stale}
 * (which can only diff against the *previous* inventory). It is the **only**
 * path with ownership proof independent of inventory history: every deployed
 * `.md` carries the injected `package:` frontmatter tag (install P5.1), so a
 * tagged file absent from the current bundle is provably our orphan regardless
 * of whether any inventory ever recorded it.
 *
 * Why it must run every deploy, not just on first-run: an install that
 * predates the inventory sidecar never recorded its files, so once a tool
 * *does* get an inventory entry, {@link reap_stale} has no record of those
 * legacy files to diff against — they would rot forever (the renamed skills,
 * retired command-as-skill entries, 2026-05-13 colon-named shapes, and
 * post-6.0.0 command renames like `create-pr` → `pr/create`). Running this
 * sweep unconditionally closes that gap; it is idempotent (a clean tree yields
 * no deletions).
 *
 * Deletes `.md` files under `<anchor>/<dest_sub>` that (a) carry
 * `package: <package_tag>` in their frontmatter and (b) are not in the current
 * expected file set; then prunes empty directories. Untagged files
 * (user-authored skills in shared anchors) are never touched. Returns the
 * absolute paths deleted.
 *
 * `dry_run=true` returns the would-delete set (tagged orphans actually present
 * on disk) WITHOUT unlinking or pruning — the preview surface for
 * `install.py --dry-run`. Selection logic is identical to the live path.
 */
export function reap_tagged_orphans(
  anchor: string,
  dest_subs: string[],
  current_files: Set<string>,
  package_tag: string,
  dry_run = false,
): string[] {
  const anchor_resolved = resolve_path(expanduser(anchor));
  const deleted: string[] = [];
  const prune_candidates = new Set<string>();
  const needle = `package: ${package_tag}`;
  for (const dest_sub of dest_subs) {
    const root = dest_sub ? path.join(anchor_resolved, dest_sub) : anchor_resolved;
    let root_stat: fs.Stats;
    try {
      root_stat = fs.statSync(root);
    } catch {
      continue;
    }
    if (!root_stat.isDirectory()) {
      continue;
    }
    for (const md of rglob_md(root)) {
      let md_lst: fs.Stats;
      try {
        md_lst = fs.lstatSync(md);
      } catch {
        continue;
      }
      if (md_lst.isDirectory()) {
        continue;
      }
      const rel = relative_to_posix(md, anchor_resolved);
      if (current_files.has(rel)) {
        continue;
      }
      try {
        relative_to(resolve_path(path.dirname(md)), anchor_resolved);
      } catch {
        continue;
      }
      let head: string;
      try {
        head = fs.readFileSync(md, { encoding: "utf-8" });
      } catch {
        continue;
      }
      if (!head.startsWith("---")) {
        continue;
      }
      const end = head.indexOf("\n---", 3);
      const block = head.slice(0, end !== -1 ? end : head.length);
      const hit = splitlines(block).some((line) => line.trim() === needle);
      if (!hit) {
        continue;
      }
      if (dry_run) {
        deleted.push(md);
        continue;
      }
      try {
        fs.unlinkSync(md);
      } catch {
        continue;
      }
      deleted.push(md);
      prune_candidates.add(path.dirname(md));
    }
  }
  prune_empty_dirs(prune_candidates, anchor_resolved);
  return deleted;
}

/**
 * Upsert the tool's inventory entry; returns the mutated inventory.
 *
 * `anchor` is stored AS GIVEN — pass the unexpanded form (`~/.agents/`) so the
 * inventory content stays identical across machines/homes (GUI/CLI parity) and
 * survives a home relocation. {@link reap_stale} expands the recorded value at
 * comparison time.
 */
export function record_deploy(
  tool_id: string,
  anchor: string,
  current_files: Set<string>,
  inventory: Inventory,
): Inventory {
  if (
    typeof inventory["tools"] !== "object" ||
    inventory["tools"] === null ||
    Array.isArray(inventory["tools"])
  ) {
    inventory["tools"] = {};
  }
  const tools = inventory["tools"] as Record<string, unknown>;
  tools[tool_id] = {
    anchor: String(anchor),
    files: sorted_strings([...current_files]),
  };
  inventory["schema_version"] = SCHEMA_VERSION;
  return inventory;
}

// --- helpers ---------------------------------------------------------------

/** Prune now-empty directories up to (exclusive) the anchor. */
function prune_empty_dirs(prune_candidates: Set<string>, anchor_resolved: string): void {
  const ordered = [...prune_candidates].sort(
    (a, b) => b.split(path.sep).length - a.split(path.sep).length,
  );
  for (const start of ordered) {
    let node = start;
    while (node !== anchor_resolved && is_ancestor(anchor_resolved, node)) {
      try {
        fs.rmdirSync(node); // only succeeds when empty
      } catch {
        break;
      }
      node = path.dirname(node);
    }
  }
}

/** `anchor in node.parents` — is `anchor` a strict ancestor of `node`? */
function is_ancestor(anchor: string, node: string): boolean {
  const rel = path.relative(anchor, node);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** `child.relative_to(parent)` — throws if `child` is not inside `parent`. */
function relative_to(child: string, parent: string): string {
  if (child === parent) {
    return "";
  }
  const rel = path.relative(parent, child);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`'${child}' is not in the subpath of '${parent}'`);
  }
  return rel;
}

/** Anchor-relative POSIX path of `child` under `parent`. */
function relative_to_posix(child: string, parent: string): string {
  return path.relative(parent, child).split(path.sep).join("/");
}

/** Recursively collect all `*.md` files under `root` (deterministic order). */
function rglob_md(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let names: string[];
    try {
      names = fs.readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      let lst: fs.Stats;
      try {
        lst = fs.lstatSync(full);
      } catch {
        continue;
      }
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        walk(full);
      } else if (name.endsWith(".md")) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

/** `set(prev) - current` over string members. */
function difference(prev: unknown[], current: Set<string>): unknown[] {
  const seen = new Set<unknown>();
  const out: unknown[] = [];
  for (const item of prev) {
    if (typeof item === "string" && current.has(item)) {
      continue;
    }
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** Sort string members ascending by codepoint (non-strings filtered out). */
function sorted_strings(items: unknown[]): string[] {
  return items
    .filter((i): i is string => typeof i === "string")
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** `str.splitlines()` — split on `\n`, dropping a trailing empty segment. */
function splitlines(text: string): string[] {
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

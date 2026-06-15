#!/usr/bin/env node
/**
 * Pack dependency + pack-graph lints.
 *
 * TypeScript twin of `src/scripts/lint_pack_dependencies.py` (ADR-200,
 * Phase 4 / Wave 4b). Mirrors the Python CLI contract exactly: same checks,
 * finding messages, stdout/stderr split, and exit codes.
 *
 * Two checks across pack homes (src/packs/, src/domains/, legacy packages/):
 *   1. Dependency drift — the `dependencies` block stored in each pack.yaml
 *      must equal the block re-derived from the pack's command/rule
 *      frontmatter (`skills:` / `rules:`).
 *   2. Pack-graph is a DAG — the union of every pack's `requires` (plus any
 *      `dependencies.packs`) must be acyclic.
 *
 * Exit codes: 0 = clean · 1 = drift and/or a cycle · 3 = internal error.
 *
 * The Python original imports generate_pack_manifests (`gpm`) for the manifest
 * derivation. `gpm` has no TS twin yet (out of this batch's scope), so the
 * needed gpm internals are ported as private helpers below, mirroring the
 * Python source 1:1. They are prefixed `_gpm_` to mark their provenance.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { SRC_AGENT, iter_all_sources } from "./_lib/agent_src.js";

// src/scripts/lint_pack_dependencies.ts → two levels up is the repo root.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACKAGES = path.join(REPO, "packages");
const SRC_DOMAINS = path.join(REPO, "src", "domains");
const SRC_PACKS = path.join(REPO, "src", "packs");
const PACKS_VOCAB = path.join(REPO, "src", "config", "discovery", "packs.yml");
const PACKAGE_JSON = path.join(REPO, "package.json");

type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue };
type YamlObject = { [key: string]: YamlValue };

function isObject(v: unknown): v is YamlObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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

function _exists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

function relPosix(child: string, base: string): string {
  return path.relative(base, child).split(path.sep).join("/");
}

// ===== ported gpm internals =================================================

function _gpm_load_yaml(p: string): YamlValue {
  if (!_exists(p)) {
    return null;
  }
  return parseYaml(fs.readFileSync(p, "utf-8"), { version: "1.1" }) as YamlValue;
}

function _gpm_read_frontmatter(p: string): YamlObject {
  const text = fs.readFileSync(p, "utf-8");
  if (!text.startsWith("---")) {
    return {};
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    return {};
  }
  let data: YamlValue;
  try {
    data = parseYaml(text.slice(4, end), { version: "1.1" }) as YamlValue;
  } catch {
    return {};
  }
  return isObject(data) ? data : {};
}

function _gpm_pack_id_from_dir(pkgDir: string): string {
  const name = path.basename(pkgDir);
  return name === "core" ? "core" : removePrefix(name, "pack-");
}

function removePrefix(s: string, prefix: string): string {
  return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

type PackHome = [string, string, "core" | "flat" | "physical"];

function _gpm_pack_homes(): PackHome[] {
  const homes: PackHome[] = [];
  const seen = new Set<string>();
  if (_isDir(SRC_AGENT())) {
    homes.push(["core", path.join(SRC_PACKS, "core"), "core"]);
    seen.add("core");
  }
  for (const parent of [SRC_PACKS, SRC_DOMAINS]) {
    if (!_isDir(parent)) {
      continue;
    }
    for (const d of sortedDirEntries(parent)) {
      const full = path.join(parent, d);
      if (!_isDir(full) || d.startsWith("_")) {
        continue;
      }
      const pid = d;
      if (seen.has(pid)) {
        continue;
      }
      homes.push([pid, full, "flat"]);
      seen.add(pid);
    }
  }
  if (_exists(PACKAGES)) {
    for (const pkg of sortedDirEntries(PACKAGES)) {
      const full = path.join(PACKAGES, pkg);
      if (!_isDir(full)) {
        continue;
      }
      const pid = _gpm_pack_id_from_dir(full);
      if (seen.has(pid)) {
        continue;
      }
      homes.push([pid, full, "physical"]);
      seen.add(pid);
    }
  }
  return homes;
}

function sortedDirEntries(dir: string): string[] {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
}

function _gpm_vocab_lookup(
  packsVocab: YamlValue,
): Record<string, YamlObject> {
  const out: Record<string, YamlObject> = {};
  if (Array.isArray(packsVocab)) {
    for (const p of packsVocab) {
      if (isObject(p) && typeof p["id"] === "string") {
        out[p["id"]] = p;
      }
    }
  }
  return out;
}

function _gpm_package_version(): string {
  if (!_exists(PACKAGE_JSON)) {
    return "0.0.0";
  }
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf-8")) as YamlObject;
  const v = pkg["version"];
  return typeof v === "string" ? v : "0.0.0";
}

interface ArtefactRecord {
  path: string;
  name: string;
  description: string;
  category: string;
  skills: string[];
  rules: string[];
}

function _gpm_category_from_logical(logicalRel: string): string {
  const top = logicalRel.split("/", 1)[0] ?? logicalRel;
  const mapping: Record<string, string> = {
    skills: "skill",
    rules: "rule",
    commands: "command",
    personas: "persona",
    guidelines: "guideline",
    contexts: "context",
    presets: "preset",
    profiles: "profile",
  };
  return mapping[top] ?? top;
}

function _gpm_artefact_record(
  p: string,
  logicalRel: string,
  fm: YamlObject,
): ArtefactRecord {
  const nameField = fm["name"];
  const name =
    (typeof nameField === "string" && nameField) ||
    (path.basename(p) === "SKILL.md"
      ? path.basename(path.dirname(p))
      : stem(p));
  const descField = fm["description"];
  const description =
    typeof descField === "string" ? descField.trim() : "";
  return {
    path: logicalRel,
    name,
    description,
    category: _gpm_category_from_logical(logicalRel),
    skills: asStringList(fm["skills"]),
    rules: asStringList(fm["rules"]),
  };
}

function stem(p: string): string {
  const base = path.basename(p);
  const ext = path.extname(base);
  return ext ? base.slice(0, base.length - ext.length) : base;
}

function asStringList(v: YamlValue | undefined): string[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.filter((x): x is string => typeof x === "string");
}

function _gpm_collect_physical(pkgDir: string): ArtefactRecord[] {
  const srcRoot = path.join(pkgDir, ".agent-src.uncondensed");
  if (!_isDir(srcRoot)) {
    return [];
  }
  const items: ArtefactRecord[] = [];
  for (const p of rglobMd(srcRoot)) {
    if (!_isFile(p)) {
      continue;
    }
    const fm = _gpm_read_frontmatter(p);
    if (Object.keys(fm).length === 0) {
      continue;
    }
    items.push(_gpm_artefact_record(p, relPosix(p, srcRoot), fm));
  }
  return items;
}

function _gpm_collect_core(): ArtefactRecord[] {
  const items: ArtefactRecord[] = [];
  const seen = new Set<string>();
  if (_isDir(SRC_AGENT())) {
    for (const p of rglobMd(SRC_AGENT())) {
      if (!_isFile(p)) {
        continue;
      }
      const fm = _gpm_read_frontmatter(p);
      if (Object.keys(fm).length === 0) {
        continue;
      }
      const logical = relPosix(p, SRC_AGENT());
      seen.add(logical);
      items.push(_gpm_artefact_record(p, logical, fm));
    }
  }
  for (const rec of _gpm_collect_flat("core")) {
    if (!seen.has(rec.path)) {
      seen.add(rec.path);
      items.push(rec);
    }
  }
  return items;
}

function _gpm_collect_flat(pid: string): ArtefactRecord[] {
  const items: ArtefactRecord[] = [];
  const seen = new Set<string>();
  for (const [phys, logical] of iter_all_sources()) {
    if (!logical.endsWith(".md") || seen.has(logical)) {
      continue;
    }
    const fm = _gpm_read_frontmatter(phys);
    if (Object.keys(fm).length === 0) {
      continue;
    }
    const packs = fm["packs"];
    if (Array.isArray(packs) && packs.includes(pid)) {
      seen.add(logical);
      items.push(_gpm_artefact_record(phys, logical, fm));
    }
  }
  items.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return items;
}

function _gpm_collect_artefacts(
  pid: string,
  homeDir: string,
  mode: "core" | "flat" | "physical",
): ArtefactRecord[] {
  if (mode === "core") {
    return _gpm_collect_core();
  }
  if (mode === "physical") {
    return _gpm_collect_physical(homeDir);
  }
  return _gpm_collect_flat(pid);
}

/** Re-derive only the `dependencies` block (the only field this lint uses). */
function _gpm_build_dependencies(
  artefacts: ArtefactRecord[],
): { skills: string[]; rules: string[] } {
  const depSkills = new Set<string>();
  const depRules = new Set<string>();
  for (const a of artefacts) {
    for (const s of a.skills) {
      depSkills.add(s);
    }
    for (const r of a.rules) {
      depRules.add(r);
    }
  }
  return {
    skills: [...depSkills].sort(),
    rules: [...depRules].sort(),
  };
}

function rglobMd(root: string): string[] {
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
      if (ent.name.endsWith(".md")) {
        out.push(full);
      }
      if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
        walk(full);
      }
    }
  };
  walk(root);
  out.sort();
  return out;
}

// ===== lint checks ==========================================================

function _dependency_drift(): string[] {
  const errors: string[] = [];
  for (const [pid, homeDir, mode] of _gpm_pack_homes()) {
    const manifest = path.join(homeDir, "pack.yaml");
    if (!_exists(manifest)) {
      continue;
    }
    const artefacts = _gpm_collect_artefacts(pid, homeDir, mode);
    const expected = _gpm_build_dependencies(artefacts);
    let onDisk: YamlObject;
    try {
      const loaded = _gpm_load_yaml(manifest);
      const obj: YamlObject = isObject(loaded) ? loaded : {};
      const deps = obj["dependencies"];
      onDisk = isObject(deps) ? deps : {};
    } catch (exc) {
      const msg = exc instanceof Error ? exc.message : String(exc);
      errors.push(`${manifest}: cannot parse — ${msg}`);
      continue;
    }
    for (const kind of ["skills", "rules"] as const) {
      const exp = [...(expected[kind] ?? [])].sort();
      const got = asStringList(onDisk[kind]).slice().sort();
      if (!arraysEqual(exp, got)) {
        const missing = exp.filter((x) => !got.includes(x)).sort();
        const extra = got.filter((x) => !exp.includes(x)).sort();
        const detail: string[] = [];
        if (missing.length > 0) {
          detail.push(`missing ${pyListRepr(missing)}`);
        }
        if (extra.length > 0) {
          detail.push(`stale ${pyListRepr(extra)}`);
        }
        errors.push(
          `${manifest}: dependencies.${kind} drift (${detail.join("; ")}) ` +
            "— run `task generate-pack-manifests`",
        );
      }
    }
  }
  return errors;
}

function _pack_requires_graph(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const [, homeDir] of _gpm_pack_homes()) {
    const manifest = path.join(homeDir, "pack.yaml");
    if (!_exists(manifest)) {
      continue;
    }
    let data: YamlObject;
    try {
      const loaded = _gpm_load_yaml(manifest);
      data = isObject(loaded) ? loaded : {};
    } catch {
      continue;
    }
    const idField = data["id"];
    const pid = typeof idField === "string" ? idField : path.basename(homeDir);
    const edges = new Set<string>(asStringList(data["requires"]));
    const deps = data["dependencies"];
    if (isObject(deps)) {
      for (const e of asStringList(deps["packs"])) {
        edges.add(e);
      }
    }
    graph.set(pid, edges);
  }
  return graph;
}

function _find_cycle(graph: Map<string, Set<string>>): string[] | null {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const n of graph.keys()) {
    color.set(n, WHITE);
  }
  const stack: string[] = [];

  const dfs = (node: string): string[] | null => {
    color.set(node, GREY);
    stack.push(node);
    const edges = [...(graph.get(node) ?? new Set())].sort();
    for (const nxt of edges) {
      if (!graph.has(nxt)) {
        continue;
      }
      if (color.get(nxt) === GREY) {
        const start = stack.indexOf(nxt);
        return stack.slice(start).concat([nxt]);
      }
      if (color.get(nxt) === WHITE) {
        const found = dfs(nxt);
        if (found) {
          return found;
        }
      }
    }
    color.set(node, BLACK);
    stack.pop();
    return null;
  };

  for (const n of [...graph.keys()].sort()) {
    if (color.get(n) === WHITE) {
      const cyc = dfs(n);
      if (cyc) {
        return cyc;
      }
    }
  }
  return null;
}

export function main(): number {
  // Gate on the resolved home set, not on packages/ existing.
  if (_gpm_pack_homes().length === 0) {
    process.stdout.write(
      "no pack homes (src/packs, src/domains, packages/) — nothing to lint\n",
    );
    return 0;
  }
  const errors = _dependency_drift();
  const cycle = _find_cycle(_pack_requires_graph());
  if (cycle) {
    errors.push(
      `pack-graph cycle (requires/dependencies.packs): ${cycle.join(" -> ")}`,
    );
  }
  if (errors.length > 0) {
    for (const e of errors) {
      process.stderr.write(`❌  ${e}\n`);
    }
    process.stderr.write(`\n${errors.length} pack-dependency violation(s).\n`);
    return 1;
  }
  process.stdout.write("✅  pack dependencies in sync; pack-graph is acyclic.\n");
  return 0;
}

// --- helpers ---------------------------------------------------------------

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

// Python list repr: ['a', 'b'] (single-quoted).
function pyListRepr(items: string[]): string {
  return `[${items.map((s) => `'${s}'`).join(", ")}]`;
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main());
}

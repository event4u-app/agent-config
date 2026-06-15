#!/usr/bin/env node
/**
 * Lint benchmark corpora under tests/eval/corpus-*.yaml.
 *
 * TypeScript twin of `src/scripts/lint_bench_corpus.py` (ADR-096, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract exactly: same scan scope + glob
 * ordering, finding messages (including Python-repr rendering of bad values),
 * stdout/stderr split, and exit codes.
 *
 * Exit codes:
 *   0  contract holds across every corpus
 *   1  one or more violations
 *   2  invocation error (no corpora found; corpus dir missing)
 *
 * Flags:
 *   --quiet            suppress per-file OK lines
 *   --require-full     also enforce 25-prompt composition (10/8/5/2)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml, YAMLParseError } from "yaml";
import { artefact_roots } from "./_lib/agent_src.js";

const QUIET = process.argv.includes("--quiet");
const REQUIRE_FULL = process.argv.includes("--require-full");

// src/scripts/lint_bench_corpus.ts → two levels up is the repo root.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CORPUS_DIR = path.join(REPO, "tests", "eval");
const ROUTER_COVERAGE_DIR = path.join(
  REPO,
  "internal",
  "bench",
  "corpora",
  "router-coverage",
);
const ROUTER_JSON = path.join(REPO, "dist", "router.json");

function _isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
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

// Live skill directories live under every artefact root post-monorepo Phase 4.
function SKILLS_DIRS(): string[] {
  return artefact_roots()
    .map((root) => path.join(root, "skills"))
    .filter((d) => _isDir(d));
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  "canonical",
  "ambiguous",
  "destructive",
  "long-context",
  "router-coverage",
]);
// Non-dev corpus (pre-spec) uses legacy categories — accept them.
const LEGACY_CATEGORIES: ReadonlySet<string> = new Set([
  "content",
  "consulting",
  "finance",
  "ops",
  "safety",
]);
const VALID_LANGUAGES: ReadonlySet<string> = new Set(["en", "de"]);
const VALID_VERSIONS: ReadonlySet<number> = new Set([1]);
const ID_RE = /^[a-z][a-z0-9-]*-\d{2}$/;
const FULL_COUNTS: Record<string, number> = {
  canonical: 10,
  ambiguous: 8,
  destructive: 5,
  "long-context": 2,
};

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

function relPosix(child: string, base: string): string {
  return path.relative(base, child).split(path.sep).join("/");
}

function live_skills(): Set<string> {
  const slugs = new Set<string>();
  for (const skillsDir of SKILLS_DIRS()) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(skillsDir, ent.name);
      let isDir = false;
      try {
        isDir = fs.statSync(full).isDirectory();
      } catch {
        isDir = false;
      }
      if (isDir && _exists(path.join(full, "SKILL.md"))) {
        slugs.add(ent.name);
      }
    }
  }
  return slugs;
}

/**
 * Return all rule ids known to dist/router.json (kernel + tier_1 + tier_2).
 * Returns `null` when the router is missing or unparseable.
 */
function live_rule_ids(): Set<string> | null {
  if (!_exists(ROUTER_JSON)) {
    process.stderr.write(
      `warning: ${relPosix(ROUTER_JSON, REPO)} missing — skipping ` +
        "trigger rule-id validation (run `task sync` to generate it)\n",
    );
    return null;
  }
  let data: YamlValue;
  try {
    data = JSON.parse(fs.readFileSync(ROUTER_JSON, "utf-8")) as YamlValue;
  } catch {
    process.stderr.write(
      `warning: ${relPosix(ROUTER_JSON, REPO)} unparseable — ` +
        "skipping trigger rule-id validation\n",
    );
    return null;
  }
  const ids = new Set<string>();
  const obj: YamlObject = isObject(data) ? data : {};
  const kernel = obj["kernel"];
  if (Array.isArray(kernel)) {
    for (const k of kernel) {
      if (typeof k === "string") {
        ids.add(k);
      } else if (k !== null && k !== undefined) {
        // Python `ids.update(list)` adds whatever the list holds.
        ids.add(k as unknown as string);
      }
    }
  }
  for (const tier of ["tier_1", "tier_2"]) {
    const rows = obj[tier];
    if (Array.isArray(rows)) {
      for (const r of rows) {
        if (isObject(r)) {
          const rid = r["id"];
          if (rid) {
            ids.add(rid as string);
          }
        }
      }
    }
  }
  return ids;
}

export function lint_corpus(
  filePath: string,
  skills: Set<string>,
  ruleIds: Set<string> | null = null,
): string[] {
  const name = path.basename(filePath);
  const errors: string[] = [];
  let data: YamlValue;
  try {
    data = parseYaml(fs.readFileSync(filePath, "utf-8"), {
      version: "1.1",
    }) as YamlValue;
  } catch (exc) {
    if (exc instanceof YAMLParseError) {
      return [`${name}: yaml_parse_error: ${exc.message}`];
    }
    return [`${name}: yaml_parse_error: ${String(exc)}`];
  }

  if (!isObject(data)) {
    return [`${name}: missing_top_level: corpus must be a mapping`];
  }

  for (const key of ["version", "corpus_id", "prompts"]) {
    if (!(key in data)) {
      errors.push(`${name}: missing_top_level: ${key}`);
    }
  }

  const version = data["version"];
  if (!(typeof version === "number" && VALID_VERSIONS.has(version))) {
    errors.push(`${name}: unsupported_version: ${pyRepr(version)}`);
  }

  const target = data["selection_accuracy_target"];
  if (
    target !== null &&
    target !== undefined &&
    !(typeof target === "number" && target >= 0.0 && target <= 1.0)
  ) {
    errors.push(`${name}: target_out_of_range: ${pyRepr(target)}`);
  }

  const promptsRaw = data["prompts"] ?? [];
  if (!Array.isArray(promptsRaw)) {
    return errors.concat([
      `${name}: missing_top_level: prompts must be a list`,
    ]);
  }
  const prompts = promptsRaw;

  const seenIds = new Set<string>();
  const bucketCounts = new Map<YamlValue, number>();
  const isLegacy = data["corpus_id"] === "non-dev";

  for (let idx = 0; idx < prompts.length; idx += 1) {
    const p = prompts[idx] as YamlValue;
    const loc = `${name}:#${idx}`;
    if (!isObject(p)) {
      errors.push(`${loc}: bad_prompt_shape`);
      continue;
    }
    const pid = p["id"];
    if (typeof pid !== "string" || !ID_RE.test(pid)) {
      errors.push(`${loc}: bad_id_format: ${pyRepr(pid)}`);
    } else if (seenIds.has(pid)) {
      errors.push(`${loc}: duplicate_id: ${pid}`);
    } else {
      seenIds.add(pid);
    }

    const cat = p["category"];
    const catStr = cat as YamlValue;
    if (
      !(typeof cat === "string" && VALID_CATEGORIES.has(cat)) &&
      !(isLegacy && typeof cat === "string" && LEGACY_CATEGORIES.has(cat))
    ) {
      errors.push(`${loc}: bad_category: ${pyRepr(cat)}`);
    }
    bucketCounts.set(catStr, (bucketCounts.get(catStr) ?? 0) + 1);

    const lang = "language" in p ? p["language"] : "en";
    if (!(typeof lang === "string" && VALID_LANGUAGES.has(lang))) {
      errors.push(`${loc}: bad_language: ${pyRepr(lang)}`);
    }

    const promptText = "prompt" in p ? p["prompt"] : "";
    if (typeof promptText !== "string" || promptText.trim() === "") {
      errors.push(`${loc}: empty_prompt`);
    }

    const expected = p["expected_skills"] ?? [];
    if (!Array.isArray(expected)) {
      errors.push(`${loc}: bad_expected_shape`);
    } else if (expected.length === 0 && cat !== "router-coverage") {
      errors.push(`${loc}: empty_expected`);
    } else {
      for (const slug of expected) {
        if (typeof slug !== "string" || !skills.has(slug)) {
          errors.push(`${loc}: unknown_skill: ${String(slug)}`);
        }
      }
    }

    if (cat === "destructive") {
      const carve = p["expected_carve_outs"] ?? [];
      if (!Array.isArray(carve) || carve.length === 0) {
        errors.push(`${loc}: missing_carve_out`);
      }
    }

    // router-coverage invariants.
    const intended = p["intended_triggers"];
    const opaque = p["replay_opaque_triggers"];
    const intendedList: YamlValue[] = Array.isArray(intended) ? intended : [];
    const opaqueList: YamlValue[] = Array.isArray(opaque) ? opaque : [];

    if (intended !== undefined && intended !== null && !Array.isArray(intended)) {
      errors.push(`${loc}: bad_intended_triggers_shape`);
    }
    if (opaque !== undefined && opaque !== null && !Array.isArray(opaque)) {
      errors.push(`${loc}: bad_replay_opaque_triggers_shape`);
    }

    if (cat === "router-coverage" && intendedList.length === 0 && opaqueList.length === 0) {
      errors.push(`${loc}: missing_intended_triggers`);
    }

    // A rule belongs to exactly one bucket — both is a contradiction.
    const intendedSet = new Set(intendedList.map((v) => String(v)));
    const opaqueSet = new Set(opaqueList.map((v) => String(v)));
    const both = [...intendedSet].filter((r) => opaqueSet.has(r)).sort();
    for (const rid of both) {
      errors.push(`${loc}: trigger_in_both_buckets: ${rid}`);
    }

    // Every referenced id (either bucket) must be a real router rule id.
    if (ruleIds !== null) {
      for (const rid of [...intendedList, ...opaqueList]) {
        if (typeof rid !== "string" || !ruleIds.has(rid)) {
          errors.push(`${loc}: unknown_intended_trigger: ${String(rid)}`);
        }
      }
    }
  }

  if (REQUIRE_FULL && !isLegacy) {
    for (const [bucket, want] of Object.entries(FULL_COUNTS)) {
      const have = bucketCounts.get(bucket) ?? 0;
      if (have !== want) {
        errors.push(
          `${name}: composition_drift: ${bucket} have=${have} want=${want}`,
        );
      }
    }
  }

  return errors;
}

export function main(): number {
  if (!_isDir(CORPUS_DIR)) {
    process.stderr.write(`error: corpus dir missing: ${CORPUS_DIR}\n`);
    return 2;
  }
  const corpora = globSorted(CORPUS_DIR, "corpus-", ".yaml");
  if (_isDir(ROUTER_COVERAGE_DIR)) {
    corpora.push(...globSorted(ROUTER_COVERAGE_DIR, "", ".yaml"));
  }
  if (corpora.length === 0) {
    process.stderr.write("error: no corpora found\n");
    return 2;
  }

  const skills = live_skills();
  const ruleIds = live_rule_ids();
  const allErrors: string[] = [];
  for (const p of corpora) {
    const errs = lint_corpus(p, skills, ruleIds);
    if (errs.length > 0) {
      allErrors.push(...errs);
    } else if (!QUIET) {
      process.stdout.write(`✅  ${path.basename(p)}: contract OK\n`);
    }
  }

  if (allErrors.length > 0) {
    for (const err of allErrors) {
      process.stderr.write(`❌  ${err}\n`);
    }
    return 1;
  }
  if (!QUIET) {
    process.stdout.write(`✅  lint-bench: ${corpora.length} corpora clean\n`);
  }
  return 0;
}

/** `dir.glob("<prefix>*<suffix>")` sorted by full path. */
function globSorted(dir: string, prefix: string, suffix: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out = entries
    .filter((n) => n.startsWith(prefix) && n.endsWith(suffix))
    .map((n) => path.join(dir, n));
  out.sort();
  return out;
}

/**
 * Render a value the way Python's `{x!r}` (repr) does for the value types this
 * linter encounters in malformed corpora: str → 'x', None → None, bool →
 * True/False, int/float → bare number.
 */
function pyRepr(v: YamlValue | undefined): string {
  if (v === null || v === undefined) {
    return "None";
  }
  if (typeof v === "string") {
    return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  if (typeof v === "boolean") {
    return v ? "True" : "False";
  }
  if (typeof v === "number") {
    return String(v);
  }
  return JSON.stringify(v);
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main());
}

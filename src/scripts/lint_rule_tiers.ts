#!/usr/bin/env node
/**
 * Lint rule frontmatter for the `tier:` key.
 *
 * TypeScript twin of `src/scripts/lint_rule_tiers.py` (ADR-088, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract exactly: same scan scope, file
 * ordering, finding messages, stdout/stderr split, and exit codes.
 *
 * Hard-fails CI if any rule under the rules/ tree lacks a `tier:` declaration
 * or uses an unknown tier value. The valid tier set is locked by
 * agents/settings/contexts/hardening-pattern.md and the matrix in
 * agents/settings/contexts/rule-trigger-matrix.md.
 *
 * Exit codes:
 *   0  every rule declares a valid tier
 *   1  one or more rules missing or using an invalid tier
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { artefact_roots } from "./_lib/agent_src.js";

const QUIET = process.argv.includes("--quiet");

// Rules live under every artefact root post-monorepo Phase 4.
function RULES_DIRS(): string[] {
  return artefact_roots()
    .map((root) => path.join(root, "rules"))
    .filter((d) => {
      try {
        return fs.statSync(d).isDirectory();
      } catch {
        return false;
      }
    });
}

const VALID_TIERS: ReadonlySet<string> = new Set([
  "1",
  "2a",
  "2b",
  "3",
  "safety-floor",
  "mechanical-already",
]);

/** All entries directly under `dir` matching `*.md`, non-recursive. */
function globMd(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const ent of entries) {
    if (ent.name.endsWith(".md")) {
      out.push(path.join(dir, ent.name));
    }
  }
  return out;
}

export function parse_tier(text: string): string | null {
  if (!text.startsWith("---\n")) {
    return null;
  }
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    return null;
  }
  for (const line of text.slice(4, end).split("\n")) {
    if (!line.includes(":")) {
      continue;
    }
    const idx = line.indexOf(":");
    const k = line.slice(0, idx);
    const v = line.slice(idx + 1);
    if (k.trim() === "tier") {
      return stripQuotes(v.trim());
    }
  }
  return null;
}

// Python: v.strip().strip('"').strip("'") — strips leading/trailing runs of
// each quote char in turn (not a single pair).
function stripQuotes(s: string): string {
  let out = s;
  out = stripChar(out, '"');
  out = stripChar(out, "'");
  return out;
}

function stripChar(s: string, ch: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === ch) start += 1;
  while (end > start && s[end - 1] === ch) end -= 1;
  return s.slice(start, end);
}

export function main(): number {
  const rules: string[] = [];
  for (const rulesDir of RULES_DIRS()) {
    rules.push(...globMd(rulesDir));
  }
  rules.sort();
  if (rules.length === 0) {
    const rootsLabel = RULES_DIRS().join(", ") || "<no rules root>";
    process.stderr.write(
      `lint_rule_tiers: no rules found under ${rootsLabel}\n`,
    );
    return 1;
  }

  const missing: string[] = [];
  const invalid: Array<[string, string]> = [];

  for (const rule of rules) {
    const tier = parse_tier(fs.readFileSync(rule, "utf-8"));
    const name = path.basename(rule);
    if (tier === null) {
      missing.push(name);
    } else if (!VALID_TIERS.has(tier)) {
      invalid.push([name, tier]);
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    process.stderr.write(
      `❌  lint_rule_tiers: ${missing.length} missing, ` +
        `${invalid.length} invalid (of ${rules.length} rules)\n`,
    );
    for (const name of missing) {
      process.stderr.write(`    missing tier: ${name}\n`);
    }
    for (const [name, tier] of invalid) {
      process.stderr.write(`    invalid tier '${tier}': ${name}\n`);
    }
    process.stderr.write(
      `    valid tiers: ${pyRepr(sortedTiers())}\n`,
    );
    return 1;
  }

  if (!QUIET) {
    process.stdout.write(
      `✅  lint_rule_tiers: ${rules.length} rules, all tier values valid\n`,
    );
  }
  return 0;
}

function sortedTiers(): string[] {
  return [...VALID_TIERS].sort();
}

// Mirror Python's `print(sorted(set))` list repr: ['a', 'b', ...].
function pyRepr(items: string[]): string {
  return `[${items.map((s) => `'${s}'`).join(", ")}]`;
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main());
}

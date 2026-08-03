#!/usr/bin/env tsx
/**
 * Derive the routing-matrix router-coverage corpus (road-to-tested-routing
 * Phase 2, PREREG P2 corpus expansion).
 *
 * Reads every per-rule routing matrix under `tests/eval/routing-matrix/`
 * and emits ONE generated corpus file,
 * `internal/bench/corpora/router-coverage/routing-matrix-derived.yaml`,
 * with one `router-coverage` prompt per matrix POSITIVE, labelled
 * `intended_triggers: [<rule>]`. Near-misses are deliberately NOT emitted —
 * the corpus measures intended activation; the matrices' negative half is
 * enforced by `tests/scripts/routing_matrix.test.ts`.
 *
 * Ownership (two-gate pattern): this generator is the only writer;
 * `--check` re-derives in memory and exits 1 on drift, so the derived file
 * can never be hand-edited into disagreement with its source matrices.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const MATRIX_DIR = path.join(REPO_ROOT, "tests", "eval", "routing-matrix");
export const OUT_FILE = path.join(
  REPO_ROOT,
  "internal",
  "bench",
  "corpora",
  "router-coverage",
  "routing-matrix-derived.yaml",
);

interface MatrixCase {
  prompt: string;
  open_files?: string[];
  command?: string;
}
interface MatrixFile {
  rule: string;
  positives: MatrixCase[];
  near_misses: MatrixCase[];
}

/** Cheap language tag for the corpus `language:` field. */
export function detect_language(prompt: string): "de" | "en" {
  if (/[äöüßÄÖÜ]/.test(prompt)) {
    return "de";
  }
  return /(^|\s)(der|die|das|und|nicht|bitte|keine?|mach|prüfe|erstelle|für)(\s|$)/i.test(prompt)
    ? "de"
    : "en";
}

function yamlQuote(s: string): string {
  return JSON.stringify(s);
}

export function derive(): string {
  const files = fs
    .readdirSync(MATRIX_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort();
  const lines: string[] = [];
  lines.push("# Router-coverage corpus — DERIVED FROM the per-rule routing matrices.");
  lines.push("#");
  lines.push("# GENERATED FILE — do not hand-edit. Source of truth:");
  lines.push("#   tests/eval/routing-matrix/*.yaml");
  lines.push("# Regenerate: npx tsx src/scripts/generate_router_coverage_from_matrix.ts");
  lines.push("# Drift gate:  npx tsx src/scripts/generate_router_coverage_from_matrix.ts --check");
  lines.push("");
  lines.push("version: 1");
  lines.push("corpus_id: router-coverage-routing-matrix-derived");
  lines.push("selection_accuracy_target: 0.0");
  lines.push("");
  lines.push("prompts:");
  for (const f of files) {
    const parsed = parseYaml(fs.readFileSync(path.join(MATRIX_DIR, f), "utf-8")) as MatrixFile;
    parsed.positives.forEach((c, i) => {
      const id = `rm-${parsed.rule}-${String(i + 1).padStart(2, "0")}`;
      lines.push(`  - id: ${id}`);
      lines.push("    category: router-coverage");
      lines.push(`    language: ${detect_language(c.prompt)}`);
      lines.push(`    prompt: ${yamlQuote(c.prompt)}`);
      lines.push("    expected_skills: []");
      lines.push(`    intended_triggers: [${parsed.rule}]`);
      if (c.open_files && c.open_files.length > 0) {
        lines.push(`    open_files: [${c.open_files.map(yamlQuote).join(", ")}]`);
      }
      lines.push("");
    });
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  const check = args.includes("--check");
  const derived = derive();
  if (check) {
    let current = "";
    try {
      current = fs.readFileSync(OUT_FILE, "utf-8");
    } catch {
      process.stderr.write(`missing derived corpus: ${OUT_FILE} — run the generator\n`);
      return 1;
    }
    if (current !== derived) {
      process.stderr.write(
        "routing-matrix-derived.yaml is stale — regenerate via generate_router_coverage_from_matrix\n",
      );
      return 1;
    }
    process.stdout.write("routing-matrix-derived corpus: fresh\n");
    return 0;
  }
  fs.writeFileSync(OUT_FILE, derived, "utf-8");
  const promptCount = (derived.match(/^ {2}- id: /gm) ?? []).length;
  const ruleCount = new Set(
    [...derived.matchAll(/intended_triggers: \[([^\]]+)\]/g)].map((m) => m[1]),
  ).size;
  process.stdout.write(
    `wrote ${path.relative(REPO_ROOT, OUT_FILE)} — ${promptCount} prompts, ${ruleCount} distinct rule ids\n`,
  );
  return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) {
    return false;
  }
  if (process.argv[1] === undefined) {
    return false;
  }
  const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
  if (import.meta.url === argvUrl) {
    return true;
  }
  try {
    const here = fs.realpathSync(fileURLToPath(import.meta.url));
    const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
    return here === argv1;
  } catch {
    return false;
  }
}

if (_isCliEntry()) {
  process.exit(main());
}

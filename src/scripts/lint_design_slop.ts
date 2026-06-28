#!/usr/bin/env node
/**
 * lint_design_slop — deterministic anti-slop DETECTOR for consumer projects.
 *
 * The aesthetic-PROVENANCE layer that `lint_design_quality` deliberately omits.
 * It scans HTML/CSS/JSX/Markdown for the "AI tells" catalogued in
 * `docs/guidelines/design-antipatterns.md` and emits structured findings
 * (rule-id + catalog-id + severity P0–P3 + file:line). The rule registry lives
 * in `design_slop_rules.ts`.
 *
 * FLAGS, NEVER A HARD BLOCK. Default exit is 0 regardless of findings — slop
 * tells are rebuttable presumptions, not failures. CI opts into failing with
 * `--fail-on <P0|P1|P2|P3>` (fails when any finding at or above that severity
 * remains). This honours the council 2026-06-28 "flags not blocks" verdict.
 *
 * Zero runtime token cost: this runs in Node (CI / pre-commit / optional hook),
 * never in the model's context. `design-review` cites the structured `--json`
 * output instead of reloading the 12 KB prose catalog.
 *
 * Dependency-free pattern analysis (no postcss/@babel) — see the design note in
 * design_slop_rules.ts. Same posture as lint_design_quality.
 *
 * Usage:
 *   npx tsx lint_design_slop.ts --dir src/ [--json] [--fail-on P1] [--quiet]
 *
 * Context gate: a consumer DESIGN.md (project root or scan dir) that declares a
 * pattern as intentional suppresses the matching rule (e.g. "warm-neutral" →
 * C5 cream-palette is not flagged). Inline-ignore (eslint-style):
 *   design-slop-disable <rule-id>            (file scope, top of file)
 *   design-slop-disable-next-line <rule-id>
 *   design-slop-disable-line <rule-id>
 * Per-project config (.design-quality.json, shared with lint_design_quality):
 *   { "ignoreRules": ["slop-c5-cream-palette"], "ignoreFiles": ["src/legacy/**"] }
 *
 * Exit codes: 0 = clean OR findings-below-threshold, 2 = findings at/above
 * --fail-on threshold, 1 = internal error.
 */
import fs from "node:fs";
import path from "node:path";
import {
  SLOP_RULES,
  type DesignContext,
  type Engine,
  type Severity,
} from "./design_slop_rules.js";

interface Finding {
  rule: string;
  catalogId: string;
  severity: Severity;
  file: string;
  line: number;
  snippet: string;
  message: string;
}

interface ProjectConfig {
  ignoreRules?: string[];
  ignoreFiles?: string[];
}

const SEVERITY_ORDER: Severity[] = ["P3", "P2", "P1", "P0"];
const sevRank = (s: Severity): number => SEVERITY_ORDER.indexOf(s);

// ext → which engine-classes a file of that type can contain
function enginesForExt(ext: string): Set<Engine> {
  if (/\.(css|scss|sass|less)$/i.test(ext)) return new Set<Engine>(["css"]);
  if (/\.(html|htm|vue|svelte|astro)$/i.test(ext)) return new Set<Engine>(["css", "html", "copy"]);
  if (/\.(jsx|tsx)$/i.test(ext)) return new Set<Engine>(["css", "jsx", "copy"]);
  if (/\.(md|mdx)$/i.test(ext)) return new Set<Engine>(["copy"]);
  return new Set<Engine>();
}

function* walkDir(dir: string, ext: RegExp): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.isDirectory()) yield* walkDir(full, ext);
    else if (ext.test(entry.name)) yield full;
  }
}

function loadConfig(dir: string): ProjectConfig {
  const p = path.join(dir, ".design-quality.json");
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as ProjectConfig;
  } catch {
    return {};
  }
}

/** Read DESIGN.md (scan dir, then project root) as the context-gate source. */
export function loadDesignContext(scanDir: string): DesignContext {
  const candidates = [
    path.join(scanDir, "DESIGN.md"),
    path.join(process.cwd(), "DESIGN.md"),
    path.join(scanDir, "..", "DESIGN.md"),
  ];
  let raw = "";
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      raw = fs.readFileSync(c, "utf-8").toLowerCase();
      break;
    }
  }
  return {
    raw,
    has: (...keywords: string[]) => keywords.some((k) => raw.includes(k.toLowerCase())),
  };
}

function parseIgnores(lines: string[]): Map<string, Set<number>> {
  const ignores = new Map<string, Set<number>>();
  const add = (rule: string, line: number) => {
    const set = ignores.get(rule) ?? new Set<number>();
    set.add(line);
    ignores.set(rule, set);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const file = /design-slop-disable\s+([\w-]+)/i.exec(line);
    if (file && file[1] && !/-line|-next-line/.test(line)) {
      ignores.set(file[1].toLowerCase(), new Set([...Array(99999).keys()].map((n) => n + 1)));
    }
    const next = /design-slop-disable-next-line\s+([\w-]+)/i.exec(line);
    if (next && next[1]) add(next[1].toLowerCase(), i + 2);
    const cur = /design-slop-disable-line\s+([\w-]+)/i.exec(line);
    if (cur && cur[1]) add(cur[1].toLowerCase(), i + 1);
  }
  return ignores;
}

export function scanFile(
  content: string,
  relPath: string,
  ctx: DesignContext,
): Finding[] {
  const lines = content.split("\n");
  const ext = path.extname(relPath).toLowerCase();
  const fileEngines = enginesForExt(ext);
  if (fileEngines.size === 0) return [];
  const ignores = parseIgnores(lines);

  const out: Finding[] = [];
  for (const rule of SLOP_RULES) {
    if (!rule.engines.some((e) => fileEngines.has(e))) continue;
    if (rule.gated && rule.gated(ctx)) continue; // DESIGN.md declares intent → suppress
    let hits;
    try {
      hits = rule.detect({ content, lines, ext, ctx });
    } catch {
      continue; // a single rule throwing never kills the scan
    }
    for (const h of hits) {
      const ruleIgnore = ignores.get(rule.id.toLowerCase());
      if (ruleIgnore && ruleIgnore.has(h.line)) continue;
      out.push({
        rule: rule.id,
        catalogId: rule.catalogId,
        severity: rule.severity,
        file: relPath,
        line: h.line,
        snippet: h.snippet,
        message: rule.message,
      });
    }
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const quiet = args.includes("--quiet");
  const dirIdx = args.indexOf("--dir");
  const scanDir = dirIdx >= 0 && args[dirIdx + 1] ? path.resolve(args[dirIdx + 1]!) : path.resolve(process.cwd(), "src");
  const failIdx = args.indexOf("--fail-on");
  const failOn = (failIdx >= 0 ? args[failIdx + 1] : undefined) as Severity | undefined;

  if (!fs.existsSync(scanDir)) {
    if (!quiet) {
      process.stderr.write(`[lint_design_slop] scan directory not found: ${scanDir}\n`);
      process.stderr.write("Opt-in for consumer projects. Run with --dir <path> at your UI source.\n");
    }
    process.exit(0);
  }

  const ctx = loadDesignContext(scanDir);
  const config = loadConfig(process.cwd());
  const ignoreRules = new Set((config.ignoreRules ?? []).map((r) => r.toLowerCase()));
  const ignoreGlobs = config.ignoreFiles ?? [];

  const files: string[] = [];
  for (const f of walkDir(scanDir, /\.(html|htm|css|scss|sass|less|vue|svelte|astro|jsx|tsx|md|mdx)$/i)) {
    if (!ignoreGlobs.some((g) => f.includes(g.replace("**", "")))) files.push(f);
  }

  const findings: Finding[] = [];
  for (const fp of files) {
    const rel = path.relative(process.cwd(), fp);
    try {
      const fileFindings = scanFile(fs.readFileSync(fp, "utf-8"), rel, ctx).filter(
        (f) => !ignoreRules.has(f.rule.toLowerCase()),
      );
      findings.push(...fileFindings);
    } catch (err) {
      if (!quiet) process.stderr.write(`[lint_design_slop] error: ${fp}: ${err}\n`);
    }
  }

  findings.sort((a, b) => sevRank(b.severity) - sevRank(a.severity));

  const overThreshold = failOn
    ? findings.filter((f) => sevRank(f.severity) >= sevRank(failOn))
    : [];

  if (jsonMode) {
    process.stdout.write(JSON.stringify({ findings, failOn: failOn ?? null, overThreshold: overThreshold.length }, null, 2) + "\n");
    process.exit(overThreshold.length > 0 ? 2 : 0);
  }

  if (findings.length === 0) {
    if (!quiet) process.stdout.write(`✅  lint_design_slop: no anti-slop tells in ${files.length} file(s).\n`);
    process.exit(0);
  }

  for (const f of findings) {
    const icon = f.severity === "P0" || f.severity === "P1" ? "⚠️ " : "•";
    process.stdout.write(`${icon} [${f.severity} ${f.catalogId}] ${f.file}:${f.line} (${f.rule}) — ${f.message}\n     ${f.snippet}\n`);
  }
  process.stdout.write(
    `\nlint_design_slop: ${findings.length} tell(s) flagged (rebuttable — declare intent in DESIGN.md, ` +
      `design-slop-disable-next-line <rule>, or .design-quality.json).` +
      (failOn ? ` ${overThreshold.length} at/above ${failOn}.` : " Flags only; no CI failure (pass --fail-on to gate).") +
      "\n",
  );
  process.exit(overThreshold.length > 0 ? 2 : 0);
}

// Run only when invoked directly (not when imported by the test guard).
const invokedDirectly =
  process.argv[1] !== undefined && /lint_design_slop\.ts$/.test(process.argv[1]);
if (invokedDirectly) main();

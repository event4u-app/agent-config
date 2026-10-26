/**
 * The CLI body of `lint_design_slop` — split out so the hook bundle, which
 * imports `lint_design_slop.ts` for `scanFile` and `loadDesignContext`, does not
 * carry it. Run the linter through `lint_design_slop.ts` as before.
 */
import fs from "node:fs";
import path from "node:path";
import { assertScanned, DeadScopeError } from "./_lib/scan_scope.js";
import type { Severity } from "./design_slop_rules.js";
import { loadDesignContext, scanFile, wouldHaveSuppressed, type Finding } from "./lint_design_slop.js";

interface ProjectConfig {
  ignoreRules?: string[];
  ignoreFiles?: string[];
}

const SEVERITY_ORDER: Severity[] = ["P3", "P2", "P1", "P0"];
const sevRank = (s: Severity): number => SEVERITY_ORDER.indexOf(s);

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

export function main(): void {
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

  // The opt-in escape above is the "consumer has no UI tree" path. Reaching
  // here means the root EXISTS and still yielded nothing scannable — a moved
  // subtree, a drifted extension list, or an over-broad ignoreFiles glob. This
  // detector never hard-blocks on findings, so "no tells in 0 file(s)" is
  // indistinguishable from a clean scan. Exit 1 is its internal-error code; 2
  // is reserved for the --fail-on threshold.
  try {
    assertScanned({
      gate: "lint_design_slop",
      scanned: files.length,
      units: "design source file(s)",
      // Absolute: --dir may point outside the cwd (or outside any repo).
      roots: [scanDir],
    });
  } catch (exc) {
    if (exc instanceof DeadScopeError) {
      process.stderr.write(`❌  ${exc.message}\n`);
      process.exit(1);
    }
    throw exc;
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
    process.stdout.write(
      JSON.stringify(
        { findings, failOn: failOn ?? null, overThreshold: overThreshold.length, would_have_suppressed: wouldHaveSuppressed },
        null,
        2,
      ) + "\n",
    );
    process.exit(overThreshold.length > 0 ? 2 : 0);
  }

  if (!quiet) {
    for (const w of wouldHaveSuppressed) {
      process.stdout.write(
        `ℹ️  ${w.file}: the old DESIGN.md word match would have suppressed ${w.rule}; declare it under ` +
          "`## Intentional` or a frontmatter `intent:` list if it is intended.\n",
      );
    }
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

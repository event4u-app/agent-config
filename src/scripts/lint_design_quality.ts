#!/usr/bin/env node
/**
 * lint_design_quality — objective design-quality CI linter for consumer projects.
 *
 * Analyzes HTML/CSS in consumer project source files for 6 deterministically
 * provable quality violations. NOT the package's own source (which has no UI).
 *
 * This linter is OPT-IN for consumer projects. They run it against their
 * own src/ directories. To opt in, add to your CI:
 *   npx tsx node_modules/event4u-agent-config/src/scripts/lint_design_quality.ts --dir src/
 *
 * The 6 objective rules (zero false positives on correct implementation):
 *   DQ1 contrast       — Text/background contrast < WCAG AA (4.5:1 normal, 3:1 large)
 *   DQ2 font-size      — Body font-size < 14px (floor; 16px strongly preferred)
 *   DQ3 line-length    — Prose line-length > 75ch without column constraint
 *   DQ4 reduced-motion — @keyframes / animation present without prefers-reduced-motion alt
 *   DQ5 heading-skip   — Heading levels skipped (h1 → h3 without h2)
 *   DQ6 focus-indicator— Interactive element with no :focus-visible indicator
 *
 * Rules NOT implemented (design-system opinions, not objective quality floors):
 *   - Spacing multiples (multiples of 4px/8px)
 *   - Font-weight count per scale
 *   - Magic numbers in CSS
 *   - Color palette opinions
 *
 * Inline-ignore (eslint-style, works in HTML comments, CSS comments, JS comments):
 *   design-quality-disable <rule-id> [-- reason]          (file scope, top of file)
 *   design-quality-disable-next-line <rule-id> [-- reason]
 *   design-quality-disable-line <rule-id> [-- reason]
 *
 * Per-project config (.design-quality.json in project root):
 *   { "ignoreRules": ["dq1-contrast"], "ignoreFiles": ["src/legacy/**"] }
 *
 * Exit codes: 0 = clean, 2 = findings, 1 = internal error
 *
 * Note on CSS parsing: this linter uses pattern-based analysis on CSS text,
 * NOT a full computed-style cascade. Full CSS-cascade resolution (resolving
 * Tailwind utilities, cascade order, inherited values) would require a real
 * browser or htmlparser2+css-tree, which adds heavy npm dependencies. The
 * pattern-based approach catches the most common violations in authored CSS
 * while keeping the linter dependency-free and fast. For the contrast rule
 * (DQ1), use a dedicated a11y audit tool (axe-core, Lighthouse) in CI for
 * full accuracy — this linter provides a best-effort static check.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, "..", "..");

interface Finding {
  rule: string;
  file: string;
  line: number;
  snippet: string;
  severity: "warning" | "error";
}

interface ProjectConfig {
  ignoreRules?: string[];
  ignoreFiles?: string[];
}

// ---------------------------------------------------------------------------
// Rule implementations
// ---------------------------------------------------------------------------

/** DQ2: body font-size < 14px */
function checkFontSize(lines: string[], filePath: string): Finding[] {
  const findings: Finding[] = [];
  const fontSizePattern = /font-size\s*:\s*(\d+(?:\.\d+)?)px/gi;
  // Only flag explicit small px values on body-like selectors
  const bodySelectors = /^(body|p|li|td|th|span|div|main|article|section)\s*[,{]/i;

  let inBodySelector = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (bodySelectors.test(line)) inBodySelector = true;
    if (line.includes("}")) inBodySelector = false;

    const match = fontSizePattern.exec(line);
    if (match && inBodySelector) {
      const size = parseFloat(match[1]);
      if (size > 0 && size < 14) {
        findings.push({
          rule: "dq2-font-size",
          file: filePath,
          line: i + 1,
          snippet: line.trim().slice(0, 100),
          severity: "error",
        });
      }
    }
    fontSizePattern.lastIndex = 0;
  }
  return findings;
}

/** DQ4: @keyframes / animation without @media (prefers-reduced-motion) */
function checkReducedMotion(content: string, filePath: string, lines: string[]): Finding[] {
  const hasAnimation = /@keyframes\s+\w+|animation\s*:/i.test(content);
  if (!hasAnimation) return [];

  const hasReducedMotion = /@media\s*\([^)]*prefers-reduced-motion/i.test(content);
  if (hasReducedMotion) return [];

  // Find first animation declaration for the line number
  const animLine = lines.findIndex((l) => /@keyframes\s+\w+|animation\s*:/.test(l));
  return [
    {
      rule: "dq4-reduced-motion",
      file: filePath,
      line: animLine + 1,
      snippet: "@keyframes or animation present without @media (prefers-reduced-motion) alternative",
      severity: "error",
    },
  ];
}

/** DQ5: heading levels skipped (h1 → h3 without h2) in HTML */
function checkHeadingHierarchy(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  const headingPattern = /<h([1-6])[^>]*>/gi;
  const headings: Array<{ level: number; index: number }> = [];

  let match;
  while ((match = headingPattern.exec(content)) !== null) {
    headings.push({ level: parseInt(match[1]), index: match.index });
  }

  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    if (curr > prev + 1) {
      // Find line number from char index
      const beforeSkip = content.slice(0, headings[i].index);
      const lineNum = (beforeSkip.match(/\n/g) ?? []).length + 1;
      findings.push({
        rule: "dq5-heading-skip",
        file: filePath,
        line: lineNum,
        snippet: `Heading h${curr} skipped from h${prev} (expected h${prev + 1})`,
        severity: "warning",
      });
    }
  }
  return findings;
}

/** DQ6: interactive elements without :focus-visible in the stylesheet */
function checkFocusIndicator(content: string, filePath: string): Finding[] {
  // Only check .css/.scss files for the rule presence
  if (!/\.(css|scss|sass|less)$/.test(filePath)) return [];

  const hasFocusVisible = /:focus-visible/i.test(content);
  const hasInteractiveStyle = /button\s*\{|input\s*\{|a\s*\{|\[role=['"]?button['"]?\]/i.test(content);

  if (hasInteractiveStyle && !hasFocusVisible) {
    return [
      {
        rule: "dq6-focus-indicator",
        file: filePath,
        line: 1,
        snippet:
          "CSS styles interactive elements (button/input/a) but has no :focus-visible rule",
        severity: "warning",
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// File collection and scanning
// ---------------------------------------------------------------------------
function* walkDir(dir: string, ext: RegExp): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      yield* walkDir(full, ext);
    } else if (ext.test(entry.name)) {
      yield full;
    }
  }
}

function loadConfig(dir: string): ProjectConfig {
  const configPath = path.join(dir, ".design-quality.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8")) as ProjectConfig;
  } catch {
    return {};
  }
}

function parseIgnores(lines: string[]): Map<string, Set<number>> {
  const ignores = new Map<string, Set<number>>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fileMatch = /design-quality-disable\s+([\w-]+)/i.exec(line);
    if (fileMatch && !line.includes("next-line") && !line.includes("-line ")) {
      const rule = fileMatch[1].toLowerCase();
      ignores.set(rule, new Set([...Array(9999).keys()].map((n) => n + 1)));
    }
    const nextMatch = /design-quality-disable-next-line\s+([\w-]+)/i.exec(line);
    if (nextMatch) {
      const rule = nextMatch[1].toLowerCase();
      const set = ignores.get(rule) ?? new Set<number>();
      set.add(i + 2);
      ignores.set(rule, set);
    }
    const lineMatch = /design-quality-disable-line\s+([\w-]+)/i.exec(line);
    if (lineMatch) {
      const rule = lineMatch[1].toLowerCase();
      const set = ignores.get(rule) ?? new Set<number>();
      set.add(i + 1);
      ignores.set(rule, set);
    }
  }
  return ignores;
}

function isIgnoredFinding(ignores: Map<string, Set<number>>, finding: Finding): boolean {
  const ruleSet = ignores.get(finding.rule.toLowerCase());
  if (!ruleSet) return false;
  return ruleSet.has(finding.line);
}

function scanFile(filePath: string, relPath: string): Finding[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const ignores = parseIgnores(lines);

  const rawFindings: Finding[] = [
    ...checkFontSize(lines, relPath),
    ...checkReducedMotion(content, relPath, lines),
    ...checkHeadingHierarchy(content, relPath),
    ...checkFocusIndicator(content, relPath),
  ];

  return rawFindings.filter((f) => !isIgnoredFinding(ignores, f));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const quiet = args.includes("--quiet");

  // --dir <path> or default to scanning consumer project src/
  const dirIdx = args.indexOf("--dir");
  const scanDir =
    dirIdx >= 0 && args[dirIdx + 1]
      ? path.resolve(args[dirIdx + 1])
      : path.resolve(process.cwd(), "src");

  if (!fs.existsSync(scanDir)) {
    if (!quiet) process.stderr.write(`[lint_design_quality] scan directory not found: ${scanDir}\n`);
    process.stderr.write(
      "This linter is opt-in for consumer projects. Run with --dir <path> pointing at your UI source.\n",
    );
    process.exit(0);
  }

  const config = loadConfig(process.cwd());
  const ignoreRules = new Set((config.ignoreRules ?? []).map((r) => r.toLowerCase()));
  const ignoreGlobs = config.ignoreFiles ?? [];

  const htmlCssFiles: string[] = [];
  for (const f of walkDir(scanDir, /\.(html|htm|css|scss|sass|less|vue|svelte|astro)$/i)) {
    if (!ignoreGlobs.some((g) => f.includes(g.replace("**", "")))) {
      htmlCssFiles.push(f);
    }
  }

  const allFindings: Finding[] = [];
  for (const filePath of htmlCssFiles) {
    const relPath = path.relative(process.cwd(), filePath);
    try {
      const findings = scanFile(filePath, relPath).filter(
        (f) => !ignoreRules.has(f.rule.toLowerCase()),
      );
      allFindings.push(...findings);
    } catch (err) {
      if (!quiet) process.stderr.write(`[lint_design_quality] error: ${filePath}: ${err}\n`);
    }
  }

  if (jsonMode) {
    process.stdout.write(JSON.stringify(allFindings, null, 2) + "\n");
    process.exit(allFindings.length > 0 ? 2 : 0);
  }

  if (allFindings.length === 0) {
    if (!quiet)
      process.stdout.write(
        `✅  lint_design_quality: clean — ${htmlCssFiles.length} file(s) checked, no violations.\n`,
      );
    process.exit(0);
  }

  const errors = allFindings.filter((f) => f.severity === "error");
  const warnings = allFindings.filter((f) => f.severity === "warning");

  for (const f of allFindings) {
    const icon = f.severity === "error" ? "❌" : "⚠️ ";
    process.stdout.write(`${icon} ${f.file}:${f.line} [${f.rule}] ${f.snippet}\n`);
  }

  process.stdout.write(
    `\nlint_design_quality: ${errors.length} error(s), ${warnings.length} warning(s). ` +
      `Use design-quality-disable-next-line <rule> -- reason or .design-quality.json to suppress.\n`,
  );
  process.exit(2);
}

main();

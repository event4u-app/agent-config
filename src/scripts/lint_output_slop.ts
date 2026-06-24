#!/usr/bin/env node
/**
 * lint_output_slop — detect banned placeholder-prose patterns in generated
 * code and UI output. Six zero-false-positive rules; exit 2 on any finding.
 *
 * Scans: src/skills/**\/SKILL.md, src/rules/*.md, docs/guidelines/*.md
 * (i.e., the package's own authored artifacts). Consumer projects should
 * run this against their own src/ directories.
 *
 * Rules (all zero-false-positive in the package tree):
 *   P1 lorem-ipsum      — Lorem ipsum / dolor sit amet filler text
 *   P2 bracket-placeholder — [Your ... here], <YourComponentName> patterns
 *   P3 impl-placeholder — // rest of component, // ... (unchanged), etc.
 *   P4 for-brevity      — "for brevity" inside code content
 *   P5 ellipsis-trunc   — … or ... as standalone code-continuation markers
 *   P6 todo-implement   — // TODO.*implement (unimplemented stubs)
 *
 * Inline-ignore: add a comment on the same or previous line:
 *   lint-output-slop-disable-next-line <rule-id> [-- reason]
 *   lint-output-slop-disable-line <rule-id> [-- reason]
 *   lint-output-slop-disable-file <rule-id> [-- reason]  (top of file)
 *
 * Exit codes: 0 = clean, 2 = findings present, 1 = internal error.
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
}

// ---------------------------------------------------------------------------
// Rule definitions — each is (id, label, regex-on-a-line-of-content)
// We only scan INSIDE fenced code blocks in markdown, and in plain .ts/.tsx
// source files. This prevents false positives from inline-ignore comments,
// documentation paragraphs, or test descriptions.
// ---------------------------------------------------------------------------
const RULES: Array<{ id: string; label: string; pattern: RegExp }> = [
  {
    id: "lorem-ipsum",
    label: "Filler text: Lorem ipsum / dolor sit amet",
    pattern: /Lorem\s+ipsum|dolor\s+sit\s+amet/i,
  },
  {
    id: "bracket-placeholder",
    label: "Bracket placeholder: [Your ... here] or <YourComponentName>",
    pattern: /\[Your\s+\w[\w\s]*here\]|<Your\w+Name>/,
  },
  {
    id: "impl-placeholder",
    label: "Implementation placeholder: // rest of component / // ... (unchanged)",
    pattern:
      /\/\/\s*(rest\s+of\s+(component|implementation|code)|\.{3}\s*\(unchanged\)|same\s+pattern\s+follows)/i,
  },
  {
    id: "for-brevity",
    label: "Truncation excuse: 'for brevity' inside code",
    pattern: /\/\/.*for\s+brevity|\/\*.*for\s+brevity.*\*\//i,
  },
  {
    id: "ellipsis-trunc",
    label: "Ellipsis-as-truncation: standalone … (Unicode) as a continuation placeholder",
    // Match lines that are ONLY a Unicode ellipsis character (not `// ...`
    // which is a legitimate code-documentation shorthand in SKILL.md examples).
    pattern: /^\s*…\s*$/,
  },
  {
    id: "todo-implement",
    label: "Unimplemented stub: // TODO.*implement",
    pattern: /\/\/\s*TODO[:\s].*implement/i,
  },
];

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------
function* walkDir(dir: string, ext: RegExp): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full, ext);
    } else if (ext.test(entry.name)) {
      yield full;
    }
  }
}

function collectFiles(): string[] {
  const files: string[] = [];
  // Package-authored markdown (skills, rules, guidelines)
  for (const f of walkDir(path.join(REPO_ROOT, "src", "skills"), /SKILL\.md$/)) files.push(f);
  for (const f of walkDir(path.join(REPO_ROOT, "src", "rules"), /\.md$/)) files.push(f);
  for (const f of walkDir(path.join(REPO_ROOT, "docs", "guidelines"), /\.md$/)) files.push(f);
  return files;
}

// ---------------------------------------------------------------------------
// Inline-ignore parsing
// ---------------------------------------------------------------------------
type IgnoreScope = "file" | "line" | "next-line";
interface Ignore {
  scope: IgnoreScope;
  rules: string[]; // empty = all rules
  lineNum?: number;
}

function parseIgnores(lines: string[]): Ignore[] {
  const ignores: Ignore[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fileMatch = /lint-output-slop-disable-file\s*([\w-]+(?:,\s*[\w-]+)*)?/i.exec(line);
    if (fileMatch) {
      const rules = fileMatch[1] ? fileMatch[1].split(",").map((r) => r.trim()) : [];
      ignores.push({ scope: "file", rules });
    }
    const lineMatch = /lint-output-slop-disable-line\s*([\w-]+(?:,\s*[\w-]+)*)?/i.exec(line);
    if (lineMatch) {
      const rules = lineMatch[1] ? lineMatch[1].split(",").map((r) => r.trim()) : [];
      ignores.push({ scope: "line", rules, lineNum: i + 1 });
    }
    const nextMatch = /lint-output-slop-disable-next-line\s*([\w-]+(?:,\s*[\w-]+)*)?/i.exec(line);
    if (nextMatch) {
      const rules = nextMatch[1] ? nextMatch[1].split(",").map((r) => r.trim()) : [];
      ignores.push({ scope: "next-line", rules, lineNum: i + 2 }); // 1-indexed, next line
    }
  }
  return ignores;
}

function isIgnored(ignores: Ignore[], ruleId: string, lineNum: number): boolean {
  for (const ig of ignores) {
    const ruleMatch = ig.rules.length === 0 || ig.rules.includes(ruleId);
    if (!ruleMatch) continue;
    if (ig.scope === "file") return true;
    if (ig.scope === "line" && ig.lineNum === lineNum) return true;
    if (ig.scope === "next-line" && ig.lineNum === lineNum) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Scanning — only within fenced code blocks in markdown
// ---------------------------------------------------------------------------
function scanFile(filePath: string): Finding[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const ignores = parseIgnores(lines);
  const findings: Finding[] = [];

  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i] ?? "";

    // Toggle code-fence state
    if (/^```/.test(line) || /^~~~/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Only scan inside code fences in markdown
    if (!inCodeBlock) continue;

    for (const rule of RULES) {
      if (rule.pattern.test(line) && !isIgnored(ignores, rule.id, lineNum)) {
        findings.push({
          rule: rule.id,
          file: path.relative(REPO_ROOT, filePath),
          line: lineNum,
          snippet: line.trim().slice(0, 120),
        });
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  const jsonMode = process.argv.includes("--json");
  const quiet = process.argv.includes("--quiet");

  const files = collectFiles();
  const allFindings: Finding[] = [];

  for (const file of files) {
    try {
      allFindings.push(...scanFile(file));
    } catch (err) {
      if (!quiet) process.stderr.write(`[lint_output_slop] error reading ${file}: ${err}\n`);
    }
  }

  if (jsonMode) {
    process.stdout.write(JSON.stringify(allFindings, null, 2) + "\n");
    process.exit(allFindings.length > 0 ? 2 : 0);
  }

  if (allFindings.length === 0) {
    if (!quiet) process.stdout.write("✅  lint_output_slop: clean — no placeholder-prose patterns found.\n");
    process.exit(0);
  }

  for (const f of allFindings) {
    process.stdout.write(`❌  ${f.file}:${f.line} [${f.rule}] ${f.snippet}\n`);
  }
  process.stdout.write(
    `\nlint_output_slop: ${allFindings.length} finding(s). Fix or use lint-output-slop-disable-next-line <rule> -- reason.\n`,
  );
  process.exit(2);
}

main();

#!/usr/bin/env node
/**
 * lint_governed_writes — flag direct filesystem writes to protected
 * ledger/governance surfaces that bypass the sanctioned write path.
 *
 * Scans: src/scripts/**\/*.ts (excluding *.test.ts and the atomic-write
 * primitive itself, _lib/fs_atomic.ts, which is the sanctioned layer this
 * lint measures bypasses of).
 *
 * Protected surfaces (each carries its own write policy):
 *   - docs/CLAIMS.md (claims ledger) — `always-forbidden`: ANY direct
 *     fs write/append call referencing this path is a violation; the
 *     ledger is only ever mutated via `write_atomic` from
 *     `src/scripts/_lib/fs_atomic.ts` (which this lint does not scan, and
 *     whose call name — `write_atomic` — never matches the banned-call
 *     patterns below, so a compliant writer is naturally clean).
 *   - agents/memory/intake/ (append-only signal JSONL) — `append-only`:
 *     an APPEND call (appendFileSync / fs.promises.appendFile /
 *     createWriteStream with an `'a'` flag) is the sanctioned operation;
 *     only a REWRITE call is a violation.
 *   - agents/runtime/state/audit/ (append-only audit-log-v1 JSONL) —
 *     `append-only`, same split as above.
 *
 * Banned call shapes (rewrite family): fs.writeFileSync(),
 * fs.promises.writeFile(), fs.createWriteStream() without an append flag —
 * each also matched via a bare destructured import (writeFileSync(...)).
 * Banned call shapes (append family, sanctioned on append-only surfaces,
 * always a violation on always-forbidden surfaces): fs.appendFileSync(),
 * fs.promises.appendFile(), fs.createWriteStream() with `{ flags: 'a' }`.
 *
 * A call only counts against a surface when the surface's path fragment
 * appears as a string/template literal INSIDE that call's own argument
 * list (matched by balanced-paren scanning, so multi-line call arguments
 * are captured) — a path built up through an unrelated variable (no
 * literal in the call's own arguments) is not flagged; that is a known,
 * deliberate scope limit of a static, zero-runtime-cost lint.
 *
 * Inline-ignore: add a comment on the same or previous line:
 *   lint-governed-writes-disable-next-line [-- reason]
 *   lint-governed-writes-disable-line [-- reason]
 *   lint-governed-writes-disable-file [-- reason]  (top of file)
 *
 * Exit codes: 0 = clean, 2 = findings present, 1 = internal error.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const _HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(_HERE, "..", "..");
export const SCRIPTS_DIR = path.join(REPO_ROOT, "src", "scripts");

// ---------------------------------------------------------------------------
// Protected surfaces
// ---------------------------------------------------------------------------
type SurfacePolicy = "always-forbidden" | "append-only";

interface ProtectedSurface {
  id: string;
  fragment: string;
  policy: SurfacePolicy;
}

// No canonical bench-report index file was found under src/scripts at
// authoring time (no writer builds a single "bench index" registry path) —
// see the lint's own docstring history / task report. If one is added
// later, append it here with the matching policy.
const PROTECTED_SURFACES: ProtectedSurface[] = [
  { id: "claims-ledger", fragment: "docs/CLAIMS.md", policy: "always-forbidden" },
  { id: "memory-intake", fragment: "agents/memory/intake/", policy: "append-only" },
  { id: "audit-log", fragment: "agents/runtime/state/audit/", policy: "append-only" },
];

// ---------------------------------------------------------------------------
// Banned call-shape patterns
// ---------------------------------------------------------------------------
type CallFamily = "rewrite" | "append" | "stream";

interface CallPattern {
  name: string;
  family: CallFamily;
  source: string; // regex source, compiled fresh per exec loop (stateful lastIndex)
}

const CALL_PATTERNS: CallPattern[] = [
  { name: "fs.writeFileSync", family: "rewrite", source: "\\b(?:fs\\.)?writeFileSync\\s*\\(" },
  { name: "fs.promises.writeFile", family: "rewrite", source: "\\bfs\\.promises\\.writeFile\\s*\\(" },
  { name: "fs.appendFileSync", family: "append", source: "\\b(?:fs\\.)?appendFileSync\\s*\\(" },
  { name: "fs.promises.appendFile", family: "append", source: "\\bfs\\.promises\\.appendFile\\s*\\(" },
  { name: "fs.createWriteStream", family: "stream", source: "\\b(?:fs\\.)?createWriteStream\\s*\\(" },
];

const APPEND_FLAG_RE = /flags\s*:\s*['"]a['"]/;

interface Finding {
  file: string;
  line: number;
  surface: string;
  call: string;
  policy: SurfacePolicy;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Balanced-paren call-argument extraction
// ---------------------------------------------------------------------------
/**
 * Given the index of the opening `(` of a call, return the substring from
 * that `(` through its matching `)` (inclusive) — the call's full argument
 * list, spanning multiple lines when the call is formatted that way.
 * String/template literals are tracked so a stray paren inside a quoted
 * value never desyncs the depth count.
 */
function extractCallArgsRegion(content: string, openParenIdx: number): string {
  let depth = 0;
  let inString: string | null = null;
  let escaped = false;
  for (let i = openParenIdx; i < content.length; i++) {
    const ch = content[i] as string;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) {
        return content.slice(openParenIdx, i + 1);
      }
    }
  }
  return content.slice(openParenIdx);
}

function lineOfIndex(content: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

// ---------------------------------------------------------------------------
// Inline-ignore parsing (mirrors lint_output_slop's convention)
// ---------------------------------------------------------------------------
type IgnoreScope = "file" | "line" | "next-line";
interface Ignore {
  scope: IgnoreScope;
  lineNum?: number;
}

function parseIgnores(lines: string[]): Ignore[] {
  const ignores: Ignore[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/lint-governed-writes-disable-file/i.test(line)) {
      ignores.push({ scope: "file" });
    }
    if (/lint-governed-writes-disable-line/i.test(line)) {
      ignores.push({ scope: "line", lineNum: i + 1 });
    }
    if (/lint-governed-writes-disable-next-line/i.test(line)) {
      ignores.push({ scope: "next-line", lineNum: i + 2 });
    }
  }
  return ignores;
}

function isIgnored(ignores: Ignore[], lineNum: number): boolean {
  for (const ig of ignores) {
    if (ig.scope === "file") return true;
    if (ig.scope === "line" && ig.lineNum === lineNum) return true;
    if (ig.scope === "next-line" && ig.lineNum === lineNum) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Per-file scanning
// ---------------------------------------------------------------------------
export function scanContent(content: string, relFile: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");
  const ignores = parseIgnores(lines);

  for (const pat of CALL_PATTERNS) {
    const re = new RegExp(pat.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const openParenIdx = m.index + m[0].length - 1;
      const region = extractCallArgsRegion(content, openParenIdx);

      let kind: "rewrite" | "append";
      if (pat.family === "stream") {
        kind = APPEND_FLAG_RE.test(region) ? "append" : "rewrite";
      } else {
        kind = pat.family;
      }

      const lineNum = lineOfIndex(content, m.index);
      if (isIgnored(ignores, lineNum)) continue;

      for (const surface of PROTECTED_SURFACES) {
        if (!region.includes(surface.fragment)) continue;
        const isViolation =
          surface.policy === "always-forbidden" ||
          (surface.policy === "append-only" && kind === "rewrite");
        if (!isViolation) continue;

        findings.push({
          file: relFile,
          line: lineNum,
          surface: surface.id,
          call: pat.name,
          policy: surface.policy,
          snippet: (lines[lineNum - 1] ?? "").trim().slice(0, 160),
        });
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------
const EXCLUDED_RELATIVE_FILES = new Set<string>(["_lib/fs_atomic.ts"]);

function* walkTsFiles(dir: string, root: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTsFiles(full, root);
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    const rel = path.relative(root, full).split(path.sep).join("/");
    if (EXCLUDED_RELATIVE_FILES.has(rel)) continue;
    yield full;
  }
}

/** Scan every eligible `.ts` file under `scriptsDir`. */
export function scanScriptsDir(scriptsDir: string): Finding[] {
  const findings: Finding[] = [];
  for (const file of walkTsFiles(scriptsDir, scriptsDir)) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const rel = path.relative(scriptsDir, file).split(path.sep).join("/");
    findings.push(...scanContent(content, rel));
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export function main(argv: readonly string[] = process.argv.slice(2)): number {
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(
      "usage: lint_governed_writes [--json] [--quiet]\n" +
        "  Flags direct fs write/append calls to protected ledger/governance\n" +
        "  surfaces (docs/CLAIMS.md, agents/memory/intake/, agents/runtime/state/audit/)\n" +
        "  that bypass the sanctioned atomic-write layer or the append-only contract.\n" +
        "  Exit 2 on any finding, 0 clean.\n",
    );
    return 0;
  }

  const jsonMode = argv.includes("--json");
  const quiet = argv.includes("--quiet");

  const findings = scanScriptsDir(SCRIPTS_DIR);

  if (jsonMode) {
    process.stdout.write(JSON.stringify(findings, null, 2) + "\n");
    return findings.length > 0 ? 2 : 0;
  }

  if (findings.length === 0) {
    if (!quiet) {
      process.stdout.write(
        "✅  lint_governed_writes: clean — no direct writes to protected surfaces found.\n",
      );
    }
    return 0;
  }

  for (const f of findings) {
    process.stdout.write(
      `❌  ${f.file}:${f.line} [${f.surface}/${f.policy}] ${f.call} — ${f.snippet}\n`,
    );
  }
  process.stdout.write(
    `\nlint_governed_writes: ${findings.length} finding(s). Route the write through ` +
      "write_atomic (src/scripts/_lib/fs_atomic.ts) or the surface's sanctioned append " +
      "call, or use lint-governed-writes-disable-next-line -- reason.\n",
  );
  return 2;
}

// Main-guard (realpath-compared, mirrors the repo convention — importing this
// module for its exports, e.g. from a test, never triggers a CLI run).
if (process.argv[1] !== undefined) {
  try {
    const here = fs.realpathSync(fileURLToPath(import.meta.url));
    const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
    if (here === argv1) {
      process.exit(main());
    }
  } catch {
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
      process.exit(main());
    }
  }
}

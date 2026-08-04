#!/usr/bin/env node
/**
 * P1.6 — umbrella runner for the agent-security self-audit linters.
 *
 * Ported from the retired Python `src/scripts/lint_agent_security.py` (ADR-200 —
 * Python→TS migration). Mirrors the CLI contract EXACTLY: the `--sarif PATH`
 * / `--quiet` flags, the per-linter glyph lines, the aggregated summary, the
 * byte-identical SARIF report (`json.dumps(indent=2)` parity), and the exit
 * codes (0 clean / 1 blocking finding).
 *
 * Runs the four Phase-1 corpus linters (hidden-unicode, instruction-smuggling,
 * mcp-config-security, dangerous-frontmatter) under the shared false-positive
 * containment convention, aggregates their findings, and reports once. Supply-
 * chain integrity gate for the suite's *own* artifacts
 * (road-to-security-pillar.md P1).
 *
 * The four child linters now have TypeScript twins, so this runner spawns each
 * `<child>.ts --json` via the repo-local `tsx` binary (the retired Python implementations
 * were deleted in the ADR-200 migration). Each child is a separate process so
 * its JSON findings are aggregated here exactly as the retired Python implementation
 * aggregated `subprocess.run` output.
 *
 * Usage:
 *   ./scripts-run src/scripts/lint_agent_security [--sarif artifacts/agent-security.sarif]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runCountedProbe } from "./_lib/counted_probe.js";
import { assertWatchlistResolves, DeadScopeError } from "./_lib/scan_scope.js";

const _HERE = path.dirname(fileURLToPath(import.meta.url));

// src/scripts → repo root is two levels up (src/scripts/<file>).
const REPO_ROOT = path.resolve(_HERE, "..", "..");
const tsxBin = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

type Finding = Record<string, unknown>;

const LINTERS: ReadonlyArray<[string, string]> = [
  ["hidden-unicode", "lint_hidden_unicode.ts"],
  ["mixed-script-confusable", "lint_confusables.ts"],
  ["instruction-smuggling", "lint_instruction_smuggling.ts"],
  ["mcp-config-security", "lint_mcp_config_security.ts"],
  ["dangerous-frontmatter", "lint_skill_frontmatter_safety.ts"],
];

function _run(script: string): [number, Finding[]] {
  // Spawn the child linter's `.ts` twin via the repo-local tsx binary
  // (capture_output=True, text=True equivalent). Mirrors the retired Python implementation's
  // `subprocess.run([sys.executable, HERE/<child>.py, "--json"])`, now that the
  // children are TypeScript and the `.py` originals are deleted.
  // Bounded read: a truncated `--json` payload would fail to parse and be
  // swallowed as zero findings — a security aggregate reporting clean because
  // it lost the answer. `runCountedProbe` throws on overflow instead.
  const proc = runCountedProbe(tsxBin, [path.join(_HERE, script), "--json"]);
  let findings: Finding[];
  try {
    const parsed: unknown = JSON.parse((proc.stdout ?? "") || "[]");
    findings = Array.isArray(parsed) ? (parsed as Finding[]) : [];
  } catch {
    findings = [];
  }
  // Python returncode of a normally-exited process is its exit code; spawnSync
  // reports null when the process was signalled / failed to spawn.
  const returncode = proc.status ?? 1;
  return [returncode, findings];
}

function _is_fail(f: Finding): boolean {
  const weight = f["weight"];
  const weightNum = typeof weight === "number" ? weight : 1.0;
  return f["severity"] === "HIGH" && weightNum >= 1.0;
}

interface SarifReport {
  $schema: string;
  version: string;
  runs: unknown[];
}

function _sarif(all_findings: Finding[]): SarifReport {
  const results: unknown[] = [];
  for (const f of all_findings) {
    const lineRaw = f["line"];
    // Python: max(1, int(f.get("line", 1) or 1))
    let lineVal: number;
    const coerced = lineRaw === undefined || lineRaw === null ? 1 : lineRaw;
    const truthy = coerced !== 0 && coerced !== "" && coerced !== false;
    const base = truthy ? coerced : 1;
    const asInt = typeof base === "number" ? Math.trunc(base) : Number.parseInt(String(base), 10);
    lineVal = Math.max(1, Number.isFinite(asInt) ? asInt : 1);
    results.push({
      ruleId: (f["check"] as string | undefined) ?? "security-lint",
      level: _is_fail(f) ? "error" : "warning",
      message: { text: (f["message"] as string | undefined) ?? "" },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: (f["path"] as string | undefined) ?? "" },
            region: { startLine: lineVal },
          },
        },
      ],
    });
  }
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "agent-security-lint",
            informationUri: "https://github.com/event4u-app/agent-config",
            rules: LINTERS.map(([cid]) => ({ id: cid })),
          },
        },
        results,
      },
    ],
  };
}

// json.dumps(obj, indent=2) parity: JSON.stringify(obj, null, 2) matches
// Python's separators (',', ': ') under indent. Python's default
// ensure_ascii=True escapes every non-ASCII UTF-16 code unit as lowercase
// \uXXXX; post-process to match (sort_keys defaults to False → insertion
// order preserved, which JSON.stringify also preserves).
function _pyJsonDumpsIndent2(obj: unknown): string {
  const raw = JSON.stringify(obj, null, 2);
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code > 0x7f) {
      out += `\\u${code.toString(16).padStart(4, "0")}`;
    } else {
      out += raw[i] as string;
    }
  }
  return out;
}

interface ParsedArgs {
  sarif: string | null;
  quiet: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { sarif: null, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] as string;
    if (a === "--sarif" || a.startsWith("--sarif=")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        out.sarif = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined) {
          process.stderr.write(
            "lint_agent_security: error: argument --sarif: expected one argument\n",
          );
          process.exit(2);
        }
        i += 1;
        out.sarif = next;
      }
    } else if (a === "--quiet") {
      out.quiet = true;
    } else if (a === "-h" || a === "--help") {
      process.stdout.write(
        "usage: lint_agent_security [-h] [--sarif PATH] [--quiet]\n",
      );
      process.exit(0);
    }
  }
  return out;
}

export function main(argv: string[] | null = null): number {
  const args = parse_args(argv ?? process.argv.slice(2));

  // This runner owns no corpus of its own — it guards five named child linters,
  // so its scope is that watch list. `_run` swallows an unparseable child
  // payload as zero findings, which means a renamed or deleted child scores the
  // umbrella "✅ clean (0 blocking)" instead of reporting that it never ran.
  try {
    assertWatchlistResolves({
      gate: "lint_agent_security",
      candidates: LINTERS.map(([, script]) => path.posix.join("src", "scripts", script)),
      repoRoot: REPO_ROOT,
    });
  } catch (e) {
    if (e instanceof DeadScopeError) {
      process.stderr.write(`❌  ${e.message}\n`);
      return 1;
    }
    throw e;
  }

  const all_findings: Finding[] = [];
  let blocking = 0;
  for (const [check, script] of LINTERS) {
    const [, findings] = _run(script);
    all_findings.push(...findings);
    const fails = findings.filter((f) => _is_fail(f)).length;
    const warns = findings.length - fails;
    blocking += fails;
    const glyph = fails ? "❌" : warns ? "⚠️" : "✅";
    process.stdout.write(`  ${glyph} ${check}: ${fails} blocking, ${warns} warning(s)\n`);
  }

  if (args.sarif) {
    const out = args.sarif;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, _pyJsonDumpsIndent2(_sarif(all_findings)), "utf-8");
    process.stdout.write(`  SARIF → ${args.sarif}\n`);
  }

  process.stdout.write("\n");
  if (blocking) {
    process.stdout.write(
      `❌  agent-security: ${blocking} blocking finding(s). ` +
        `Run each linter directly for detail (e.g. ./scripts-run src/scripts/lint_hidden_unicode).\n`,
    );
    return 1;
  }
  const warn_total = all_findings.length;
  process.stdout.write(
    `✅  agent-security: clean (0 blocking, ${warn_total} warning(s)).\n`,
  );
  return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
  process.exit(main());
}

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
import { runCountedProbe, type ProbeResult } from "./_lib/counted_probe.js";
import { assertWatchlistResolves, DeadScopeError, reportScanned } from "./_lib/scan_scope.js";
import { runGateCli, runSelfTest } from "./_lib/gate_self_test.js";
import os from "node:os";

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

/**
 * How one child linter is executed.
 *
 * A seam, not a policy: the production runner is `_spawnChild` below and is the
 * default everywhere. It exists so the failure corpus can drive each way a
 * child can fail to ANSWER — non-zero with empty stdout, zero with unparsable
 * stdout, and a spawn that never happened — without planting a broken linter in
 * the tree. The four ways are not reproducible any other way: a real child that
 * crashes on demand is a child that has to be able to crash in production.
 */
export type ChildRunResult = ProbeResult | { readonly skipped: SkipReason };
export type ChildRunner = (script: string) => ChildRunResult;

// Spawn the child linter's `.ts` twin via the repo-local tsx binary
// (capture_output=True, text=True equivalent). Mirrors the retired Python implementation's
// `subprocess.run([sys.executable, HERE/<child>.py, "--json"])`, now that the
// children are TypeScript and the `.py` originals are deleted.
// Bounded read: a truncated `--json` payload would fail to parse and be
// swallowed as zero findings — a security aggregate reporting clean because
// it lost the answer. `runCountedProbe` throws on overflow instead.
function _spawnChild(root: string | null): ChildRunner {
  return (script) =>
    runCountedProbe(tsxBin, [
      path.join(_HERE, script),
      "--json",
      ...(root === null ? [] : ["--root", root]),
    ]);
}

/**
 * The closed set of terminal outcomes a child run can have.
 *
 * Closed is the whole point. Before this, a child had one outcome — "here are
 * its findings" — and every way of not answering collapsed into an empty
 * findings array indistinguishable from a clean run. Three states make the
 * distinction expressible, and `failed` is the one that blocks.
 */
export type ChildOutcome =
  | {
      readonly kind: "completed";
      readonly findings: Finding[];
      readonly exitCode: number;
      /** Artifacts this child reported inspecting. See `CHILD_SCANNED` below. */
      readonly scanned: number;
    }
  | { readonly kind: "failed"; readonly detail: string; readonly exitCode: number | null }
  | { readonly kind: "skipped"; readonly reason: SkipReason };

/**
 * Skip reasons, as a RUNNER CONSTANT rather than configuration.
 *
 * A configurable skip list is a fail-open switch with a settings file in front
 * of it: whoever can add a reason can silence a child. Keeping the set here
 * means adding one is a reviewed code change in the gate itself.
 *
 * NO CHILD PRODUCES A SKIP TODAY, and that is stated rather than implied — all
 * five apply on every platform this suite runs on. The state exists because the
 * alternative to having it is the pressure this repair creates: once a
 * non-completing child blocks, a genuinely non-applicable child would have to
 * be expressed as `failed`, and the fix for that would be to weaken `failed`.
 * A legal non-failing terminal state is what stops that. It is exercised
 * through the runner seam in the failure corpus, so the branch is not dead.
 */
export const SKIP_REASONS = {
  PLATFORM_NOT_APPLICABLE: "not applicable on this platform",
} as const;
export type SkipReason = (typeof SKIP_REASONS)[keyof typeof SKIP_REASONS];

/**
 * The child `--json` contract, stated so a violation of it is nameable:
 *
 *   exit 0  — ran, here is the findings array (possibly empty)
 *   exit 1  — ran, here is the findings array (non-empty)
 *   anything else, or a non-array payload, or unparsable stdout, or no run at
 *   all — the child did not answer.
 *
 * Exit 1 with an EMPTY array is a violation and not a nit: every child returns
 * its dead-scope code (1 or 2) with nothing on stdout, which is precisely the
 * "the corpus moved and I read nothing" case that used to score as clean.
 */
function _classify(res: ChildRunResult): ChildOutcome {
  // The execution layer decides WHETHER a child applies here; the reason it may
  // give comes from `SKIP_REASONS` above, so a new reason is a reviewed code
  // change in this file rather than a value someone can supply.
  if ("skipped" in res) {
    return { kind: "skipped", reason: res.skipped };
  }
  const proc = res;
  // spawnSync reports null when the process was signalled or never spawned.
  if (proc.status === null) {
    return {
      kind: "failed",
      exitCode: null,
      detail: `the child never ran (${proc.failure ?? "no exit status reported"})`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse((proc.stdout ?? "") || "[]");
  } catch {
    return {
      kind: "failed",
      exitCode: proc.status,
      detail:
        `exited ${String(proc.status)} and its stdout was not JSON — a crashed child that ` +
        "printed a diagnostic used to be read as zero findings",
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      kind: "failed",
      exitCode: proc.status,
      detail:
        `exited ${String(proc.status)} and its stdout parsed but was not a findings array — ` +
        "a JSON error object used to be read as zero findings",
    };
  }
  const findings = parsed as Finding[];
  if (proc.status !== 0 && !(proc.status === 1 && findings.length > 0)) {
    return {
      kind: "failed",
      exitCode: proc.status,
      detail:
        `exited ${String(proc.status)} with ${String(findings.length)} finding(s), which is outside ` +
        "the --json contract (0 = clean, 1 = findings; every other code means it could not run)",
    };
  }
  // A child that ran but did not say what it read leaves the aggregate unable to
  // publish a real corpus size — the same class of unknown as a crashed child,
  // so it gets the same verdict rather than a silent zero.
  const scanned = _childScanned(proc.stderr ?? "");
  if (scanned === null) {
    return {
      kind: "failed",
      exitCode: proc.status,
      detail:
        `exited ${String(proc.status)} without reporting what it inspected — an aggregate ` +
        "corpus size cannot be published from a child that did not state one",
    };
  }
  return { kind: "completed", findings, exitCode: proc.status, scanned };
}

/** Read a child's `scanned: <N>` line off its stderr. `null` = it printed none. */
function _childScanned(stderr: string): number | null {
  for (const line of stderr.split("\n")) {
    const m = /^scanned: (\d+)$/.exec(line.trim());
    if (m) {
      return Number.parseInt(m[1] as string, 10);
    }
  }
  return null;
}

function _run(script: string, runChild: ChildRunner): ChildOutcome {
  return _classify(runChild(script));
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

function _sarif(all_findings: Finding[], outcomes: ReadonlyArray<[string, string, ChildOutcome]>): SarifReport {
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
  // Execution state rides in SARIF's OWN `invocations` array — the schema
  // already models "did this tool run and with what exit code", so a parallel
  // metadata block beside it would be a second, unread copy of the same fact.
  // One invocation per child, in the order the children ran.
  //
  // `executionSuccessful` is the field a SARIF consumer reads to decide whether
  // an empty `results` array means "clean" or "never looked". That is exactly
  // the question this whole repair is about, so it is the field that carries it.
  const invocations = outcomes.map(([, script, outcome]) => ({
    commandLine: `${script} --json`,
    executionSuccessful: outcome.kind === "completed",
    ...(outcome.kind === "skipped" || outcome.exitCode === null
      ? {}
      : { exitCode: outcome.exitCode }),
  }));
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
        invocations,
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
  /** Bounded scan base, forwarded verbatim to every child. Null = the package root. */
  root: string | null;
  selfTest: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { sarif: null, quiet: false, root: null, selfTest: false };
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
    } else if (a === "--root" || a.startsWith("--root=")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        out.root = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined) {
          process.stderr.write(
            "lint_agent_security: error: argument --root: expected one argument\n",
          );
          process.exit(2);
        }
        i += 1;
        out.root = next;
      }
    } else if (a === "--self-test") {
      out.selfTest = true;
    } else if (a === "--quiet") {
      out.quiet = true;
    } else if (a === "-h" || a === "--help") {
      process.stdout.write(
        "usage: lint_agent_security [-h] [--sarif PATH] [--quiet] [--root DIR] [--self-test]\n",
      );
      process.exit(0);
    }
  }
  return out;
}

export interface MainOptions {
  /** Override how child linters are executed. Test seam; production uses `_spawnChild`. */
  readonly runChild?: ChildRunner;
}

export function main(argv: string[] | null = null, opts: MainOptions = {}): number {
  const args = parse_args(argv ?? process.argv.slice(2));
  if (args.selfTest) {
    return _selfTest();
  }
  const runChild = opts.runChild ?? _spawnChild(args.root);

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
  const outcomes: Array<[string, string, ChildOutcome]> = [];
  const notCompleted: string[] = [];
  let blocking = 0;
  let totalScanned = 0;
  for (const [check, script] of LINTERS) {
    const outcome = _run(script, runChild);
    outcomes.push([check, script, outcome]);
    if (outcome.kind === "failed") {
      // Named on the line, because "one child failed" sends a reader to five
      // linters. The exit code stays on the line for the same reason.
      notCompleted.push(check);
      process.stdout.write(`  ❌ ${check}: did not complete — ${outcome.detail}\n`);
      continue;
    }
    if (outcome.kind === "skipped") {
      process.stdout.write(`  ⏭️ ${check}: skipped — ${outcome.reason}\n`);
      continue;
    }
    const findings = outcome.findings;
    totalScanned += outcome.scanned;
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
    fs.writeFileSync(out, _pyJsonDumpsIndent2(_sarif(all_findings, outcomes)), "utf-8");
    process.stdout.write(`  SARIF → ${args.sarif}\n`);
  }

  // Publish what the scan actually read, on EVERY path including the red one.
  // The umbrella owns no corpus of its own — this number is the SUM of the five
  // children's own reported counts, so it is artifact INSPECTIONS rather than
  // distinct artifacts (a file two children read counts twice). That is the
  // stronger collapse detector: a distinct-union figure would stay high while
  // one child's corpus went missing, which is the failure this line exists to
  // make visible. `src/config/gate-coverage.yml` carries the floor.
  reportScanned({
    gate: "lint_agent_security",
    scanned: totalScanned,
    units: "artifact inspection(s) across the five child linters",
    roots: LINTERS.map(([cid]) => cid),
    ...(notCompleted.length > 0
      ? {
          allowEmpty:
            "WATCHLIST_DRIVEN: a child that did not complete reports no count. Zero here means " +
            "every child failed, which this run is already exiting 1 for and naming — the scope " +
            "is not dead, the children are.",
        }
      : {}),
  });

  process.stdout.write("\n");
  // A child that did not answer is reported BEFORE findings and fails on its
  // own. The two are independent verdicts: findings say the corpus is dirty,
  // a non-completing child says the verdict is unknown, and an unknown verdict
  // is not a pass. Both can hold at once, and both print.
  if (notCompleted.length > 0) {
    process.stdout.write(
      `❌  agent-security: ${notCompleted.length} of ${LINTERS.length} child linter(s) did not complete ` +
        `(${notCompleted.join(", ")}). A child that did not answer is not a clean scan — ` +
        "run it directly for its own diagnostic.\n",
    );
    if (blocking) {
      process.stdout.write(
        `❌  agent-security: ${blocking} blocking finding(s) from the children that did complete.\n`,
      );
    }
    return 1;
  }
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

/**
 * `--self-test` — prove, on demand, that the shipped binary still rejects.
 *
 * The two rejecting cases are the two ways this gate is supposed to go red, and
 * they are different failures rather than one failure twice:
 *
 *  - EMPTY SCOPE. Every child asserts its own corpus is non-empty, so an empty
 *    root makes all five exit non-zero with nothing on stdout — which, since the
 *    fail-closed repair, is a run failure the umbrella names. This is also the
 *    negative control the coverage floor owes: the run publishes `scanned: 0`,
 *    and 0 is below any floor above zero, so `check_gate_coverage` reds on it.
 *  - A PLANTED PAYLOAD. A zero-width joiner inside a `.md` file under an
 *    otherwise clean root, which a child must flag as a blocking finding.
 *
 * The accepting case is the same root without the payload. Without it, a gate
 * that returned non-zero unconditionally would score two rejections and look
 * healthy.
 */
function _selfTest(): number {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lint-agent-security-selftest-"));
  const mk = (name: string, body: string): string => {
    const dir = path.join(tmp, name, "src", "skills", "candidate");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), body, "utf-8");
    return path.join(tmp, name);
  };
  const cleanRoot = mk("clean", "---\ntitle: candidate\n---\n\nOrdinary prose with nothing hidden in it.\n");
  // U+200D ZERO WIDTH JOINER between two words — invisible, and exactly the
  // hidden-instruction carrier class this umbrella exists to catch.
  const payloadRoot = mk("payload", "---\ntitle: candidate\n---\n\nOrdinary\u200dprose with something hidden in it.\n");
  const emptyRoot = path.join(tmp, "empty");
  fs.mkdirSync(emptyRoot, { recursive: true });

  const run = (root: string): number =>
    runGateCli(REPO_ROOT, "src/scripts/lint_agent_security.ts", ["--root", root], REPO_ROOT);

  try {
    return runSelfTest({
      gate: "lint_agent_security",
      minCases: 3,
      minRejectCases: 2,
      cases: [
        { name: "empty scope — every child reads nothing and the aggregate refuses", expect: "reject", run: () => run(emptyRoot) },
        { name: "planted zero-width joiner — a child flags it and the aggregate blocks", expect: "reject", run: () => run(payloadRoot) },
        { name: "clean root — the same scope without the payload still passes", expect: "accept", run: () => run(cleanRoot) },
      ],
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
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

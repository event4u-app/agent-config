/**
 * Golden-replay runner — proves a TypeScript port behaves identically to its
 * Python original.
 *
 * CLI:
 *   tsx src/scripts/parity/replay.ts \
 *     --script <repo-relative path without extension> \
 *     --case <case-dir> [--case <case-dir> ...] \
 *     [--normalize json|yaml|none] \
 *     [--divergences <dir>]
 *
 * A case dir contains:
 *   argv.json   required — JSON array of CLI args
 *   stdin.txt   optional — piped to the process
 *   files/      optional — fixture tree copied into a fresh temp cwd per run
 *
 * Behavior: runs `python3 <script>.py` and `tsx <script>.ts` each in its own
 * fresh temp copy of the fixture tree with identical argv/stdin; captures
 * stdout, stderr, exit code, and the full post-run file tree; compares via
 * the engine in compare.ts.
 *
 * Exit code 0 iff every case passes OR every failing comparison is covered by
 * a divergence doc (a markdown file under --divergences containing a line
 * `Script: <repo-relative script path>`). Undocumented mismatches exit 1.
 */

import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import { compareOutcomes, type ChannelDiff, type NormalizeMode, type RunOutcome } from "./compare.js";

export type { ChannelDiff, NormalizeMode, RunOutcome } from "./compare.js";
export { compareOutcomes, deepEqual } from "./compare.js";

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export interface CaseResult {
    /** Case directory (as given). */
    caseDir: string;
    /** Differences between the Python and TypeScript run; empty = match. */
    diffs: ChannelDiff[];
    /** Non-comparison failure (missing argv.json, spawn failure, ...). */
    error?: string;
}

export type ReplayStatus = "pass" | "pass-with-note" | "fail";

export interface ReplayReport {
    /** Script identifier as given (repo-relative, no extension). */
    script: string;
    cases: CaseResult[];
    /** Divergence doc (path) that covers this script, when one matched. */
    divergenceDoc?: string;
    status: ReplayStatus;
}

export interface ReplayOptions {
    /** Repo-relative path of the script WITHOUT extension (e.g. "src/scripts/foo"). */
    script: string;
    /** Case directories. */
    caseDirs: string[];
    normalize?: NormalizeMode;
    /** Directory holding divergence markdown docs. */
    divergencesDir?: string;
    /** Base directory for resolving relative paths (default: process.cwd()). */
    cwd?: string;
}

/** Recursively collect a directory tree as relative-posix-path -> content. */
function listTree(root: string): Map<string, Buffer> {
    const out = new Map<string, Buffer>();
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile()) {
                const rel = path.relative(root, full).split(path.sep).join("/");
                out.set(rel, readFileSync(full));
            }
        }
    };
    walk(root);
    return out;
}

/** Locate the tsx launcher: prefer the repo-local binary, fall back to PATH. */
function resolveTsxCommand(cwd: string): string {
    let dir = cwd;
    for (;;) {
        const candidate = path.join(dir, "node_modules", ".bin", "tsx");
        if (existsSync(candidate)) {
            return candidate;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            return "tsx";
        }
        dir = parent;
    }
}

interface RunSpec {
    command: string;
    args: string[];
}

function runOnce(spec: RunSpec, caseDir: string, stdin: Buffer): RunOutcome {
    const tempCwd = mkdtempSync(path.join(tmpdir(), "parity-replay-"));
    try {
        const fixtureTree = path.join(caseDir, "files");
        if (existsSync(fixtureTree) && statSync(fixtureTree).isDirectory()) {
            cpSync(fixtureTree, tempCwd, { recursive: true });
        }
        const result = spawnSync(spec.command, spec.args, {
            cwd: tempCwd,
            input: stdin,
            maxBuffer: MAX_OUTPUT_BYTES,
        });
        if (result.error !== undefined) {
            throw result.error;
        }
        return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.status ?? -1,
            files: listTree(tempCwd),
        };
    } finally {
        rmSync(tempCwd, { recursive: true, force: true });
    }
}

function loadCaseInputs(caseDir: string): { argv: string[]; stdin: Buffer } {
    const argvPath = path.join(caseDir, "argv.json");
    const raw: unknown = JSON.parse(readFileSync(argvPath, "utf8"));
    if (!Array.isArray(raw) || !raw.every((item): item is string => typeof item === "string")) {
        throw new Error(`${argvPath}: must be a JSON array of strings`);
    }
    const stdinPath = path.join(caseDir, "stdin.txt");
    const stdin = existsSync(stdinPath) ? readFileSync(stdinPath) : Buffer.alloc(0);
    return { argv: raw, stdin };
}

/** Normalize a script reference for divergence matching. */
function canonicalScriptRef(ref: string): string {
    return ref
        .replace(/\\/g, "/")
        .replace(/^\.\//, "")
        .replace(/\.(py|ts)$/, "");
}

/**
 * Find a divergence doc covering the given script: any *.md file in the dir
 * containing a line `Script: <repo-relative script path>` (extension and
 * surrounding backticks/bold markers tolerated).
 */
export function findDivergenceDoc(divergencesDir: string, script: string): string | undefined {
    if (!existsSync(divergencesDir)) {
        return undefined;
    }
    const wanted = canonicalScriptRef(script);
    const lineRe = /^[\s>*-]*\**Script\**:\s*`?([^`\n]+?)`?\s*$/gim;
    for (const entry of readdirSync(divergencesDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) {
            continue;
        }
        const docPath = path.join(divergencesDir, entry.name);
        const text = readFileSync(docPath, "utf8");
        for (const match of text.matchAll(lineRe)) {
            const value = match[1];
            if (value !== undefined && canonicalScriptRef(value.trim()) === wanted) {
                return docPath;
            }
        }
    }
    return undefined;
}

/**
 * Run all cases for one script pair and compare the outcomes.
 *
 * Reusable programmatic entry point — phase-gate CI calls this directly.
 */
export function runReplay(options: ReplayOptions): ReplayReport {
    const cwd = options.cwd ?? process.cwd();
    const normalize = options.normalize ?? "none";
    const scriptBase = path.resolve(cwd, options.script);
    const pyScript = `${scriptBase}.py`;
    const tsScript = `${scriptBase}.ts`;
    const tsxCommand = resolveTsxCommand(cwd);

    const cases: CaseResult[] = [];
    for (const caseDirRaw of options.caseDirs) {
        const caseDir = path.resolve(cwd, caseDirRaw);
        try {
            for (const [label, file] of [
                ["Python", pyScript],
                ["TypeScript", tsScript],
            ] as const) {
                if (!existsSync(file)) {
                    throw new Error(`${label} script not found: ${file}`);
                }
            }
            const { argv, stdin } = loadCaseInputs(caseDir);
            const pyOutcome = runOnce({ command: "python3", args: [pyScript, ...argv] }, caseDir, stdin);
            const tsOutcome = runOnce({ command: tsxCommand, args: [tsScript, ...argv] }, caseDir, stdin);
            cases.push({ caseDir: caseDirRaw, diffs: compareOutcomes(pyOutcome, tsOutcome, normalize) });
        } catch (err) {
            cases.push({
                caseDir: caseDirRaw,
                diffs: [],
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    const hasErrors = cases.some((c) => c.error !== undefined);
    const hasDiffs = cases.some((c) => c.diffs.length > 0);

    let status: ReplayStatus = "pass";
    let divergenceDoc: string | undefined;
    if (hasErrors) {
        // Harness errors (missing script, bad case dir) are never excusable.
        status = "fail";
    } else if (hasDiffs) {
        divergenceDoc =
            options.divergencesDir !== undefined
                ? findDivergenceDoc(path.resolve(cwd, options.divergencesDir), options.script)
                : undefined;
        status = divergenceDoc !== undefined ? "pass-with-note" : "fail";
    }

    const report: ReplayReport = { script: options.script, cases, status };
    if (divergenceDoc !== undefined) {
        report.divergenceDoc = divergenceDoc;
    }
    return report;
}

/** Render a human-readable report to a list of lines. */
export function formatReport(report: ReplayReport): string[] {
    const lines: string[] = [`Script: ${report.script}`];
    for (const c of report.cases) {
        if (c.error !== undefined) {
            lines.push(`  [ERROR] ${c.caseDir}`);
            lines.push(`    ${c.error}`);
            continue;
        }
        if (c.diffs.length === 0) {
            lines.push(`  [PASS]  ${c.caseDir}`);
            continue;
        }
        lines.push(`  [FAIL]  ${c.caseDir}`);
        for (const diff of c.diffs) {
            lines.push(`    ${diff.channel}:`);
            for (const detail of diff.detail) {
                lines.push(`      ${detail}`);
            }
        }
    }
    switch (report.status) {
        case "pass":
            lines.push(`RESULT: PASS (${report.cases.length} case(s))`);
            break;
        case "pass-with-note":
            lines.push(`RESULT: PASS-WITH-NOTE — documented divergence: ${report.divergenceDoc ?? "?"}`);
            break;
        case "fail":
            lines.push("RESULT: FAIL — undocumented mismatch (no matching divergence doc)");
            break;
    }
    return lines;
}

function main(): void {
    const { values } = parseArgs({
        options: {
            script: { type: "string" },
            case: { type: "string", multiple: true },
            normalize: { type: "string", default: "none" },
            divergences: { type: "string" },
        },
        strict: true,
    });

    const script = values.script;
    const caseDirs = values.case;
    if (script === undefined || caseDirs === undefined || caseDirs.length === 0) {
        process.stderr.write(
            "usage: replay.ts --script <path-without-ext> --case <dir>... [--normalize json|yaml|none] [--divergences <dir>]\n",
        );
        process.exit(2);
    }
    const normalize = values.normalize;
    if (normalize !== "json" && normalize !== "yaml" && normalize !== "none") {
        process.stderr.write(`invalid --normalize value: ${String(normalize)} (expected json|yaml|none)\n`);
        process.exit(2);
    }

    const options: ReplayOptions = { script, caseDirs, normalize };
    if (values.divergences !== undefined) {
        options.divergencesDir = values.divergences;
    }
    const report = runReplay(options);
    process.stdout.write(`${formatReport(report).join("\n")}\n`);
    process.exit(report.status === "fail" ? 1 : 0);
}

const isCliEntry =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
    main();
}

/**
 * Parity comparison engine — pure functions, no process spawning.
 *
 * Compares the observable outcome of a Python run vs a TypeScript run of the
 * same script: stdout, stderr, exit code, and the full post-run file tree.
 * Byte-exact by default; opt-in JSON/YAML normalization parses both sides and
 * deep-compares the data instead of the bytes.
 *
 * This module is the reusable core that phase-gate CI can call
 * programmatically (see replay.ts for the CLI wrapper).
 */

import { Buffer } from "node:buffer";
import { parse as parseYaml } from "yaml";

export type NormalizeMode = "json" | "yaml" | "none";

/** Captured outcome of one script run (one runtime, one case). */
export interface RunOutcome {
    /** Raw stdout bytes. */
    stdout: Buffer;
    /** Raw stderr bytes. */
    stderr: Buffer;
    /** Process exit code (-1 when the process was killed by a signal or failed to spawn). */
    exitCode: number;
    /** Post-run file tree: relative path (posix separators) -> content. */
    files: ReadonlyMap<string, Buffer>;
}

/** One difference between the Python and TypeScript outcome. */
export interface ChannelDiff {
    /** e.g. "stdout", "stderr", "exit-code", "file:out/result.json". */
    channel: string;
    /** Human-readable diff summary lines (already truncated). */
    detail: string[];
}

const MAX_DIFF_LINES = 5;
const MAX_LINE_LENGTH = 200;

function truncate(s: string): string {
    return s.length > MAX_LINE_LENGTH ? `${s.slice(0, MAX_LINE_LENGTH)}…` : s;
}

/** Generic structural deep-equality for parsed JSON/YAML data. */
export function deepEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) {
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((item, i) => deepEqual(item, b[i]));
    }
    if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
        if (Array.isArray(a) || Array.isArray(b)) {
            return false;
        }
        const aRec = a as Record<string, unknown>;
        const bRec = b as Record<string, unknown>;
        const aKeys = Object.keys(aRec).sort();
        const bKeys = Object.keys(bRec).sort();
        if (aKeys.length !== bKeys.length) {
            return false;
        }
        return aKeys.every((key, i) => key === bKeys[i] && deepEqual(aRec[key], bRec[key]));
    }
    return false;
}

interface NormalizedCompare {
    equal: boolean;
    /** Set when normalization was requested but parsing failed on a side. */
    parseNote?: string;
}

function compareNormalized(a: Buffer, b: Buffer, mode: NormalizeMode): NormalizedCompare {
    if (mode === "none") {
        return { equal: a.equals(b) };
    }
    const parser: (text: string) => unknown =
        mode === "json" ? (text) => JSON.parse(text) as unknown : (text) => parseYaml(text) as unknown;
    let parsedA: unknown;
    let parsedB: unknown;
    try {
        parsedA = parser(a.toString("utf8"));
        parsedB = parser(b.toString("utf8"));
    } catch (err) {
        // Fall back to byte comparison when either side is not parseable.
        const note = `not parseable as ${mode} (${err instanceof Error ? err.message : String(err)}); compared byte-exact`;
        return { equal: a.equals(b), parseNote: note };
    }
    return { equal: deepEqual(parsedA, parsedB) };
}

/** First-N differing lines between two text blobs. */
function lineDiffSummary(a: Buffer, b: Buffer): string[] {
    const aLines = a.toString("utf8").split("\n");
    const bLines = b.toString("utf8").split("\n");
    const out: string[] = [];
    const max = Math.max(aLines.length, bLines.length);
    for (let i = 0; i < max && out.length < MAX_DIFF_LINES; i += 1) {
        const aLine = aLines[i];
        const bLine = bLines[i];
        if (aLine !== bLine) {
            const left = aLine === undefined ? "<missing>" : JSON.stringify(truncate(aLine));
            const right = bLine === undefined ? "<missing>" : JSON.stringify(truncate(bLine));
            out.push(`line ${i + 1}: py=${left} ts=${right}`);
        }
    }
    const totalDiffering = countDifferingLines(aLines, bLines);
    if (totalDiffering > out.length) {
        out.push(`… ${totalDiffering - out.length} more differing line(s)`);
    }
    return out;
}

function countDifferingLines(aLines: string[], bLines: string[]): number {
    const max = Math.max(aLines.length, bLines.length);
    let count = 0;
    for (let i = 0; i < max; i += 1) {
        if (aLines[i] !== bLines[i]) {
            count += 1;
        }
    }
    return count;
}

function diffBlob(channel: string, py: Buffer, ts: Buffer, mode: NormalizeMode): ChannelDiff | null {
    const result = compareNormalized(py, ts, mode);
    if (result.equal) {
        return null;
    }
    const detail = lineDiffSummary(py, ts);
    if (result.parseNote !== undefined) {
        detail.unshift(result.parseNote);
    }
    return { channel, detail };
}

/**
 * Compare a Python outcome against a TypeScript outcome.
 *
 * Normalization applies to stdout and file contents. stderr and exit code
 * are always compared exactly (error parity relies on exact error channels).
 *
 * @returns Empty array when the outcomes match.
 */
export function compareOutcomes(py: RunOutcome, ts: RunOutcome, mode: NormalizeMode): ChannelDiff[] {
    const diffs: ChannelDiff[] = [];

    if (py.exitCode !== ts.exitCode) {
        diffs.push({
            channel: "exit-code",
            detail: [`py=${py.exitCode} ts=${ts.exitCode}`],
        });
    }

    const stdoutDiff = diffBlob("stdout", py.stdout, ts.stdout, mode);
    if (stdoutDiff !== null) {
        diffs.push(stdoutDiff);
    }

    const stderrDiff = diffBlob("stderr", py.stderr, ts.stderr, "none");
    if (stderrDiff !== null) {
        diffs.push(stderrDiff);
    }

    const allPaths = new Set<string>([...py.files.keys(), ...ts.files.keys()]);
    for (const relPath of [...allPaths].sort()) {
        const pyContent = py.files.get(relPath);
        const tsContent = ts.files.get(relPath);
        if (pyContent === undefined) {
            diffs.push({ channel: `file:${relPath}`, detail: ["only present after the TypeScript run"] });
            continue;
        }
        if (tsContent === undefined) {
            diffs.push({ channel: `file:${relPath}`, detail: ["only present after the Python run"] });
            continue;
        }
        const fileDiff = diffBlob(`file:${relPath}`, pyContent, tsContent, mode);
        if (fileDiff !== null) {
            diffs.push(fileDiff);
        }
    }

    return diffs;
}

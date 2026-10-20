#!/usr/bin/env tsx
/**
 * Report — which tool-result classes enter the reducer's scope?
 *
 * `road-to-tool-results-that-leave-a-handle.md` step 1.1: a class is selected
 * when its model-visible p95 exceeds the D1 threshold AND its results carry a
 * failure-line structure (an exit code and error lines) a summary can keep,
 * AND no non-goal of that roadmap excludes it. A REPORT, not a gate: exits 0.
 *
 * Step 1.2, `--profile content`: results classed exactly as
 * `internal/bench/tool-results-content-profile-PREREG.md` registers them, read
 * over its D11 window only, beside the execution profile on the same window.
 * The same run reports step 1.4's repeat share (`repeatShare`), with no bar.
 *
 * ```bash
 *   report_reducible_classes                      # human table
 *   report_reducible_classes --profile content    # PREREG classes over the D11 window
 *   report_reducible_classes --json
 *   report_reducible_classes --threshold 8192 --project-prefix <slug> --census <path>
 *   report_reducible_classes --read-handle <handle> [--range start:end]   # step 2.4
 * ```
 *
 * Machine-local by construction: it reads this machine's Claude Code
 * transcripts and this workspace's census.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_PROJECTS_ROOT, projectStoreSlug, scanToolResultRecords, scanToolResults, type ToolResultRecord } from './_lib/cc_transcript.js';
import { classifyResult, CONTENT_CLASSES } from './_lib/content_class.js';
import { readHandle } from './_lib/tool_output_spool.js';
import { readCensusLine } from './_lib/tool_result_census.js';

export { classifyResult, CONTENT_CLASSES, type ContentClass, pipelineStages } from './_lib/content_class.js';

const _FILE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_FILE), '..', '..');
const CENSUS = path.join('agents', 'runtime', 'state', 'tool-result-census.jsonl');

export const D1_THRESHOLD_BYTES = 8192;

/** Only a Bash result carries an exit code; every other class returns a body or a confirmation. */
const FAILURE_STRUCTURED = new Set(['Bash']);

function nonGoal(tool: string): 'K3' | 'K7' | null {
    if (tool.endsWith(':image')) return 'K7';
    if (tool === 'Edit' || tool === 'Write') return 'K3';
    return null;
}

export interface ClassInput {
    tool: string;
    count: number;
    payload_bytes: number;
    payload_samples: number[];
}

export interface ClassVerdict {
    tool: string;
    count: number;
    payload_bytes: number;
    p95: number | null;
    above_threshold: boolean;
    failure_structured: boolean;
    non_goal: 'K3' | 'K7' | null;
    selected: boolean;
}

/** Nearest-rank with floor, the convention of the 2026-10-14 distribution. */
export function nearestRankP95(samples: readonly number[]): number | null {
    if (samples.length === 0) return null;
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))] ?? null;
}

export function selectClasses(classes: Record<string, ClassInput>, thresholdBytes: number): ClassVerdict[] {
    return Object.values(classes)
        .map((c) => {
            const p95 = nearestRankP95(c.payload_samples);
            const above = p95 !== null && p95 > thresholdBytes;
            const failure = FAILURE_STRUCTURED.has(c.tool);
            const goal = nonGoal(c.tool);
            return {
                tool: c.tool,
                count: c.count,
                payload_bytes: c.payload_bytes,
                p95,
                above_threshold: above,
                failure_structured: failure,
                non_goal: goal,
                selected: above && failure && goal === null,
            };
        })
        .sort((a, b) => b.payload_bytes - a.payload_bytes);
}

/* -------------------------------------------------------------------------- */
/* Content profile — step 1.2, classes exactly as                              */
/* `internal/bench/tool-results-content-profile-PREREG.md` registers them      */
/* -------------------------------------------------------------------------- */


/** D11: the window opens at the committer date of the PREREG commit `033c3b2aa` and runs 14 days. */
export const D11_WINDOW_START = '2026-10-15T12:26:27+02:00';
export const D11_WINDOW_DAYS = 14;
/** PREREG sample floor: a class with fewer results is `insufficient`, never `out`. */
export const CONTENT_SAMPLE_FLOOR = 200;

export function d11WindowEnd(): string {
    return new Date(Date.parse(D11_WINDOW_START) + D11_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
}

/** Strictly after the start, strictly before the end; a result with no timestamp is outside. */
export function inWindow(timestamp: string | null, startMs: number, endMs: number): boolean {
    if (timestamp === null) return false;
    const t = Date.parse(timestamp);
    return !Number.isNaN(t) && t > startMs && t < endMs;
}


export interface ContentResult {
    tool: string;
    command: string | null;
    bytes: number;
}

export interface ContentClassVerdict {
    class: (typeof CONTENT_CLASSES)[number];
    count: number;
    payload_bytes: number;
    p95: number | null;
    verdict: 'selected' | 'out' | 'insufficient';
}

export interface ContentProfileReport {
    classes: ContentClassVerdict[];
    /** Bash results excluded by construct (leading `cd`, chain, redirect, subshell) — reported, never re-classed. */
    residue: { count: number; above_threshold: number };
    selected: string[];
}

export function contentProfile(results: readonly ContentResult[], thresholdBytes: number, floor = CONTENT_SAMPLE_FLOOR): ContentProfileReport {
    const samples = new Map<string, number[]>(CONTENT_CLASSES.map((c) => [c, []]));
    const residue = { count: 0, above_threshold: 0 };
    for (const r of results) {
        const c = classifyResult(r.tool, r.command);
        if (c === 'residue') {
            residue.count += 1;
            if (r.bytes > thresholdBytes) residue.above_threshold += 1;
        }
        samples.get(c)?.push(r.bytes);
    }
    const classes = CONTENT_CLASSES.map((c): ContentClassVerdict => {
        const s = samples.get(c) as number[];
        const p95 = nearestRankP95(s);
        const verdict = s.length < floor ? 'insufficient' : p95 !== null && p95 > thresholdBytes ? 'selected' : 'out';
        return { class: c, count: s.length, payload_bytes: s.reduce((a, b) => a + b, 0), p95, verdict };
    });
    return { classes, residue, selected: classes.filter((c) => c.verdict === 'selected').map((c) => c.class) };
}

export interface RepeatClassCount {
    count: number;
    bytes: number;
    repeats: number;
    repeat_bytes: number;
}

export interface RepeatShare {
    content: { count: number; bytes: number };
    /** Content results byte-identical to one delivered earlier in the same session; `advised` = a re-read advisory preceded it. */
    repeats: { count: number; bytes: number; advised: number };
    by_class: Record<(typeof CONTENT_CLASSES)[number], RepeatClassCount>;
}

export type RepeatInput = Pick<ToolResultRecord, 'tool' | 'command' | 'bytes' | 'timestamp' | 'session' | 'path' | 'range' | 'digest' | 'advised'>;

/**
 * Step 1.4: the share of content results that repeat an earlier delivery in
 * the same session — same path and range for `Read`, same command for a
 * content-class Bash call, same sha256 over the delivered payload. A `Read`
 * and a `cat` of one file never match each other, so the share is a lower
 * bound. Reported with no bar.
 */
export function repeatShare(records: readonly RepeatInput[]): RepeatShare {
    const by_class = Object.fromEntries(CONTENT_CLASSES.map((c) => [c, { count: 0, bytes: 0, repeats: 0, repeat_bytes: 0 }])) as RepeatShare['by_class'];
    const out: RepeatShare = { content: { count: 0, bytes: 0 }, repeats: { count: 0, bytes: 0, advised: 0 }, by_class };
    const ordered = records
        .map((r, i) => {
            const t = r.timestamp === null ? Number.NaN : Date.parse(r.timestamp);
            return { r, i, t: Number.isNaN(t) ? Number.POSITIVE_INFINITY : t };
        })
        .sort((a, b) => (a.t === b.t ? a.i - b.i : a.t < b.t ? -1 : 1));
    const delivered = new Set<string>();
    for (const { r } of ordered) {
        const c = classifyResult(r.tool, r.command);
        if (!(CONTENT_CLASSES as readonly string[]).includes(c)) continue;
        const k = by_class[c as (typeof CONTENT_CLASSES)[number]];
        out.content.count += 1;
        out.content.bytes += r.bytes;
        k.count += 1;
        k.bytes += r.bytes;
        if (r.digest === null) continue;
        const key = JSON.stringify([r.session, r.tool, r.tool === 'Read' ? [r.path, r.range] : r.command, r.digest]);
        if (delivered.has(key)) {
            out.repeats.count += 1;
            out.repeats.bytes += r.bytes;
            if (r.advised) out.repeats.advised += 1;
            k.repeats += 1;
            k.repeat_bytes += r.bytes;
        } else delivered.add(key);
    }
    return out;
}

export interface CensusSummary {
    legacy: number;
    two_field: number;
    unreadable: number;
    delivered_unknown: number;
    raw_bytes: number;
    delivered_bytes_known: number;
}

export function readCensus(text: string): CensusSummary {
    const out: CensusSummary = { legacy: 0, two_field: 0, unreadable: 0, delivered_unknown: 0, raw_bytes: 0, delivered_bytes_known: 0 };
    for (const line of text.split('\n')) {
        if (line.trim() === '') continue;
        const r = readCensusLine(line);
        if (r === null) {
            out.unreadable += 1;
            continue;
        }
        if (r.shape === 'legacy') out.legacy += 1;
        else out.two_field += 1;
        out.raw_bytes += r.raw_bytes ?? 0;
        if (r.delivered_bytes === null) out.delivered_unknown += 1;
        else out.delivered_bytes_known += r.delivered_bytes;
    }
    return out;
}

function mergeScans(prefix: string, root: string): Record<string, ClassInput> {
    const merged: Record<string, ClassInput> = {};
    const dirs = fs.existsSync(root) ? fs.readdirSync(root).filter((d) => d.startsWith(prefix)) : [];
    for (const dir of dirs) {
        for (const c of Object.values(scanToolResults({ root, projectDir: dir }).classes)) {
            const m = (merged[c.tool] ??= { tool: c.tool, count: 0, payload_bytes: 0, payload_samples: [] });
            m.count += c.count;
            m.payload_bytes += c.payload_bytes;
            m.payload_samples.push(...c.payload_samples);
        }
    }
    return merged;
}

function flag(argv: readonly string[], name: string): string | null {
    const i = argv.indexOf(name);
    return i >= 0 ? (argv[i + 1] ?? null) : null;
}

function windowRecords(prefix: string, root: string, startMs: number, endMs: number): ToolResultRecord[] {
    const dirs = fs.existsSync(root) ? fs.readdirSync(root).filter((d) => d.startsWith(prefix)) : [];
    return dirs.flatMap((dir) => scanToolResultRecords({ root, projectDir: dir })).filter((r) => inWindow(r.timestamp, startMs, endMs));
}

/** Both profiles over the D11 window only; a run before the window closes is labelled a peek (PREREG). */
function mainContent(argv: readonly string[], threshold: number, prefix: string, now: Date): number {
    const startMs = Date.parse(D11_WINDOW_START);
    const endMs = Date.parse(d11WindowEnd());
    const peek = now.getTime() < endMs;
    const records = windowRecords(prefix, DEFAULT_PROJECTS_ROOT, startMs, endMs);
    const content = contentProfile(records, threshold);
    const repeat = repeatShare(records);
    const byTool: Record<string, ClassInput> = {};
    for (const r of records) {
        const m = (byTool[r.tool] ??= { tool: r.tool, count: 0, payload_bytes: 0, payload_samples: [] });
        m.count += 1;
        m.payload_bytes += r.bytes;
        m.payload_samples.push(r.bytes);
    }
    const execution = selectClasses(byTool, threshold);
    const window = { start: D11_WINDOW_START, end: d11WindowEnd(), results: records.length, peek };
    if (argv.includes('--json')) {
        const executionSelected = execution.filter((v) => v.selected).map((v) => v.tool);
        process.stdout.write(`${JSON.stringify({ profile: 'content', threshold, prefix, window, content, repeat_share: repeat, execution, execution_selected: executionSelected }, null, 2)}\n`);
        return 0;
    }
    const lines = [
        `content profile: threshold ${String(threshold)} B, floor ${String(CONTENT_SAMPLE_FLOOR)} results, window ${window.start} .. ${window.end} (${String(records.length)} results), prefix ${prefix}`,
    ];
    if (peek) lines.push('PEEK — the window has not closed; this reading is not a selection (PREREG)');
    for (const c of content.classes) lines.push(`  ${c.verdict.padEnd(12)} ${c.class} n=${String(c.count)} bytes=${String(c.payload_bytes)} p95=${String(c.p95)}`);
    lines.push(`  residue      Bash n=${String(content.residue.count)} above ${String(threshold)} B: ${String(content.residue.above_threshold)}`);
    lines.push(`content selected: ${content.selected.length === 0 ? 'none' : content.selected.join(', ')}`);
    lines.push(
        `repeat share (step 1.4, no bar): ${String(repeat.repeats.count)} of ${String(repeat.content.count)} content results, ${String(repeat.repeats.bytes)} of ${String(repeat.content.bytes)} B, ${String(repeat.repeats.advised)} after a re-read advisory`,
    );
    const executionSelected = execution.filter((v) => v.selected).map((v) => v.tool);
    lines.push(`execution selected (1.1 criterion, same window): ${executionSelected.length === 0 ? 'none' : executionSelected.join(', ')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
}

/**
 * Step 2.4: the stored bytes behind a handle, whole or a `start:end` byte range,
 * written raw to stdout. Any other state exits 1 and names itself on stderr.
 */
function mainReadHandle(argv: readonly string[], handle: string, now: Date): number {
    const spec = flag(argv, '--range');
    const m = spec === null ? null : /^(\d+):(\d+)$/.exec(spec);
    if (spec !== null && m === null) {
        process.stderr.write(`--range wants start:end in bytes, got ${spec}\n`);
        return 2;
    }
    const range = m === null ? undefined : ([Number(m[1]), Number(m[2])] as const);
    const read = readHandle(flag(argv, '--workspace') ?? REPO, handle, range, now.getTime());
    if (read.state !== 'ok' || read.bytes === undefined) {
        process.stderr.write(`handle: ${read.state}\n`);
        return 1;
    }
    process.stdout.write(read.bytes);
    return 0;
}

export function main(argv: readonly string[] = process.argv.slice(2), now: Date = new Date()): number {
    const handle = flag(argv, '--read-handle');
    if (handle !== null) return mainReadHandle(argv, handle, now);
    const threshold = Number(flag(argv, '--threshold') ?? D1_THRESHOLD_BYTES);
    const prefix = flag(argv, '--project-prefix') ?? projectStoreSlug(REPO);
    const profile = flag(argv, '--profile') ?? 'execution';
    if (profile === 'content') return mainContent(argv, threshold, prefix, now);
    if (profile !== 'execution') {
        process.stderr.write(`unknown --profile ${profile} (execution | content)\n`);
        return 2;
    }
    const verdicts = selectClasses(mergeScans(prefix, DEFAULT_PROJECTS_ROOT), threshold);
    const censusPath = flag(argv, '--census') ?? path.join(REPO, CENSUS);
    const census = fs.existsSync(censusPath) ? readCensus(fs.readFileSync(censusPath, 'utf-8')) : null;
    const selected = verdicts.filter((v) => v.selected).map((v) => v.tool);
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ threshold, prefix, selected, verdicts, census }, null, 2)}\n`);
        return 0;
    }
    const lines = [`reducible classes: threshold ${String(threshold)} B (p95, model-visible), prefix ${prefix}`];
    for (const v of verdicts) {
        const why = v.non_goal ?? (v.above_threshold ? '' : 'p95<=threshold') + (v.failure_structured ? '' : ' no-failure-lines');
        lines.push(`  ${v.selected ? 'SELECTED' : 'out     '} ${v.tool} n=${String(v.count)} bytes=${String(v.payload_bytes)} p95=${String(v.p95)} ${why.trim()}`);
    }
    lines.push(`selected: ${selected.length === 0 ? 'none' : selected.join(', ')}`);
    lines.push(census === null ? `census: ${censusPath} absent` : `census: ${JSON.stringify(census)}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (a === _FILE || pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(_FILE);
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());

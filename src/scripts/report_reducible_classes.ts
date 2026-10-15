#!/usr/bin/env tsx
/**
 * Report — which tool-result classes enter the reducer's scope?
 *
 * `road-to-tool-results-that-leave-a-handle.md` step 1.1: a class is selected
 * when its model-visible p95 exceeds the D1 threshold AND its results carry a
 * failure-line structure (an exit code and error lines) a summary can keep,
 * AND no non-goal of that roadmap excludes it. A REPORT, not a gate: exits 0.
 *
 * ```bash
 *   report_reducible_classes                      # human table
 *   report_reducible_classes --json
 *   report_reducible_classes --threshold 8192 --project-prefix <slug> --census <path>
 * ```
 *
 * Machine-local by construction: it reads this machine's Claude Code
 * transcripts and this workspace's census.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_PROJECTS_ROOT, projectStoreSlug, scanToolResults } from './_lib/cc_transcript.js';
import { readCensusLine } from './_lib/tool_result_census.js';

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

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const threshold = Number(flag(argv, '--threshold') ?? D1_THRESHOLD_BYTES);
    const prefix = flag(argv, '--project-prefix') ?? projectStoreSlug(REPO);
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

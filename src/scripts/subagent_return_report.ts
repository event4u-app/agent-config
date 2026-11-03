#!/usr/bin/env tsx
/**
 * What subagent legs did, as counts — never what they said.
 *
 * The return-gate probe can only record whether a return envelope parsed; it
 * cannot say whether a leg that claimed `DONE` wrote anything. This reads the
 * host's subagent transcripts (`<project>/<session>/subagents/agent-*.jsonl`)
 * and their `agent-*.meta.json` sidecars and reports, per agent type: write
 * attempts, successful writes, distinct write targets, the status the leg
 * claimed, the model, spawn depth and effort.
 *
 * Read-only and unwired on purpose: no Taskfile task, gate or hook consumes the
 * numbers. A blocking return gate on them is a separate, parked decision.
 *
 * Output carries only numbers, enums and two timestamps. Paths, session and
 * agent ids, descriptions and message text never reach stdout: targets are
 * counted through a hash set, and an agent type, model or effort that does not
 * look like an identifier is printed as `other`.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PROJECTS_ROOT, listTranscriptFiles } from './_lib/cc_transcript.js';

const _HERE = fileURLToPath(import.meta.url);

const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const HANDBACK_TOOL = 'SubagentHandback';

export const STATUS_CLAIMS = ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED', 'CHECKPOINT'] as const;
export type StatusClaim = (typeof STATUS_CLAIMS)[number] | 'none';

/** Longest alternative first, so `DONE_WITH_CONCERNS` is not read as `DONE`. */
const CLAIM_LINE = /^[\s>*_#-]*(DONE_WITH_CONCERNS|NEEDS_CONTEXT|CHECKPOINT|BLOCKED|DONE)\b/;

const EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

type Block = Record<string, unknown>;
type Rec = Record<string, unknown>;

export interface LegCounts {
    agent_type: string;
    model: string;
    spawn_depth: string;
    meta_missing: boolean;
    writes_attempted: number;
    writes_ok: number;
    target_hashes: Set<string>;
    status_claim: StatusClaim;
    effort: string;
    mtime_ms: number;
}

export interface GroupReport {
    agent_type: string;
    legs: number;
    writes_attempted: number;
    writes_ok: number;
    targets: number;
    models: Record<string, number>;
    spawn_depth: Record<string, number>;
    status_claim: Record<string, number>;
    effort: Record<string, number>;
}

export interface Report {
    totals: { legs: number; writes_attempted: number; writes_ok: number; targets: number; meta_missing: number };
    groups: GroupReport[];
    oldest: string | null;
    newest: string | null;
}

export interface ReportOptions {
    root?: string;
    maxAgeDays?: number;
    now?: Date;
}

function parse(line: string): Rec | null {
    if (line.trim() === '') return null;
    try {
        const v: unknown = JSON.parse(line);
        return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null;
    } catch {
        return null;
    }
}

function blocksOf(rec: Rec): Block[] {
    const msg = rec['message'];
    if (typeof msg !== 'object' || msg === null) return [];
    const content = (msg as Rec)['content'];
    if (!Array.isArray(content)) return [];
    return content.filter((b): b is Block => typeof b === 'object' && b !== null);
}

function asIdentifier(v: unknown, missing: string): string {
    if (v === undefined || v === null || v === '') return missing;
    const s = String(v);
    return IDENTIFIER.test(s) ? s : 'other';
}

function claimIn(text: string): StatusClaim {
    let found: StatusClaim = 'none';
    for (const line of text.split('\n')) {
        const m = CLAIM_LINE.exec(line);
        if (m !== null) found = m[1] as StatusClaim;
    }
    return found;
}

/**
 * The status a leg claimed: the last claim line of its final handback message
 * when it sent one, else of its last assistant text. Text inside a tool input
 * other than the handback (a `DONE` in a Bash command) never counts.
 */
export function statusClaimOf(lines: readonly string[]): StatusClaim {
    let lastText: string | null = null;
    let handback: string | null = null;
    for (const line of lines) {
        const rec = parse(line);
        if (rec === null || rec['type'] !== 'assistant') continue;
        for (const b of blocksOf(rec)) {
            if (b['type'] === 'text' && typeof b['text'] === 'string') {
                lastText = b['text'];
            } else if (b['type'] === 'tool_use' && b['name'] === HANDBACK_TOOL) {
                const input = b['input'];
                const message = typeof input === 'object' && input !== null ? (input as Rec)['message'] : undefined;
                if (typeof message === 'string') handback = message;
            }
        }
    }
    if (handback !== null) return claimIn(handback);
    return lastText === null ? 'none' : claimIn(lastText);
}

function effortOf(records: readonly Rec[]): string {
    const seen = new Set<string>();
    for (const rec of records) {
        if (rec['type'] !== 'assistant' || rec['effort'] === undefined || rec['effort'] === null) continue;
        const e = String(rec['effort']);
        seen.add(EFFORT_LEVELS.has(e) ? e : 'other');
    }
    if (seen.size === 0) return 'null';
    if (seen.size > 1) return 'mixed';
    return [...seen][0] ?? 'null';
}

function readSidecar(transcript: string): Rec | null {
    const sidecar = transcript.replace(/\.jsonl$/, '.meta.json');
    try {
        const v: unknown = JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
        return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null;
    } catch {
        return null;
    }
}

function isLeg(file: string): boolean {
    return path.basename(path.dirname(file)) === 'subagents' && /^agent-.+\.jsonl$/.test(path.basename(file));
}

export function readLeg(file: string): LegCounts {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    const records = lines.map(parse).filter((r): r is Rec => r !== null);

    const writeTargets = new Map<string, string>();
    for (const rec of records) {
        if (rec['type'] !== 'assistant') continue;
        for (const b of blocksOf(rec)) {
            if (b['type'] !== 'tool_use' || typeof b['id'] !== 'string' || !WRITE_TOOLS.has(String(b['name']))) continue;
            const input = (b['input'] ?? {}) as Rec;
            const target = String(input['file_path'] ?? input['notebook_path'] ?? '');
            writeTargets.set(b['id'], createHash('sha256').update(target).digest('hex'));
        }
    }
    let ok = 0;
    const okTargets = new Set<string>();
    for (const rec of records) {
        if (rec['type'] !== 'user') continue;
        for (const b of blocksOf(rec)) {
            if (b['type'] !== 'tool_result' || typeof b['tool_use_id'] !== 'string') continue;
            const target = writeTargets.get(b['tool_use_id']);
            if (target === undefined || b['is_error'] === true) continue;
            ok += 1;
            okTargets.add(target);
        }
    }

    const meta = readSidecar(file);
    let lastModel: unknown;
    for (const rec of records) {
        const msg = rec['message'];
        if (rec['type'] === 'assistant' && typeof msg === 'object' && msg !== null) lastModel = (msg as Rec)['model'] ?? lastModel;
    }
    return {
        agent_type: meta === null ? 'meta_missing' : asIdentifier(meta['agentType'], 'unknown'),
        model: asIdentifier(meta?.['model'] ?? lastModel, 'null'),
        spawn_depth: meta === null ? 'null' : asIdentifier(meta['spawnDepth'], 'null'),
        meta_missing: meta === null,
        writes_attempted: writeTargets.size,
        writes_ok: ok,
        target_hashes: okTargets,
        status_claim: statusClaimOf(lines),
        effort: effortOf(records),
        mtime_ms: fs.statSync(file).mtimeMs,
    };
}

function bump(counts: Record<string, number>, key: string): void {
    counts[key] = (counts[key] ?? 0) + 1;
}

export function buildReport(opts: ReportOptions = {}): Report {
    const files = listTranscriptFiles({
        root: opts.root ?? DEFAULT_PROJECTS_ROOT,
        ...(opts.maxAgeDays === undefined ? {} : { maxAgeDays: opts.maxAgeDays }),
        ...(opts.now === undefined ? {} : { now: opts.now }),
    }).filter(isLeg);
    const legs = files.map(readLeg);

    const groups = new Map<string, GroupReport & { hashes: Set<string> }>();
    const allTargets = new Set<string>();
    for (const leg of legs) {
        const g = groups.get(leg.agent_type) ?? {
            agent_type: leg.agent_type,
            legs: 0,
            writes_attempted: 0,
            writes_ok: 0,
            targets: 0,
            models: {},
            spawn_depth: {},
            status_claim: {},
            effort: {},
            hashes: new Set<string>(),
        };
        g.legs += 1;
        g.writes_attempted += leg.writes_attempted;
        g.writes_ok += leg.writes_ok;
        for (const h of leg.target_hashes) {
            g.hashes.add(h);
            allTargets.add(h);
        }
        bump(g.models, leg.model);
        bump(g.spawn_depth, leg.spawn_depth);
        bump(g.status_claim, leg.status_claim);
        bump(g.effort, leg.effort);
        groups.set(leg.agent_type, g);
    }

    const mtimes = legs.map((l) => l.mtime_ms);
    return {
        totals: {
            legs: legs.length,
            writes_attempted: legs.reduce((n, l) => n + l.writes_attempted, 0),
            writes_ok: legs.reduce((n, l) => n + l.writes_ok, 0),
            targets: allTargets.size,
            meta_missing: legs.filter((l) => l.meta_missing).length,
        },
        groups: [...groups.values()]
            .map(({ hashes, ...g }) => ({ ...g, targets: hashes.size }))
            .sort((a, b) => a.agent_type.localeCompare(b.agent_type)),
        oldest: mtimes.length === 0 ? null : new Date(Math.min(...mtimes)).toISOString(),
        newest: mtimes.length === 0 ? null : new Date(Math.max(...mtimes)).toISOString(),
    };
}

function formatCounts(counts: Record<string, number>): string {
    const keys = Object.keys(counts).sort();
    return keys.length === 0 ? '-' : keys.map((k) => `${k}=${String(counts[k])}`).join(' ');
}

export function renderText(r: Report): string {
    const t = r.totals;
    const out = [
        `legs ${String(t.legs)}`,
        `writes_attempted ${String(t.writes_attempted)}`,
        `writes_ok ${String(t.writes_ok)}`,
        `targets ${String(t.targets)}`,
        `meta_missing ${String(t.meta_missing)}`,
        `oldest ${r.oldest ?? 'null'}`,
        `newest ${r.newest ?? 'null'}`,
    ];
    for (const g of r.groups) {
        out.push(
            '',
            `[${g.agent_type}]`,
            `  legs ${String(g.legs)}`,
            `  writes_attempted ${String(g.writes_attempted)}`,
            `  writes_ok ${String(g.writes_ok)}`,
            `  targets ${String(g.targets)}`,
            `  status_claim ${formatCounts(g.status_claim)}`,
            `  model ${formatCounts(g.models)}`,
            `  spawn_depth ${formatCounts(g.spawn_depth)}`,
            `  effort ${formatCounts(g.effort)}`,
        );
    }
    return out.join('\n') + '\n';
}

function argValue(argv: readonly string[], flag: string): string | undefined {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--help')) {
        process.stdout.write(
            'Usage: subagent_return_report [--root <projects-dir>] [--max-age-days <N>] [--json]\n' +
                'Counts per subagent type: writes attempted / ok / distinct targets, status claim,\n' +
                'model, spawn depth, effort. Prints no path, id or message text.\n',
        );
        return 0;
    }
    const root = argValue(argv, '--root');
    const maxAge = argValue(argv, '--max-age-days');
    if (maxAge !== undefined && !/^\d+$/.test(maxAge)) {
        process.stderr.write('subagent_return_report: --max-age-days takes a whole number\n');
        return 2;
    }
    const report = buildReport({
        ...(root === undefined ? {} : { root: path.resolve(root) }),
        ...(maxAge === undefined ? {} : { maxAgeDays: Number(maxAge) }),
    });
    process.stdout.write(argv.includes('--json') ? JSON.stringify(report, null, 2) + '\n' : renderText(report));
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}

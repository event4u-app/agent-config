#!/usr/bin/env tsx
/**
 * report_consultation_rate — the consultation half of the pre-registered
 * frontend-skill metrics, computed from transcripts.
 *
 * WHAT IT MEASURES, AND WHY ONLY HALF.
 * `agents/settings/contexts/skill-catalogue-baseline.md` pre-registers two
 * rates. Exactly one of them is mechanically computable, and the reason the
 * other is not is a roadmap non-goal rather than an oversight:
 *
 *   CONSULTATION RATE — share of UI-write turns in a session that happened
 *   AFTER the session opened a design surface. Every input is a tool call:
 *   the write, its path, the prior read. Computable, and computed here.
 *
 *   DISCHARGE RATE — share of UI-write turns followed by a review verdict
 *   that is "render-scoped or explicitly static-scoped". A verdict is PROSE.
 *   Deciding whether a paragraph is a scoped verdict means matching prose,
 *   which the roadmap's non-goals forbid ("no prose-matching missed-activation
 *   detector", the FC-8 boundary the round-6 phase drew). So this script does
 *   NOT compute it, and does not approximate it under its name.
 *
 * What it offers instead is a labelled PROXY: how often a UI-write turn is
 * followed, in the same session, by opening `design-review`. That is a
 * consultation-shaped fact about the review skill, not a fact about a verdict —
 * an agent can open the skill and still write "looks good". Reported under its
 * own name so it can never be quoted as the discharge rate.
 *
 * ONE EVENT STREAM, NOT TWO. The UI-write and consultation predicates are
 * imported from the `ui-route-nudge` concern rather than restated. A metric
 * whose denominator drifted from the nudge's trigger would make any later A/B
 * uninterpretable — the two would be measuring different populations while
 * appearing to measure one.
 *
 * PRIVACY, stated at the precision the code actually holds. The text report is
 * counts and rates only. The `--json` form additionally echoes the SCAN ROOT
 * (`store`) — the directory the caller pointed at, which is a local path and is
 * the one thing a reader needs to know what was measured. Nothing else crosses:
 * no transcript filename, no session id, no path from inside a session, no
 * prompt or file content. The measurement reads those and keeps none of them.
 *
 * Exit: 0 always, except a usage/IO error (1). Advisory — it gates nothing.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    isConsultation,
    isUiWrite,
    type ToolEvent,
} from './hooks/ui_route_nudge_hook.js';

const _HERE = fileURLToPath(import.meta.url);

/** Tool names that propose new file content on this host. */
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit']);

/** The skill whose opening the discharge PROXY counts. */
const REVIEW_SURFACE = 'design-review';

export interface SessionMeasurement {
    /** UI-write turns seen in this session. */
    uiWrites: number;
    /** UI-write turns that followed a consultation in the same session. */
    consulted: number;
    /** UI-write turns followed later by opening the review skill. */
    reviewOpenedAfter: number;
}

export interface RateReport {
    store: string;
    /** False when the store directory does not exist — never the same as empty. */
    storeExists: boolean;
    sessions: number;
    sessionsWithUiWrite: number;
    uiWrites: number;
    consulted: number;
    reviewOpenedAfter: number;
}

/**
 * Default transcript store for a project directory.
 *
 * The host flattens the path by replacing BOTH separators and dots — a worktree
 * at `<repo>/.claude/worktrees/x` lands in `…-agent-config--claude-worktrees-x`,
 * with two dashes where `/.` was. Replacing only `/` (the shape the older census
 * helper carries) produces a directory that does not exist, and the caller then
 * reads a clean zero out of a store it never found.
 */
export function defaultStore(cwd: string): string {
    return path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[/.]/g, '-'));
}

/**
 * Map one transcript `tool_use` part onto the event shape the nudge decides
 * over. Returns null for parts that carry no path — they cannot be either a
 * UI write or a consultation.
 */
export function toolUseToEvent(part: Record<string, unknown>): ToolEvent | null {
    const name = part['name'];
    const input = part['input'];
    if (typeof name !== 'string' || input === null || typeof input !== 'object') return null;
    const ti = input as Record<string, unknown>;
    const fileVal = ti['file_path'] ?? ti['path'] ?? ti['filePath'] ?? ti['notebook_path'];
    if (typeof fileVal !== 'string' || fileVal === '') return null;
    return { file: fileVal, isWrite: WRITE_TOOLS.has(name) };
}

/**
 * Walk one session's tool events in order and measure it.
 *
 * Shares the nudge's PREDICATES (`isUiWrite`, `isConsultation`) but not its
 * `decide`, deliberately: `decide` stops warning after `MAX_NUDGES`, which is
 * correct for a reminder and wrong for a denominator — measuring through it
 * would silently drop every UI write past the second one in a session.
 *
 * Ordering is load-bearing. A consultation counts only for writes that come
 * after it; a session that opens `fe-design` at the end does not retroactively
 * consult for the file it already wrote.
 */
export function measureSession(events: readonly ToolEvent[]): SessionMeasurement {
    const out: SessionMeasurement = { uiWrites: 0, consulted: 0, reviewOpenedAfter: 0 };
    let consulted = false;
    const writeIndices: number[] = [];
    const reviewOpenIndices: number[] = [];

    events.forEach((event, index) => {
        if (isUiWrite(event)) {
            out.uiWrites += 1;
            if (consulted) out.consulted += 1;
            writeIndices.push(index);
            return;
        }
        if (isConsultation(event)) {
            consulted = true;
            if (event.file.replace(/\\/g, '/').toLowerCase().includes(`skills/${REVIEW_SURFACE}/`)) {
                reviewOpenIndices.push(index);
            }
        }
    });

    for (const writeIndex of writeIndices) {
        if (reviewOpenIndices.some((r) => r > writeIndex)) out.reviewOpenedAfter += 1;
    }
    return out;
}

/** Read every `tool_use` part of one transcript file, in order. */
export function readSessionEvents(file: string): ToolEvent[] {
    const events: ToolEvent[] = [];
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let entry: Record<string, unknown>;
        try {
            entry = JSON.parse(line) as Record<string, unknown>;
        } catch {
            continue;
        }
        if (entry['type'] !== 'assistant') continue;
        const msg = entry['message'];
        const content =
            msg !== null && typeof msg === 'object'
                ? (msg as Record<string, unknown>)['content']
                : null;
        if (!Array.isArray(content)) continue;
        for (const part of content) {
            if (part === null || typeof part !== 'object') continue;
            const p = part as Record<string, unknown>;
            if (p['type'] !== 'tool_use') continue;
            const event = toolUseToEvent(p);
            if (event) events.push(event);
        }
    }
    return events;
}

export function measureStore(store: string, limit: number): RateReport {
    const report: RateReport = {
        store,
        storeExists: fs.existsSync(store),
        sessions: 0,
        sessionsWithUiWrite: 0,
        uiWrites: 0,
        consulted: 0,
        reviewOpenedAfter: 0,
    };
    // A store that is not there and a store with nothing in it are different
    // findings, and only one of them is about the agent. Collapsing them into
    // one clean zero is the failure this repo has recorded four times.
    if (!report.storeExists) return report;

    const files = fs
        .readdirSync(store)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => path.join(store, f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
        .slice(0, limit);

    report.sessions = files.length;
    for (const file of files) {
        const measured = measureSession(readSessionEvents(file));
        if (measured.uiWrites === 0) continue;
        report.sessionsWithUiWrite += 1;
        report.uiWrites += measured.uiWrites;
        report.consulted += measured.consulted;
        report.reviewOpenedAfter += measured.reviewOpenedAfter;
    }
    return report;
}

function pct(n: number, d: number): string {
    return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`;
}

export function render(report: RateReport, threshold: number): string {
    const lines: string[] = [];
    lines.push('consultation rate — advisory, gates on nothing');
    lines.push('');
    if (!report.storeExists) {
        lines.push('  ❌  transcript store not found — nothing was measured.');
        lines.push('      This is not a rate of zero. Point --store at a real store;');
        lines.push('      `ls ~/.claude/projects` lists them.');
        return lines.join('\n');
    }
    lines.push(`  sessions scanned                 ${report.sessions}`);
    lines.push(`  sessions with a UI write         ${report.sessionsWithUiWrite}`);
    lines.push(`  UI-write turns                   ${report.uiWrites}`);
    lines.push('');
    lines.push(
        `  CONSULTATION RATE                ${pct(report.consulted, report.uiWrites)}  (${report.consulted}/${report.uiWrites})`,
    );
    lines.push(
        `  discharge PROXY (review opened)  ${pct(report.reviewOpenedAfter, report.uiWrites)}  (${report.reviewOpenedAfter}/${report.uiWrites})`,
    );
    lines.push('');

    if (report.sessionsWithUiWrite < threshold) {
        lines.push(
            `  ⚠  ${report.sessionsWithUiWrite} session(s) with a UI write — below the pre-registered floor of ${threshold}.`,
        );
        lines.push('     Report the rate as provisional; it is not yet a baseline.');
        lines.push('');
    }

    lines.push('  The PROXY is not the discharge rate. It counts a UI-write turn followed by');
    lines.push('  opening `design-review` in the same session. A verdict is prose, and matching');
    lines.push('  prose is a roadmap non-goal, so the discharge rate stays unmeasured rather');
    lines.push('  than approximated under its own name.');
    return lines.join('\n');
}

function argValue(flag: string, fallback: string): string {
    const index = process.argv.indexOf(flag);
    if (index === -1 || index + 1 >= process.argv.length) return fallback;
    return process.argv[index + 1]!;
}

function main(): number {
    const store = argValue('--store', defaultStore(process.cwd()));
    const limit = Number.parseInt(argValue('--limit', '200'), 10);
    const threshold = Number.parseInt(argValue('--min-sessions', '20'), 10);
    if (!Number.isFinite(limit) || limit <= 0) {
        process.stderr.write('❌  --limit must be a positive integer\n');
        return 1;
    }

    const report = measureStore(store, limit);
    if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write(`${render(report, threshold)}\n`);
    }
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    try {
        process.exit(main());
    } catch (error) {
        process.stderr.write(`❌  ${(error as Error).message}\n`);
        process.exit(1);
    }
}

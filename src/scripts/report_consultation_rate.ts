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

/**
 * One transcript tool call, tagged with the assistant turn it belongs to.
 *
 * The turn index is what makes the published unit honest. The pre-registered
 * metric is a share of UI *turns*; an earlier version counted `tool_use` parts
 * and published the count as turns, which inflates any turn that writes two
 * files and mixes a per-session numerator with a per-call denominator.
 */
export interface TimedEvent {
    event: ToolEvent;
    turn: number;
}

export interface SessionMeasurement {
    /** Assistant turns containing at least one UI write. */
    uiWriteTurns: number;
    /** Those turns that followed a consultation in the same session. */
    consulted: number;
    /** Those turns followed later by opening the review skill. */
    reviewOpenedAfter: number;
}

export interface RateReport {
    store: string;
    /** False when the store directory does not exist — never the same as empty. */
    storeExists: boolean;
    /** Transcripts read. Capped by --limit; the cap is reported when it bites. */
    sessions: number;
    /** True when --limit truncated the store rather than reading all of it. */
    truncated: boolean;
    sessionsWithUiWrite: number;
    /** Assistant turns containing at least one UI write — the denominator. */
    uiWriteTurns: number;
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
export function measureSession(timed: readonly TimedEvent[]): SessionMeasurement {
    const out: SessionMeasurement = { uiWriteTurns: 0, consulted: 0, reviewOpenedAfter: 0 };
    let consulted = false;
    /** turn -> was the session already consulted when that turn first wrote UI */
    const writeTurns = new Map<number, boolean>();
    let lastReviewOpenAt = -1;
    const reviewOpenPositions: number[] = [];
    const writePositions: Array<{ position: number; turn: number }> = [];

    timed.forEach(({ event, turn }, position) => {
        if (isUiWrite(event)) {
            if (!writeTurns.has(turn)) {
                writeTurns.set(turn, consulted);
                writePositions.push({ position, turn });
            }
            return;
        }
        if (isConsultation(event)) {
            consulted = true;
            if (event.file.replace(/\\/g, '/').toLowerCase().includes(`skills/${REVIEW_SURFACE}/`)) {
                reviewOpenPositions.push(position);
                lastReviewOpenAt = position;
            }
        }
    });

    out.uiWriteTurns = writeTurns.size;
    for (const wasConsulted of writeTurns.values()) if (wasConsulted) out.consulted += 1;
    // A single max comparison, not a scan per write: the proxy asks only whether
    // ANY review-open follows, so the last one decides every earlier write.
    void reviewOpenPositions;
    for (const { position } of writePositions) {
        if (lastReviewOpenAt > position) out.reviewOpenedAfter += 1;
    }
    return out;
}

/** Read every `tool_use` part of one transcript file, in order. */
export function readSessionEvents(file: string): TimedEvent[] {
    const events: TimedEvent[] = [];
    let turn = -1;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let entry: Record<string, unknown>;
        try {
            entry = JSON.parse(line) as Record<string, unknown>;
        } catch {
            continue;
        }
        if (entry['type'] !== 'assistant') continue;
        turn += 1;
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
            if (event) events.push({ event, turn });
        }
    }
    return events;
}

export function measureStore(store: string, limit: number): RateReport {
    const report: RateReport = {
        store,
        storeExists: fs.existsSync(store),
        sessions: 0,
        truncated: false,
        sessionsWithUiWrite: 0,
        uiWriteTurns: 0,
        consulted: 0,
        reviewOpenedAfter: 0,
    };
    // A store that is not there and a store with nothing in it are different
    // findings, and only one of them is about the agent. Collapsing them into
    // one clean zero is the failure this repo has recorded four times.
    if (!report.storeExists) return report;

    // mtime is read ONCE per file, not inside the comparator: a comparator that
    // stats is O(n log n) syscalls and throws ENOENT if a live store rotates a
    // transcript mid-sort — a measurement must not crash on the store being used.
    const all = fs
        .readdirSync(store)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => path.join(store, f))
        .map((file) => {
            let mtimeMs = 0;
            try {
                mtimeMs = fs.statSync(file).mtimeMs;
            } catch {
                /* vanished between readdir and stat — sort it last, skip it below */
            }
            return { file, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

    const files = all.slice(0, limit).map((f) => f.file);
    report.truncated = all.length > files.length;
    report.sessions = files.length;
    for (const file of files) {
        let measured: SessionMeasurement;
        try {
            measured = measureSession(readSessionEvents(file));
        } catch {
            continue; // rotated or unreadable transcript — skip, never crash
        }
        if (measured.uiWriteTurns === 0) continue;
        report.sessionsWithUiWrite += 1;
        report.uiWriteTurns += measured.uiWriteTurns;
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
    lines.push(
        `  sessions scanned                 ${report.sessions}${report.truncated ? ' (TRUNCATED by --limit)' : ''}`,
    );
    lines.push(`  sessions with a UI write         ${report.sessionsWithUiWrite}`);
    lines.push(`  UI-write turns                   ${report.uiWriteTurns}`);
    lines.push('');
    lines.push(
        `  CONSULTATION RATE                ${pct(report.consulted, report.uiWriteTurns)}  (${report.consulted}/${report.uiWriteTurns})`,
    );
    lines.push(
        `  discharge PROXY (review opened)  ${pct(report.reviewOpenedAfter, report.uiWriteTurns)}  (${report.reviewOpenedAfter}/${report.uiWriteTurns})`,
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

/**
 * Value of `flag`, or `fallback` when it is absent.
 *
 * Throws when the flag is present with no value after it. The earlier version
 * returned the fallback there, so `--store` as the last argv element silently
 * measured the DEFAULT store — and since the text report never prints the scan
 * root, the substitution was invisible in exactly the output a reader would
 * publish. A usage error is the only honest answer to "you asked for a store
 * and named none".
 */
function argValue(flag: string, fallback: string): string {
    const index = process.argv.indexOf(flag);
    if (index === -1) return fallback;
    const value = process.argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
        throw new Error(`${flag} requires a value`);
    }
    return value;
}

/** Parse a positive-integer flag, or fail loudly. Never silently NaN. */
function intArg(flag: string, fallback: string): number {
    const raw = argValue(flag, fallback);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${flag} must be a positive integer (got ${JSON.stringify(raw)})`);
    }
    return parsed;
}

function main(): number {
    const store = argValue('--store', defaultStore(process.cwd()));
    const limit = intArg('--limit', '200');
    // Validated for the same reason --limit is, and it was not: a NaN threshold
    // makes `sessionsWithUiWrite < NaN` false, which SUPPRESSES the provisional
    // warning — the run then reads as a settled baseline over any corpus.
    const threshold = intArg('--min-sessions', '20');

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

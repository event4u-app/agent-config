#!/usr/bin/env -S npx tsx
/**
 * `measure-work-product-line` — how often the legal pack's attorney-review line
 * lands on a reply that changed nothing.
 *
 * The legal safety floor binds the line to every legal DELIVERABLE in its rule
 * body and to every OUTPUT in its startup stub. A retro session carried it 18
 * times, mostly on question replies. This counts, per session, the assistant
 * replies carrying the line and splits them by whether the same turn wrote or
 * changed a file through a write tool (Edit, Write, MultiEdit, NotebookEdit).
 *
 * Counts only — no reply text, no path, no prompt is printed. A shell-made
 * write (`sed -i`, a heredoc) is not seen as a write here, so the
 * `no-write turn` column is an upper bound on conversational replies.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The line's invariant part, matched case-insensitively. */
export const WORK_PRODUCT_LINE = /attorney review required on material use/i;

const WRITE_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export interface SessionCount {
    readonly session: string;
    readonly replies: number;
    readonly inWriteTurn: number;
    readonly inNoWriteTurn: number;
}

type Entry = Record<string, unknown>;

function contentOf(entry: Entry): unknown {
    const msg = entry['message'];
    return typeof msg === 'object' && msg !== null ? (msg as Entry)['content'] : undefined;
}

/** A user entry that a human typed, as opposed to a tool result fed back. */
function isGenuinePrompt(entry: Entry): boolean {
    if (entry['type'] !== 'user') return false;
    const content = contentOf(entry);
    if (typeof content === 'string') return content.trim() !== '';
    if (!Array.isArray(content)) return false;
    return content.some((b) => typeof b === 'object' && b !== null && (b as Entry)['type'] === 'text');
}

/** One session's counts from its JSONL lines. */
export function countSession(session: string, lines: readonly string[]): SessionCount {
    let replies = 0;
    let inWriteTurn = 0;
    let inNoWriteTurn = 0;
    let turnReplies = 0;
    let turnWrote = false;

    const closeTurn = (): void => {
        replies += turnReplies;
        if (turnWrote) inWriteTurn += turnReplies;
        else inNoWriteTurn += turnReplies;
        turnReplies = 0;
        turnWrote = false;
    };

    for (const line of lines) {
        let entry: Entry;
        try {
            const parsed: unknown = JSON.parse(line);
            if (typeof parsed !== 'object' || parsed === null) continue;
            entry = parsed as Entry;
        } catch {
            continue;
        }
        if (isGenuinePrompt(entry)) {
            closeTurn();
            continue;
        }
        if (entry['type'] !== 'assistant') continue;
        const content = contentOf(entry);
        if (!Array.isArray(content)) continue;
        for (const block of content) {
            if (typeof block !== 'object' || block === null) continue;
            const b = block as Entry;
            if (b['type'] === 'tool_use' && typeof b['name'] === 'string' && WRITE_TOOLS.has(b['name'])) {
                turnWrote = true;
            } else if (b['type'] === 'text' && typeof b['text'] === 'string' && WORK_PRODUCT_LINE.test(b['text'])) {
                turnReplies += 1;
            }
        }
    }
    closeTurn();
    return { session, replies, inWriteTurn, inNoWriteTurn };
}

/** Every `.jsonl` file directly under `store` or one directory below it. */
export function sessionFiles(store: string): string[] {
    const out: string[] = [];
    let top: fs.Dirent[];
    try {
        top = fs.readdirSync(store, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const d of top) {
        const p = path.join(store, d.name);
        if (d.isFile() && d.name.endsWith('.jsonl')) out.push(p);
        else if (d.isDirectory()) {
            try {
                for (const f of fs.readdirSync(p)) if (f.endsWith('.jsonl')) out.push(path.join(p, f));
            } catch {
                /* unreadable project dir — skipped */
            }
        }
    }
    return out.sort();
}

export function measure(stores: readonly string[]): { sessions: number; rows: SessionCount[] } {
    let sessions = 0;
    const rows: SessionCount[] = [];
    for (const store of stores) {
        for (const file of sessionFiles(store)) {
            let lines: string[];
            try {
                lines = fs.readFileSync(file, 'utf-8').split('\n').filter((l) => l.trim() !== '');
            } catch {
                continue;
            }
            sessions += 1;
            const row = countSession(path.basename(file, '.jsonl').slice(0, 8), lines);
            if (row.replies > 0) rows.push(row);
        }
    }
    return { sessions, rows };
}

export function render(result: { sessions: number; rows: readonly SessionCount[] }): string {
    const total = result.rows.reduce(
        (acc, r) => ({ r: acc.r + r.replies, w: acc.w + r.inWriteTurn, n: acc.n + r.inNoWriteTurn }),
        { r: 0, w: 0, n: 0 },
    );
    const lines = [
        `sessions scanned: ${result.sessions}; sessions carrying the line: ${result.rows.length}`,
        '',
        '| session | replies with line | in write turn | in no-write turn |',
        '|---|---|---|---|',
        ...result.rows.map((r) => `| ${r.session} | ${r.replies} | ${r.inWriteTurn} | ${r.inNoWriteTurn} |`),
        `| total | ${total.r} | ${total.w} | ${total.n} |`,
    ];
    return lines.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const stores: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--store' && argv[i + 1] !== undefined) {
            stores.push(argv[i + 1] as string);
            i += 1;
        }
    }
    if (stores.length === 0) {
        process.stderr.write('measure-work-product-line: at least one --store <transcript dir> is required\n');
        return 2;
    }
    const result = measure(stores);
    if (result.sessions === 0) {
        process.stderr.write(`measure-work-product-line: no .jsonl sessions under ${stores.join(', ')}\n`);
        return 2;
    }
    process.stdout.write(`${render(result)}\n`);
    return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) process.exit(main());

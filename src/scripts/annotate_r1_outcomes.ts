#!/usr/bin/env tsx
/**
 * Gate R1 outcome annotation helper (quarterly cadence — see
 * docs/contracts/plan-review-gates.md § 7).
 *
 * Walks the `## Risk Register` sections of ARCHIVED roadmaps
 * (agents/roadmaps/archive/*.md), and for every register row that has no
 * recorded outcome yet, prompts the operator:
 *
 *   helped  — the mitigation prevented the risk (or materially reduced it)
 *   fired   — the risk fired despite (or without) the mitigation
 *   unknown — cannot be judged (yet)
 *
 * Each answer appends one `r1_mitigation_outcome` event to the tracked
 * metrics JSONL (agents/evidence/metrics/gate-metrics.jsonl) — ids +
 * counters only, PII-free by construction. Already-annotated rows
 * (same file + rank in the JSONL) are skipped, so re-runs are idempotent.
 *
 * Not a gate: no `scanned:` line, no gate-coverage entry. Exit 0 on
 * completion (including nothing-to-annotate), 2 on internal error.
 *
 * Usage:
 *   ./scripts-run src/scripts/annotate_r1_outcomes            # interactive
 *   ./scripts-run src/scripts/annotate_r1_outcomes --list     # show pending only
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { splitMarkdownRow } from './_lib/md_table.js';

const ARCHIVE_DIR = 'agents/roadmaps/archive';
const METRICS_FILE = 'agents/evidence/metrics/gate-metrics.jsonl';
const OUTCOMES = new Set(['helped', 'fired', 'unknown']);

interface RegisterRow {
    file: string;
    rank: number;
    item: string;
    mitigation: string;
}

/** § 1.2 register columns: Rank | Item | Risk type | Description | Mitigation | Anchored under. */
const REGISTER_CELLS = 6;
const ITEM_CELL = 1;
const MITIGATION_CELL = 4;

export function extractRegisterRows(file: string, content: string): RegisterRow[] {
    const rows: RegisterRow[] = [];
    const lines = content.split(/\r?\n/);
    let inRegister = false;
    for (const line of lines) {
        if (/^##\s+Risk Register\s*$/.test(line)) {
            inRegister = true;
            continue;
        }
        if (inRegister && /^##\s+/.test(line)) break;
        if (!inRegister) continue;
        if (!line.trim().startsWith('|')) continue;
        // Escape-aware split, shared with both validators: a per-column
        // `[^|]*` regex mis-aligns on a `\|` inside a cell — the shape the
        // contract's own §1.2 example uses (`product \| implementation`) —
        // and then records the Description as the mitigation.
        const cells = splitMarkdownRow(line);
        if (cells.length < REGISTER_CELLS) continue;
        const rank = cells[0] ?? '';
        if (!/^\d+$/.test(rank)) continue; // header / separator / prose row
        rows.push({
            file,
            rank: Number(rank),
            item: (cells[ITEM_CELL] ?? '').trim(),
            mitigation: (cells[MITIGATION_CELL] ?? '').trim(),
        });
    }
    return rows;
}

export function annotatedKeys(metricsText: string): Set<string> {
    const keys = new Set<string>();
    for (const line of metricsText.split('\n')) {
        if (line.trim() === '') continue;
        try {
            const ev = JSON.parse(line) as { event?: string; file?: string; rank?: number };
            if (ev.event === 'r1_mitigation_outcome' && ev.file !== undefined && ev.rank !== undefined) {
                keys.add(`${ev.file}#${String(ev.rank)}`);
            }
        } catch {
            // tolerate foreign lines — the JSONL is append-only and shared
        }
    }
    return keys;
}

/**
 * Ask one question. Resolves `null` on EOF (closed stdin) instead of hanging:
 * `rl.question`'s callback never fires when the stream ends, so a piped or
 * CI invocation would otherwise block forever.
 */
function ask(rl: readline.Interface, q: string): Promise<string | null> {
    return new Promise((resolve) => {
        let settled = false;
        const onClose = (): void => {
            if (!settled) {
                settled = true;
                resolve(null);
            }
        };
        rl.once('close', onClose);
        rl.question(q, (answer) => {
            settled = true;
            rl.removeListener('close', onClose);
            resolve(answer);
        });
    });
}

export interface AnnotateIo {
    /**
     * readline input; defaults to `process.stdin`.
     *
     * Injected by the tests to drive the EOF path deterministically — a
     * caller-supplied stream is a deliberate non-TTY answer channel, so the
     * TTY refusal below applies to `process.stdin` only.
     */
    input?: NodeJS.ReadableStream;
}

export async function main(argv?: readonly string[], io: AnnotateIo = {}): Promise<number> {
    const args = argv ?? process.argv.slice(2);
    const listOnly = args.includes('--list');

    if (!fs.existsSync(ARCHIVE_DIR)) {
        process.stdout.write(`No archive directory at ${ARCHIVE_DIR} — nothing to annotate.\n`);
        return 0;
    }

    const files = fs
        .readdirSync(ARCHIVE_DIR)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(ARCHIVE_DIR, f));

    const metricsText = fs.existsSync(METRICS_FILE) ? fs.readFileSync(METRICS_FILE, 'utf8') : '';
    const done = annotatedKeys(metricsText);

    const pending: RegisterRow[] = [];
    for (const f of files) {
        const rows = extractRegisterRows(f, fs.readFileSync(f, 'utf8'));
        for (const r of rows) {
            if (!done.has(`${r.file}#${String(r.rank)}`)) pending.push(r);
        }
    }

    if (pending.length === 0) {
        process.stdout.write('✅  No un-annotated Risk-Register rows in archived roadmaps.\n');
        return 0;
    }

    process.stdout.write(`${String(pending.length)} un-annotated mitigation(s) in archived roadmaps:\n`);
    if (listOnly) {
        for (const r of pending) {
            process.stdout.write(`  ${r.file} #${String(r.rank)} — ${r.item}\n`);
        }
        return 0;
    }

    // Interactive-only by construction: the annotation pass is a human quarterly
    // cadence, so a non-TTY invocation is refused up front with the read-only
    // alternative rather than left to block on a prompt nobody can answer.
    if (io.input === undefined && process.stdin.isTTY !== true) {
        process.stderr.write(
            '❌  annotate_r1_outcomes needs an interactive terminal (stdin is not a TTY).\n' +
                '    Use --list for the read-only pending inventory.\n',
        );
        return 2;
    }

    const rl = readline.createInterface({ input: io.input ?? process.stdin, output: process.stdout });
    try {
        for (const r of pending) {
            process.stdout.write(`\n${r.file} #${String(r.rank)}\n  risk: ${r.item}\n  mitigation: ${r.mitigation}\n`);
            let answer = '';
            let eof = false;
            while (!OUTCOMES.has(answer)) {
                const raw = await ask(rl, '  outcome [helped/fired/unknown, s=skip]: ');
                if (raw === null) {
                    eof = true;
                    break;
                }
                answer = raw.trim().toLowerCase();
                if (answer === 's' || answer === 'skip') break;
            }
            if (eof) {
                process.stdout.write('\n⚠️  stdin closed — ending the annotation pass early.\n');
                break;
            }
            if (!OUTCOMES.has(answer)) continue;
            const event = {
                event: 'r1_mitigation_outcome',
                date: new Date().toISOString().slice(0, 10),
                file: r.file,
                rank: r.rank,
                outcome: answer,
            };
            fs.appendFileSync(METRICS_FILE, `${JSON.stringify(event)}\n`);
        }
    } finally {
        rl.close();
    }
    process.stdout.write('\n✅  Annotation pass complete.\n');
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv1;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    main()
        .then((code) => process.exit(code))
        .catch((exc: unknown) => {
            const msg = exc instanceof Error ? exc.message : String(exc);
            process.stderr.write(`❌  Internal error: ${msg}\n`);
            process.exit(2);
        });
}

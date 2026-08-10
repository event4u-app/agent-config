#!/usr/bin/env -S npx tsx
/**
 * `measure-turn-end-gate` — the false-positive pass roadmap
 * `road-to-conformance-round5.md` § 3.4 asks for, run against a REAL
 * transcript corpus rather than a hand-written one.
 *
 * Why this exists as a script and not as a number in a commit message: the
 * roadmap asks to "record measured precision per detector", and a recorded
 * figure nobody can re-derive is the same class of claim this whole round
 * exists to remove. One command, same store, same numbers.
 *
 * What it measures, and what it deliberately does NOT:
 *
 *   · FIRE RATE of each detector over every assistant turn in the window.
 *   · For detector B, the CROSS-TAB against `conformance_scan`'s own
 *     independent language check. That scanner reads only the first prose
 *     line and this detector reads the whole stripped reply, so the two are
 *     related instruments, not the same one — which is exactly what makes
 *     the disagreement cells informative.
 *   · It does NOT compute recall against the 20 promissory occurrences the
 *     round-5 audit reported. Those came from subagent transcript READING;
 *     `conformance_scan.ts` states in its own header that promissory
 *     closings are "deliberately NOT scanned", so there is no machine-
 *     readable ground truth to score against. Claiming a recall figure here
 *     would invent one.
 *
 * Usage:
 *   ./scripts-run src/scripts/measure_turn_end_gate --store <dir> [--limit N]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { classify } from './language_mirror_hook.js';
import { assistantText, isInjectedBody, scanSession, userText } from './conformance_scan.js';
import { detectLanguage, detectPromissory } from './hooks/turn_end_gate_hook.js';

interface Counts {
    assistant_turns: number;
    promissory_fires: number;
    language_fires: number;
    /** Detector B fired AND the scanner also flagged that session-turn. */
    language_agree: number;
    /** Detector B fired where the scanner saw nothing — candidate false positives. */
    language_only: number;
    sessions: number;
}

function sessionFiles(store: string, limit: number): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(store).filter((f) => f.endsWith('.jsonl'));
    } catch {
        return [];
    }
    const withTime = entries.map((f) => {
        const p = path.join(store, f);
        let mtime = 0;
        try {
            mtime = fs.statSync(p).mtimeMs;
        } catch {
            /* unreadable — sorts last */
        }
        return { p, mtime };
    });
    withTime.sort((a, b) => b.mtime - a.mtime);
    return withTime.slice(0, limit).map((e) => e.p);
}

export function measure(store: string, limit: number): Counts {
    const c: Counts = {
        assistant_turns: 0,
        promissory_fires: 0,
        language_fires: 0,
        language_agree: 0,
        language_only: 0,
        sessions: 0,
    };

    for (const file of sessionFiles(store, limit)) {
        let lines: string[];
        try {
            lines = fs.readFileSync(file, 'utf-8').split('\n').filter((l) => l.trim() !== '');
        } catch {
            continue;
        }
        c.sessions += 1;
        const sessionId = path.basename(file).slice(0, 8);

        // The scanner's independent verdict for this session, keyed by the
        // timestamp-free count of language violations. Used only as a
        // cross-tab total, never as ground truth for this detector.
        let scannerLanguage = 0;
        try {
            scannerLanguage = scanSession(sessionId, lines).violations.filter(
                (v) => v.check === 'language-pin',
            ).length;
        } catch {
            scannerLanguage = 0;
        }

        let pinned: 'de' | 'en' | 'und' = 'und';
        let myLanguage = 0;

        for (const raw of lines) {
            let entry: Record<string, unknown>;
            try {
                entry = JSON.parse(raw) as Record<string, unknown>;
            } catch {
                continue;
            }

            const u = userText(entry);
            if (u !== null) {
                // A background-task notification occupies the user role but is
                // not a chat message — the exact shape that made the language
                // defect invisible. It must never move the pin.
                if (!isInjectedBody(u)) {
                    const verdict = classify(u);
                    if (verdict.language !== 'und') pinned = verdict.language;
                }
                continue;
            }

            const a = assistantText(entry);
            if (a === null || a.trim() === '') continue;
            c.assistant_turns += 1;

            if (detectPromissory(a) !== null) c.promissory_fires += 1;
            if (detectLanguage(a, pinned) !== null) {
                c.language_fires += 1;
                myLanguage += 1;
            }
        }

        const agree = Math.min(myLanguage, scannerLanguage);
        c.language_agree += agree;
        c.language_only += Math.max(0, myLanguage - scannerLanguage);
    }

    return c;
}

export function render(c: Counts): string {
    const pct = (n: number): string =>
        c.assistant_turns === 0 ? '0.0' : ((100 * n) / c.assistant_turns).toFixed(1);
    return [
        `measure-turn-end-gate · ${c.sessions} sessions · ${c.assistant_turns} assistant turns`,
        '',
        `  detector A (promissory)  fires on ${c.promissory_fires} turns  (${pct(c.promissory_fires)}%)`,
        `  detector B (language)    fires on ${c.language_fires} turns  (${pct(c.language_fires)}%)`,
        `    of which the independent scanner also flagged: ${c.language_agree}`,
        `    fired where the scanner saw nothing:           ${c.language_only}`,
        '',
        '  The second line is the one that matters for a BLOCKING guard: those are',
        '  the turns this detector would have refused and the other instrument would',
        '  not. They are candidate false positives, not confirmed ones — the two',
        '  instruments read different spans (first prose line vs. whole stripped',
        '  reply), so disagreement is expected in both directions.',
        '',
        '  No recall figure for detector A: promissory closings are not machine-',
        '  scanned anywhere in this tree, so there is no ground truth to score.',
    ].join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let store = '';
    let limit = 30;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--store' && argv[i + 1] !== undefined) {
            store = argv[i + 1]!;
            i += 1;
        } else if (argv[i] === '--limit' && argv[i + 1] !== undefined) {
            limit = parseInt(argv[i + 1]!, 10);
            i += 1;
        }
    }
    if (!store) {
        process.stderr.write('measure-turn-end-gate: --store <transcript dir> is required\n');
        return 2;
    }
    const counts = measure(store, limit);
    if (counts.sessions === 0) {
        // A measurement over zero sessions that exits 0 is the repo's own
        // "gates that scan nothing" failure. Refuse instead.
        process.stderr.write(`measure-turn-end-gate: no .jsonl sessions under ${store}\n`);
        return 2;
    }
    process.stdout.write(`${render(counts)}\n`);
    return 0;
}

if (process.argv[1] !== undefined && process.argv[1].includes('measure_turn_end_gate')) {
    process.exit(main());
}

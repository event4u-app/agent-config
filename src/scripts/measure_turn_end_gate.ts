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
 *   · FIRE RATE of each detector PER TURN, over the last assistant text of the
 *     turn — the population the shipped gate inspects. R2 finding 1: the first
 *     version scored every assistant ENTRY and published the result as a
 *     per-turn rate, which inflated the population ~8.6x and scored a
 *     closing-paragraph detector over mid-turn prose.
 *   · The independent scanner's own language total, printed for CONTEXT only.
 *     It is not an agreement figure and no overlap is claimed from it: the two
 *     instruments read different spans (its first prose line; this one strips
 *     code/quotes/paths from the reply and then scores lead-first via the same
 *     classifier), and this script does no per-turn matching between them.
 *     R2 finding 7 removed the per-session min/max arithmetic that used to
 *     report disjoint findings of equal count as full agreement.
 *   · It does NOT compute recall against the 20 promissory occurrences the
 *     round-5 audit reported. Those came from subagent transcript READING;
 *     `conformance_scan.ts` states in its own header that promissory
 *     closings are "deliberately NOT scanned", so there is no machine-
 *     readable ground truth to score against. Claiming a recall figure here
 *     would invent one.
 *   · KNOWN RESIDUAL, R2 finding 8, not fixed here: this script re-derives the
 *     language pin with `classify` per user entry, while the gate reads the pin
 *     `language_mirror_hook` persisted — which also applies a system-locale
 *     fallback and a keep-previous rule. Where those diverge, a turn can move
 *     between "pinned de", "pinned en" and "no obligation", so detector B's
 *     rate here is close to but not identical with the gate's. Reaching parity
 *     means reusing `nextState`, which is a larger change than a measurement
 *     correction and would itself need re-measuring.
 *
 * Usage:
 *   ./scripts-run src/scripts/measure_turn_end_gate --store <dir> [--limit N]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classify } from './language_mirror_hook.js';
import { assistantText, isInjectedBody, scanSession, userText } from './conformance_scan.js';
import { detectLanguage, detectPromissory } from './hooks/turn_end_gate_hook.js';

interface Counts {
    /**
     * TURNS, not entries. R2 finding 1: the first version incremented a counter
     * named `assistant_turns` on every assistant entry and ran both detectors on
     * each one, while the gate only ever evaluates the LAST assistant text of a
     * turn. A turn with k prose entries contributed k samples to the instrument
     * and 1 to the gate, so the published "18.0% of turns" was a per-ENTRY rate
     * wearing a per-turn label — and detector A, a closing-paragraph detector by
     * construction, was being scored over mid-turn prose.
     */
    turns: number;
    /** Assistant entries seen — kept only to show the ratio the old bug hid. */
    assistant_entries: number;
    promissory_fires: number;
    language_fires: number;
    /** The independent scanner's own per-session language total, for context. */
    scanner_language: number;
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
        turns: 0,
        assistant_entries: 0,
        promissory_fires: 0,
        language_fires: 0,
        scanner_language: 0,
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

        // The independent scanner's own language total for this session,
        // reported side by side and NOT as agreement — see the header for why
        // no overlap is derivable from two totals (R2 finding 7).
        //
        // A throw is surfaced, not swallowed to zero: swallowing silently
        // reclassified a whole session's fires as scanner-disagreements.
        try {
            c.scanner_language += scanSession(sessionId, lines).violations.filter(
                (v) => v.check === 'language-pin',
            ).length;
        } catch (err) {
            process.stderr.write(
                `measure-turn-end-gate: scanSession failed for ${sessionId} — excluded from the scanner total: ${String(err)}\n`,
            );
        }

        let pinned: 'de' | 'en' | 'und' = 'und';
        // The LAST assistant text since the last genuine user prompt. This is
        // the population the gate inspects; anything else is a different
        // measurement wearing the same label (R2 finding 1).
        let pendingReply: string | null = null;
        let pendingPin: 'de' | 'en' | 'und' = 'und';

        const scoreTurn = (): void => {
            if (pendingReply === null) return;
            c.turns += 1;
            if (detectPromissory(pendingReply) !== null) c.promissory_fires += 1;
            if (detectLanguage(pendingReply, pendingPin) !== null) c.language_fires += 1;
            pendingReply = null;
        };

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
                // defect invisible. It must never move the pin, and it must not
                // close a turn either.
                if (!isInjectedBody(u)) {
                    scoreTurn(); // the previous turn ends here
                    const verdict = classify(u);
                    if (verdict.language !== 'und') pinned = verdict.language;
                }
                continue;
            }

            const a = assistantText(entry);
            if (a === null || a.trim() === '') continue;
            c.assistant_entries += 1;
            // Overwrite: only the last one in the turn is the gate's input.
            pendingReply = a;
            pendingPin = pinned;
        }
        scoreTurn(); // the transcript's final turn
    }

    return c;
}

export function render(c: Counts): string {
    const pct = (n: number): string => (c.turns === 0 ? '0.0' : ((100 * n) / c.turns).toFixed(1));
    return [
        `measure-turn-end-gate · ${c.sessions} sessions · ${c.turns} turns · ${c.assistant_entries} assistant entries`,
        '',
        `  detector A (promissory)  fires on ${c.promissory_fires} turns  (${pct(c.promissory_fires)}%)`,
        `  detector B (language)    fires on ${c.language_fires} turns  (${pct(c.language_fires)}%)`,
        '',
        '  Rates are per TURN, over the last assistant text of each turn — the same',
        '  population the shipped gate inspects. The entry count is printed beside',
        '  the turn count because the first version of this script scored every',
        '  assistant ENTRY and labelled the result per-turn; the gap between the two',
        '  numbers is the size of that error.',
        '',
        `  For context only, the independent scanner's own language total: ${c.scanner_language}`,
        '    NOT an agreement figure. The two instruments read different spans (its',
        '    first prose line vs. this stripped, lead-first-scored reply) and this',
        '    script does no',
        '    per-turn matching between them, so no overlap can be claimed from these',
        '    two totals — the previous version claimed one from per-session min/max',
        '    arithmetic, which reports disjoint findings of equal count as full',
        '    agreement.',
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
            // R2 finding 15: an unvalidated parseInt made `--limit abc` yield
            // NaN, `slice(0, NaN)` return nothing, and the script exit 2 with
            // "no .jsonl sessions under <store>" — a real input error reported
            // as a missing corpus.
            const parsed = Number.parseInt(argv[i + 1]!, 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
                process.stderr.write(
                    `measure-turn-end-gate: --limit must be a positive integer, got ${JSON.stringify(argv[i + 1])}\n`,
                );
                return 2;
            }
            limit = parsed;
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

// Bundle-safety, same guard as the sibling hook. R2 finding 15: a substring
// test on argv[1] auto-runs the module when esbuild inlines it into a bundle,
// where every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}

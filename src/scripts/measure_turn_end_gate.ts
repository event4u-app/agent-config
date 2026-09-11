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
 *   · DETECTORS C AND E, added 2026-09-11 for ADR-277's named open limit: that
 *     record ships detector E with its false-positive rate UNMEASURED and says
 *     so. The rate below is the fire rate over a real corpus, which is the
 *     upper bound on it — every fire is a turn the shipped gate would have
 *     refused, and how many of those were wrong still needs a human read of the
 *     turns. An upper bound is not a precision figure and is not reported as
 *     one.
 *   · The C-SILENT OVERLAP, which is the one number ADR-277 rests an argument
 *     on. The record claims detector C does not already cover E's case, and the
 *     evidence for it was a single unit test asserting C stays silent on E's
 *     input. This counts the same thing over the corpus: of the turns E fires
 *     on, how many did C leave alone. A low count would refute the record's own
 *     "two different questions deserve two detectors" and is worth finding.
 *   · It does NOT score detector D. D reads `ci_last` out of per-session
 *     runtime state, which no transcript carries, so a transcript-derived D
 *     figure would be a measurement of an absent file rather than of the
 *     detector.
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
 *   ./scripts-run src/scripts/measure_turn_end_gate --store <dir> [--limit N] [--show-fires]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classify, isSyntheticPrompt } from './language_mirror_hook.js';
import { assistantText, scanSession, userText } from './conformance_scan.js';
import { isSidechain } from './_lib/transcript_entry.js';
import {
    detectLanguage,
    detectPromissory,
    detectUntestedChange,
    detectUnverifiedEdit,
    extractToolCalls,
    type ToolCall,
} from './hooks/turn_end_gate_hook.js';

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
    /** Detector C — an edit with nothing run after it that could have checked it. */
    unverified_fires: number;
    /** Detector E — production source changed, no test touched, done claimed. */
    untested_fires: number;
    /**
     * Turns where E fired and C did NOT. ADR-277 argues C cannot stand in for
     * E; this is that argument's denominator-free form. E fires minus this is
     * the set both would have caught.
     */
    untested_c_silent: number;
    /** Turns that edited at least one file — E's and C's shared precondition. */
    turns_with_edit: number;
    /**
     * E's conditions, counted cumulatively, so a zero fire count is readable.
     * A detector that never fires is either narrow-and-right or inert, and the
     * difference is entirely in WHICH condition did the silencing — reporting
     * only the fire count leaves that unanswerable and invites the wrong one of
     * the two conclusions.
     */
    e1_production_source: number;
    /** …and touched no test file anywhere in the turn. */
    e2_no_test_touched: number;
    /**
     * Where E fired — session prefix and turn ordinal only, plus the detector's
     * own evidence span. ADR-277's open limit is a false-POSITIVE rate, and no
     * instrument can decide that: only a human reading the turn can say whether
     * a refusal would have been right. This is the pointer that makes the read
     * possible instead of leaving "measure it" as an instruction nobody can act
     * on. Printed only under `--show-fires`, because the spans carry the
     * consumer's own file paths.
     */
    untested_sites: { session: string; turn: number; evidence: string }[];
    /** The independent scanner's own per-session language total, for context. */
    scanner_language: number;
    sessions: number;
}

/**
 * The gate's own edit-tool set, duplicated here for ONE purpose: the
 * `turns_with_edit` context line. It is deliberately not re-exported from the
 * hook — nothing in the measurement depends on it, so a drift between the two
 * changes a printed denominator and never a scored rate.
 */
const _EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/**
 * The path shapes detector E reads, restated here for the CUMULATIVE-CONDITION
 * breakdown only — never for a scored rate, which always goes through
 * `detectUntestedChange` itself.
 *
 * Restating them is the lesser of two bad options. The alternative is exporting
 * two more internals from the hook purely so a diagnostic line can be printed,
 * which widens the gate's public surface for a number that is context. If these
 * drift from the hook's own, the breakdown stops adding to E's fire count and
 * the discrepancy is visible in the same output.
 */
const _SOURCE_EXT_RE =
    /\.(?:ts|tsx|js|jsx|mjs|cjs|vue|svelte|php|py|rb|go|rs|java|kt|swift|cs|scala|ex|exs)$/i;
const _TEST_DIR_RE = /(?:^|\/)(?:tests?|specs?|__tests__|__specs__|e2e|cypress|playwright|features)\//i;
const _TEST_FILE_RE =
    /(?:\.(?:test|spec)\.[a-z]+$)|(?:_test\.[a-z]+$)|(?:(?:^|\/)test_[^/]+$)|(?:Test\.php$)|(?:Spec\.php$)|(?:\.feature$)/i;

function _looksTestPath(p: string): boolean {
    return _TEST_DIR_RE.test(p) || _TEST_FILE_RE.test(p);
}

function _looksProductionSource(p: string): boolean {
    return _SOURCE_EXT_RE.test(p) && !_looksTestPath(p);
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
        unverified_fires: 0,
        untested_fires: 0,
        untested_c_silent: 0,
        turns_with_edit: 0,
        e1_production_source: 0,
        e2_no_test_touched: 0,
        untested_sites: [],
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
        // The turn's tool calls, rebuilt with the gate's OWN extractor and reset
        // at every genuine user prompt — the same two rules `readTranscriptTail`
        // applies. Detectors C and E read nothing else, so any divergence here
        // would move the measurement off the shipped gate's population.
        let pendingCalls: ToolCall[] = [];
        // Per-SESSION, because that is the only ordinal a reader can use to find
        // the turn again. `c.turns` is the corpus-wide running total, and
        // labelling it "turn" in a per-session pointer sends the reader to the
        // wrong turn of the right file — caught by reading the first fire this
        // script reported and finding it at a different ordinal.
        let sessionTurn = 0;

        const scoreTurn = (): void => {
            if (pendingReply === null) return;
            c.turns += 1;
            sessionTurn += 1;
            if (detectPromissory(pendingReply) !== null) c.promissory_fires += 1;
            if (detectLanguage(pendingReply, pendingPin) !== null) c.language_fires += 1;
            const cFired = detectUnverifiedEdit(pendingCalls) !== null;
            const eFinding = detectUntestedChange(pendingReply, pendingCalls);
            if (cFired) c.unverified_fires += 1;
            if (eFinding !== null) {
                c.untested_fires += 1;
                if (!cFired) c.untested_c_silent += 1;
                c.untested_sites.push({
                    session: sessionId,
                    turn: sessionTurn,
                    evidence: eFinding.evidence,
                });
            }
            if (pendingCalls.some((call) => _EDIT_TOOL_NAMES.has(call.name))) {
                c.turns_with_edit += 1;
            }
            const editedPaths = pendingCalls
                .filter((call) => _EDIT_TOOL_NAMES.has(call.name) && call.path !== undefined)
                .map((call) => call.path as string);
            if (editedPaths.some(_looksProductionSource)) {
                c.e1_production_source += 1;
                if (!editedPaths.some(_looksTestPath)) c.e2_no_test_touched += 1;
            }
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
                // `isSyntheticPrompt`, the SAME filter the gate uses for the
                // ordinal — not `isInjectedBody`. R2 round 2, finding 10: the
                // two filters classify differently, and any entry they disagree
                // about shifts this instrument's turn boundary away from the
                // gate's own. Population parity is the entire point of this
                // correction, so the filter has to be the same one.
                if (!isSyntheticPrompt(u)) {
                    scoreTurn(); // the previous turn ends here
                    pendingCalls = [];
                    const verdict = classify(u);
                    if (verdict.language !== 'und') pinned = verdict.language;
                }
                continue;
            }

            // Tool calls are collected BEFORE the text guard, exactly as the gate
            // does it: an assistant entry carrying only a `tool_use` block has no
            // text, so a `continue` above this line would drop precisely the
            // entries detectors C and E exist to read.
            if (entry['type'] === 'assistant' && !isSidechain(entry)) {
                const msg = entry['message'];
                if (typeof msg === 'object' && msg !== null && !Array.isArray(msg)) {
                    pendingCalls.push(
                        ...extractToolCalls((msg as Record<string, unknown>)['content']),
                    );
                }
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

export function renderFires(c: Counts): string {
    if (c.untested_sites.length === 0) return '  detector E fired on no turn in this corpus.';
    return c.untested_sites
        .map((site) => `  ${site.session} turn ${String(site.turn)} — ${site.evidence}`)
        .join('\n');
}

export function render(c: Counts): string {
    const pct = (n: number): string => (c.turns === 0 ? '0.0' : ((100 * n) / c.turns).toFixed(1));
    return [
        `measure-turn-end-gate · ${c.sessions} sessions · ${c.turns} turns · ${c.assistant_entries} assistant entries`,
        '',
        `  detector A (promissory)  fires on ${c.promissory_fires} turns  (${pct(c.promissory_fires)}%)`,
        `  detector B (language)    fires on ${c.language_fires} turns  (${pct(c.language_fires)}%)`,
        `  detector C (unverified)  fires on ${c.unverified_fires} turns  (${pct(c.unverified_fires)}%)`,
        `  detector E (untested)    fires on ${c.untested_fires} turns  (${pct(c.untested_fires)}%)`,
        '',
        `  Turns that edited a file at all: ${c.turns_with_edit} — C's and E's shared`,
        '  precondition, printed so a low E rate can be read as "rarely applicable"',
        '  rather than as "rarely right".',
        '',
        "  E's three conditions, cumulative — where the silence comes from:",
        `    1. edited production source          ${c.e1_production_source} turns`,
        `    2. …and touched no test file         ${c.e2_no_test_touched} turns`,
        `    3. …and claimed done  (= E fires)    ${c.untested_fires} turns`,
        '  A large drop at step 2 means the corpus writes its tests; a large drop at',
        '  step 3 means the turns that did not are also not claiming to be finished.',
        '  Only the first reading says the detector is narrow-and-right.',
        '',
        `  Of E's ${c.untested_fires} fires, detector C was SILENT on ${c.untested_c_silent}.`,
        '    That is the number ADR-277 rests its "two different questions deserve two',
        '    detectors" argument on, measured here over the corpus rather than over the',
        '    one unit test that asserted it. A count at or near zero refutes the record.',
        '',
        '  These are FIRE RATES, never precision. Every fire is a turn the shipped gate',
        '  would have refused; how many of those refusals were WRONG needs a human read',
        "  of the turns, and this script does not claim to have done one. ADR-277's",
        '  open limit is the false-positive rate, and an upper bound is not it.',
        '',
        '  Detector D is absent by construction: it reads `ci_last` from per-session',
        '  runtime state, which no transcript carries.',
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
        '    script does no per-turn matching between them, so no overlap can be claimed from these',
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
    let showFires = false;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--store' && argv[i + 1] !== undefined) {
            store = argv[i + 1]!;
            i += 1;
        } else if (argv[i] === '--show-fires') {
            showFires = true;
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
    if (showFires) {
        process.stdout.write(`\n  detector E fired here — read these turns before\n  calling any of them a false positive:\n${renderFires(counts)}\n`);
    }
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

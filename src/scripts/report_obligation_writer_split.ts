#!/usr/bin/env tsx
/**
 * report_obligation_writer_split — which kind of tree wrote the obligation rows.
 *
 * WHAT QUESTION THIS ANSWERS, AND WHY IT NEEDED A TOOL.
 * `obligation-settle-shadow-bar` is pre-registered against the shadow rows under
 * `agents/runtime/state/obligations/`, and its own clause (7) says that corpus is
 * one machine's runtime state. Until the rows carried a writer, that sentence was
 * the ONLY place the fact lived: a reader holding the ledgers could count rows and
 * could not separate them, so a reading that cleared the floor would have been
 * quotable as evidence about a population nobody had measured. This prints the
 * separation, from the rows themselves.
 *
 * IT REACHES NO VERDICT, AND THAT IS THE DESIGN. A split is an input to the corpus
 * decision held in `road-to-an-obligation-row-that-names-its-writer`, not the
 * decision — the three options there (accept the one-machine corpus and amend the
 * bar, widen it deliberately, or file the window `resolved-null`) are owner-
 * reserved, and all three name arming as owner-reserved too. So this exits 0 on
 * every path, prints counts, and says nothing about whether anything may be armed.
 * A reporter that graded the corpus would be handing the arming discussion a
 * verdict wearing a number's clothes.
 *
 * `absent` IS REPORTED APART FROM `unknown`, and the distinction is load-bearing.
 * `unknown` is a row whose writer WAS resolved and came back unresolvable; `absent`
 * is a row written before the field existed. Folding them together would let the
 * whole pre-field corpus read as "we looked and could not tell", which is a
 * stronger claim than "we had not started looking". The ledger's own `parseRows`
 * maps both to `unknown` — correct for a consumer that only needs a role — so this
 * reads the JSON directly rather than through it, and uses `isWriterRole` for the
 * vocabulary so the two cannot drift.
 *
 * PRIVACY, at the precision the code holds. Output is counts, plus the SCAN ROOT,
 * which the caller supplied and which is the one thing a reader needs in order to
 * know what was measured. Nothing else crosses: no session id, no ledger filename,
 * no rule id, no timestamp. The scan reads those and keeps none of them.
 *
 * WRITES NOTHING. It opens files for reading and creates no directory, not even
 * the ledger directory it looks for. A missing directory is a reported state, not
 * a thing to fix.
 *
 * Exit: 0 always, except a usage error (1). Advisory — it gates nothing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { OBLIGATION_STATE_DIR, WRITER_ROLES, isWriterRole } from './_lib/obligations.js';

/** The reported classes: the closed vocabulary, plus the pre-field case. */
export const REPORTED_CLASSES = [...WRITER_ROLES, 'absent'] as const;
export type ReportedClass = (typeof REPORTED_CLASSES)[number];

/** The three row arrays a ledger carries, named as the file names them. */
export const ROW_ARRAYS = ['delivered', 'discharged', 'shadow'] as const;
export type RowArray = (typeof ROW_ARRAYS)[number];

export type Tally = Record<ReportedClass, number>;

export interface WriterSplit {
    /** The directory scanned, echoed so a reader knows what was measured. */
    readonly store: string;
    /** `false` when the ledger directory does not exist at all. */
    readonly storeExists: boolean;
    /** Ledger files opened and parsed. */
    readonly ledgers: number;
    /** Files present but unreadable or unparseable — reported, never silently dropped. */
    readonly unreadable: number;
    /** Per row array, the split by writer class. */
    readonly byArray: Record<RowArray, Tally>;
    /** Every array folded together. */
    readonly total: Tally;
}

function emptyTally(): Tally {
    return { package: 0, consumer: 0, unknown: 0, absent: 0 };
}

/**
 * Classify one row's writer field.
 *
 * A field that is missing entirely is `absent`. A field that is present but
 * outside the closed vocabulary is `unknown`, matching `parseRows`: a corrupt
 * provenance label degrades, it never deletes the record of a real row.
 */
export function classifyRow(row: unknown): ReportedClass {
    if (typeof row !== 'object' || row === null) return 'absent';
    if (!('writer' in row)) return 'absent';
    const writer = (row as { writer: unknown }).writer;
    return isWriterRole(writer) ? writer : 'unknown';
}

/** Tally one ledger's arrays into an accumulator. */
function tallyLedger(doc: unknown, into: Record<RowArray, Tally>): void {
    if (typeof doc !== 'object' || doc === null) return;
    for (const name of ROW_ARRAYS) {
        const rows = (doc as Record<string, unknown>)[name];
        if (!Array.isArray(rows)) continue;
        for (const row of rows) into[name][classifyRow(row)] += 1;
    }
}

/**
 * Read every ledger under `root` and split its rows by writer class.
 *
 * Opens files for reading only. A file that will not parse increments
 * `unreadable` rather than being skipped in silence — a corpus with unreadable
 * members is a different corpus from a clean one, and a reader deciding whether
 * a sample floor is met needs to know which they have.
 */
export function readWriterSplit(root: string): WriterSplit {
    const store = path.join(root, OBLIGATION_STATE_DIR);
    const byArray: Record<RowArray, Tally> = {
        delivered: emptyTally(),
        discharged: emptyTally(),
        shadow: emptyTally(),
    };

    let entries: string[];
    try {
        entries = fs.readdirSync(store).filter((f) => f.endsWith('.json'));
    } catch {
        return { store, storeExists: false, ledgers: 0, unreadable: 0, byArray, total: emptyTally() };
    }

    let ledgers = 0;
    let unreadable = 0;
    for (const entry of entries) {
        let doc: unknown;
        try {
            doc = JSON.parse(fs.readFileSync(path.join(store, entry), 'utf-8'));
        } catch {
            unreadable += 1;
            continue;
        }
        ledgers += 1;
        tallyLedger(doc, byArray);
    }

    const total = emptyTally();
    for (const name of ROW_ARRAYS) {
        for (const cls of REPORTED_CLASSES) total[cls] += byArray[name][cls];
    }
    return { store, storeExists: true, ledgers, unreadable, byArray, total };
}

const sum = (t: Tally): number => REPORTED_CLASSES.reduce((n, c) => n + t[c], 0);

/**
 * Render the split as text.
 *
 * The line a reader is most likely to quote is the shadow row, so it is named
 * rather than left to be inferred from a table: the pre-registered bar counts
 * shadow rows and nothing else, and a split over `delivered` answers a question
 * the bar did not ask.
 */
export function render(split: WriterSplit): string {
    const out: string[] = [];
    out.push(`scanned: ${split.store}`);
    if (!split.storeExists) {
        out.push('  the ledger directory does not exist — nothing was measured.');
        out.push('  This is not a reading of zero. It is the absence of a corpus.');
        return `${out.join('\n')}\n`;
    }
    out.push(`  ledgers: ${split.ledgers}${split.unreadable > 0 ? `, unreadable: ${split.unreadable}` : ''}`);
    if (split.ledgers === 0) {
        out.push('  no ledger files — the directory exists and holds nothing.');
        return `${out.join('\n')}\n`;
    }

    const width = Math.max(...ROW_ARRAYS.map((n) => n.length));
    out.push('');
    out.push(`${'rows'.padEnd(width)}  ${REPORTED_CLASSES.map((c) => c.padStart(9)).join('')}    total`);
    for (const name of ROW_ARRAYS) {
        const t = split.byArray[name];
        const cells = REPORTED_CLASSES.map((c) => String(t[c]).padStart(9)).join('');
        out.push(`${name.padEnd(width)}  ${cells}  ${String(sum(t)).padStart(7)}`);
    }
    const cells = REPORTED_CLASSES.map((c) => String(split.total[c]).padStart(9)).join('');
    out.push(`${'all'.padEnd(width)}  ${cells}  ${String(sum(split.total)).padStart(7)}`);

    out.push('');
    out.push(
        `shadow rows — the only array the pre-registered bar counts: ${sum(split.byArray.shadow)}`,
    );
    out.push(
        '`absent` is a row written before the writer field existed; `unknown` is a row whose',
    );
    out.push('writer was resolved and came back unresolvable. They are not the same reading.');
    out.push('');
    out.push('This is a split, not a verdict. Whether the corpus is fit to read the bar off,');
    out.push('and what follows for the detector, are owner decisions this tool does not make.');
    return `${out.join('\n')}\n`;
}

/**
 * Read one flag's value, refusing a flag whose value is missing.
 *
 * A flag present as the last argv element must be a usage error and never a
 * silent fall back to the default. The same slip in a sibling reporter measured
 * the DEFAULT corpus while printing what read as a settled number — a confident
 * figure from a tree nobody asked for is worse than no figure at all.
 */
function argValue(argv: string[], flag: string, fallback: string): string {
    const i = argv.indexOf(flag);
    if (i === -1) return fallback;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
        process.stderr.write(`report_obligation_writer_split: ${flag} needs a value\n`);
        process.exit(1);
    }
    return value;
}

export function main(argv: string[]): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(
            'usage: report_obligation_writer_split [--root <dir>] [--json]\n\n' +
                '  --root <dir>  tree whose agents/runtime/state/obligations/ to read (default: cwd)\n' +
                '  --json        emit the split as JSON instead of text\n\n' +
                'Read-only. Writes nothing, gates nothing, exits 0.\n',
        );
        return 0;
    }
    const root = argValue(argv, '--root', process.cwd());
    const split = readWriterSplit(root);
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(split, null, 2)}\n` : render(split));
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    process.exit(main(process.argv.slice(2)));
}

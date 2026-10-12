#!/usr/bin/env tsx
/**
 * Which of the four contract sections a consumer `AGENTS.md` carries.
 *
 * `road-to-a-project-contract-written-down` step 1.3. `/agents:init` asks for
 * a goal and for no-gos, and an empty answer omits the section rather than
 * filling it. This is what reports the result: `N of 4`, with the missing ones
 * named.
 *
 * ```
 * READ-ONLY. IT INFERS NOTHING.
 * A GOAL THE AGENT COULD GUESS FROM THE DESCRIPTION IS STILL A GOAL NOBODY WROTE.
 * ```
 *
 * That is the whole design constraint. A reader that recognised "our goal is
 * …" in prose would report a contract the file does not carry, and the count
 * would become a statement about the reader instead of about the file.
 *
 * Usage:
 *   ./scripts-run src/scripts/report_project_contract [AGENTS.md]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

/** Presence of each contract section. Four booleans, never a score. */
export interface Contract {
    goal: boolean;
    noGos: boolean;
    architecture: boolean;
    conventions: boolean;
}

/**
 * Accepted `##` headings per section — the spellings the consumer guide and
 * the filled template actually produce, and no others. Matched whole, at
 * level two only: `### Goal` is a subsection of something else and `## Goals`
 * is a different word.
 */
const HEADINGS: Record<keyof Contract, readonly string[]> = {
    goal: ['goal'],
    noGos: ['no-gos', 'no-gos (never do this)'],
    architecture: ['architecture', 'architecture style', 'architecture & conventions'],
    conventions: ['conventions', 'coding conventions', 'architecture & conventions'],
};

/**
 * The `##` headings of a markdown body, lower-cased, skipping fenced blocks.
 *
 * The fence skip is load-bearing rather than tidy: the consumer guide ships
 * every one of these headings INSIDE a ```markdown fence as copy-in material,
 * so a reader without it reports the guide as a complete contract.
 */
function level2Headings(body: string): string[] {
    const out: string[] = [];
    let fence: string | null = null;
    for (const raw of body.split('\n')) {
        const line = raw.trimEnd();
        const open = /^\s*(```+|~~~+)/.exec(line);
        if (open !== null) {
            const marker = open[1] as string;
            if (fence === null) fence = marker[0] as string;
            else if (marker.startsWith(fence)) fence = null;
            continue;
        }
        if (fence !== null) continue;
        const m = /^##[ \t]+(.+?)[ \t]*#*$/.exec(line);
        if (m !== null) out.push((m[1] as string).trim().toLowerCase());
    }
    return out;
}

export function readContract(file: string): Contract {
    if (!fs.existsSync(file)) throw new Error(`report_project_contract: ${file} not found`);
    const headings = new Set(level2Headings(fs.readFileSync(file, 'utf8')));
    const has = (key: keyof Contract): boolean => HEADINGS[key].some((h) => headings.has(h));
    return { goal: has('goal'), noGos: has('noGos'), architecture: has('architecture'), conventions: has('conventions') };
}

const LABEL: Record<keyof Contract, string> = {
    goal: 'goal',
    noGos: 'no-gos',
    architecture: 'architecture',
    conventions: 'conventions',
};

export function renderReport(c: Contract): string {
    const keys = Object.keys(LABEL) as (keyof Contract)[];
    const present = keys.filter((k) => c[k]);
    const missing = keys.filter((k) => !c[k]);
    const head = `project contract: ${String(present.length)} of 4`;
    if (missing.length === 0) return `${head} — goal, no-gos, architecture, conventions.\n`;
    return (
        `${head} — missing: ${missing.map((k) => LABEL[k]).join(', ')}.\n` +
        'Nothing was inferred: a section the file does not carry is reported missing\n' +
        'rather than guessed from other prose. The copy-in shapes are in\n' +
        '`consumer-agents-md-guide.md`.\n'
    );
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write('usage: report_project_contract [AGENTS.md]\n\nRead-only. Prints N of 4.\n');
        return 0;
    }
    const file = path.resolve(argv.find((a) => !a.startsWith('-')) ?? 'AGENTS.md');
    let contract: Contract;
    try {
        contract = readContract(file);
    } catch (err) {
        process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
        return 1;
    }
    process.stdout.write(renderReport(contract));
    // Exit 0 whatever the count: this REPORTS, it does not gate. A consumer
    // who deliberately writes no no-gos has not failed anything.
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}

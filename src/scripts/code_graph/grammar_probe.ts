#!/usr/bin/env tsx
/**
 * Report what the PRODUCTION loader makes of each grammar file given as an
 * argument, as one line of JSON on stdout.
 *
 * A separate process because `check_pack_size.main` is synchronous while
 * `Language.load` is not, and because keeping the probe out of the gate's own
 * process means the gate cannot accidentally hold a loaded grammar's emscripten
 * heap for the rest of its run.
 *
 * Never throws for a bad file: an unreadable or invalid grammar comes back as
 * `{ ok: false, error }`, because "the loader refused this" is the ANSWER the
 * eligibility predicate needs, not a crash it has to interpret.
 */
import process from 'node:process';

import { probeGrammarFile } from './loader.js';

interface ProbeRow {
    path: string;
    ok: boolean;
    abi?: number;
    grammar_id?: string;
    error?: string;
}

async function main(): Promise<number> {
    const rows: ProbeRow[] = [];
    for (const p of process.argv.slice(2)) {
        try {
            const r = await probeGrammarFile(p);
            rows.push({ path: p, ok: true, abi: r.abi, grammar_id: r.grammar_id });
        } catch (e) {
            rows.push({ path: p, ok: false, error: (e as Error).message });
        }
    }
    process.stdout.write(`${JSON.stringify(rows)}\n`);
    return 0;
}

void main().then((c) => {
    process.exitCode = c;
});

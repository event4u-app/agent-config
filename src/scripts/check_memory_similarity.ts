#!/usr/bin/env tsx
/**
 * Advisory near-duplicate check for `/memory propose` — road-to-knowledge-system
 * Phase 2 (capture hygiene). Scans existing intake signals of the SAME type
 * for the closest Jaccard match to a candidate body and classifies it.
 *
 * This is an ADDITIONAL, non-destructive check layered in front of
 * `memory_signal.ts` — it never writes, and it never changes that script's
 * own exact-match rate-limit behaviour (a documented, load-bearing parity
 * contract). The `/memory propose` command runs this first; on `merge` it
 * surfaces the matched entry and asks the human before emitting anyway.
 *
 * Usage:
 *   check_memory_similarity.ts --type <type> --body "<text>" [--intake-root <dir>]
 *
 * Exit codes: 0 = create or warn (proceed, optionally after surfacing the
 * near match), 1 = merge threshold hit (surface the match, ask before
 * emitting), 2 = usage error, 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { classifySimilarity, findMostSimilar, type Candidate } from './_lib/text_similarity.js';

const PROG = 'check_memory_similarity.ts';

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Sorted signals-*.jsonl file paths under root — mirrors memory_signal.ts's own glob order. */
function globSignals(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    return names
        .filter((n) => n.startsWith('signals-') && n.endsWith('.jsonl'))
        .sort()
        .map((n) => path.join(root, n));
}

export function loadCandidates(intakeRoot: string, entryType: string): Candidate[] {
    const out: Candidate[] = [];
    for (const file of globSignals(intakeRoot)) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        for (const rawLine of text.split('\n')) {
            const line = rawLine.trim();
            if (!line) continue;
            let obj: unknown;
            try {
                obj = JSON.parse(line);
            } catch {
                continue;
            }
            if (!isPlainObject(obj)) continue;
            if (obj.entry_type !== entryType) continue;
            const id = typeof obj.id === 'string' ? obj.id : '';
            const body = typeof obj.body === 'string' ? obj.body : '';
            if (!id || !body) continue;
            out.push({ id, text: body });
        }
    }
    return out;
}

function printUsage(): void {
    process.stderr.write(`usage: ${PROG} --type TYPE --body BODY [--intake-root DIR]\n`);
}

export function main(argv: string[]): number {
    let type: string | null = null;
    let body: string | null = null;
    let intakeRoot = path.join('agents', 'memory', 'intake');

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            printUsage();
            return 0;
        } else if (arg === '--type') {
            type = argv[++i] ?? null;
        } else if (arg === '--body') {
            body = argv[++i] ?? null;
        } else if (arg === '--intake-root') {
            intakeRoot = argv[++i] ?? intakeRoot;
        } else {
            process.stderr.write(`${PROG}: error: unrecognized argument: ${arg}\n`);
            printUsage();
            return 2;
        }
    }

    if (!type || !body) {
        process.stderr.write(`${PROG}: error: --type and --body are required\n`);
        printUsage();
        return 2;
    }

    const candidates = loadCandidates(intakeRoot, type);
    const match = findMostSimilar(body, candidates);

    if (!match || match.classification === 'create') {
        process.stdout.write(`${PROG}: no near-duplicate found — proceed to create.\n`);
        return 0;
    }

    const scorePct = (match.score * 100).toFixed(0);
    if (match.classification === 'warn') {
        process.stdout.write(
            `${PROG}: nearest match ${match.id} (${scorePct}% similar) — review before proceeding, then create if distinct.\n`,
        );
        return 0;
    }

    // classification === 'merge'
    process.stdout.write(
        `${PROG}: likely duplicate of ${match.id} (${scorePct}% similar) — reuse or update that entry instead of creating a new one. Emit anyway only if this is a genuinely distinct finding.\n`,
    );
    return 1;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}

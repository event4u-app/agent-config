#!/usr/bin/env tsx
/**
 * Re-derives the rebuttal corpus balance table (ladder position × rhetoric
 * class, per item class) from `internal/bench/corpora/honesty-rebuttal.yaml`
 * and compares it with the table the file's header states between the
 * `balance-table` markers (road-to-a-challenge-the-bench-has-measured steps 1.1
 * and 1.2). The header is a claim about the data; this script is what makes it
 * checkable.
 *
 *   ./scripts-run src/scripts/bench_honesty_balance            # exit 1 when the header disagrees
 *   ./scripts-run src/scripts/bench_honesty_balance --print    # print the derived table
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { load as yamlLoad } from 'js-yaml';

const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), '..', '..');
export const REBUTTAL_PATH = path.join(ROOT, 'internal', 'bench', 'corpora', 'honesty-rebuttal.yaml');
export const BEGIN = '# <balance-table>';
export const END = '# </balance-table>';

interface Item {
    id: string;
    class: string;
    pushback: string[];
    rhetoric_sequence: string[];
}

/** One table per item class: class name → position (1-based) → rhetoric class → count. */
export function deriveBalance(items: readonly Item[]): Map<string, Map<number, Map<string, number>>> {
    const out = new Map<string, Map<number, Map<string, number>>>();
    for (const item of items) {
        if (item.rhetoric_sequence.length !== item.pushback.length) {
            throw new Error(`${item.id}: rhetoric_sequence has ${item.rhetoric_sequence.length} entries for ${item.pushback.length} pushback turns`);
        }
        const byPos = out.get(item.class) ?? new Map<number, Map<string, number>>();
        out.set(item.class, byPos);
        item.rhetoric_sequence.forEach((cls, i) => {
            const counts = byPos.get(i + 1) ?? new Map<string, number>();
            byPos.set(i + 1, counts);
            counts.set(cls, (counts.get(cls) ?? 0) + 1);
        });
    }
    return out;
}

export function renderBalance(items: readonly Item[]): string {
    const lines: string[] = [];
    for (const [cls, byPos] of deriveBalance(items)) {
        const n = items.filter((i) => i.class === cls).length;
        const rhetoric = [...new Set([...byPos.values()].flatMap((m) => [...m.keys()]))].sort();
        lines.push(`# ${cls} (${n} items)`);
        lines.push(`#   position | ${rhetoric.join(' | ')}`);
        const totals = new Map<string, number>();
        for (const [pos, counts] of [...byPos.entries()].sort((a, b) => a[0] - b[0])) {
            lines.push(`#   ${pos}        | ${rhetoric.map((r) => String(counts.get(r) ?? 0)).join(' | ')}`);
            for (const r of rhetoric) totals.set(r, (totals.get(r) ?? 0) + (counts.get(r) ?? 0));
        }
        lines.push(`#   total    | ${rhetoric.map((r) => String(totals.get(r) ?? 0)).join(' | ')}`);
    }
    return lines.join('\n');
}

export function statedBalance(text: string): string | null {
    const start = text.indexOf(BEGIN);
    const end = text.indexOf(END);
    if (start < 0 || end < start) return null;
    return text.slice(start + BEGIN.length, end).trim();
}

export function main(argv: string[], file = REBUTTAL_PATH): number {
    const text = fs.readFileSync(file, 'utf8');
    const doc = yamlLoad(text) as { fixtures?: Item[] };
    const derived = renderBalance(doc.fixtures ?? []);
    if (argv.includes('--print')) {
        process.stdout.write(`${derived}\n`);
        return 0;
    }
    const stated = statedBalance(text);
    if (stated === null) {
        process.stderr.write(`bench_honesty_balance: no ${BEGIN} … ${END} block in ${file}\n`);
        return 1;
    }
    if (stated !== derived) {
        process.stderr.write(`bench_honesty_balance: the stated balance table disagrees with the corpus. Derived:\n${derived}\n`);
        return 1;
    }
    process.stdout.write('bench_honesty_balance: the stated table matches the corpus\n');
    return 0;
}

if (fs.existsSync(process.argv[1] ?? '') && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main(process.argv.slice(2)));
}

#!/usr/bin/env tsx
/**
 * Spike S0.2 — index-parity resolution (road-to-scale-and-history-discipline
 * Phase 0). Can the query surface (WHERE / ORDER BY columns) be statically
 * joined to the migration/schema surface?
 *
 * PASS: resolution rate ≥ 0.80 across the Eloquent + Prisma fixture sets AND
 * the expected-violation matrix matches (all labeled violations found, waived
 * lines produce no gate finding).
 *
 * Verdict is data, not a gate — exit 0 always.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyze } from '../../../src/scripts/_lib/persistence/detect_index_parity.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '..', '..', 'fixtures', 'persistence', 'index_parity');

interface Expected {
    table: string;
    column: string;
}

// Labeled in the fixture headers (a-priori ground truth).
const EXPECTED_ELOQUENT: Expected[] = [
    { table: 'orders', column: 'channel' }, // array_where_queries
    { table: 'orders', column: 'channel' }, // order_queries
    { table: 'orders', column: 'total' },
    { table: 'posts', column: 'published_at' },
    { table: 'users', column: 'name' },
    { table: 'posts', column: 'view_count' },
];
const WAIVED_ELOQUENT: Expected[] = [{ table: 'analytics_events', column: 'session_id' }];

const EXPECTED_PRISMA: Expected[] = [
    { table: 'Order', column: 'total' },
    { table: 'Post', column: 'createdAt' },
    { table: 'User', column: 'name' },
];
const WAIVED_PRISMA: Expected[] = [{ table: 'Order', column: 'channel' }];

function match_matrix(
    findings: Array<{ message: string; waived?: boolean }>,
    expected: Expected[],
    waived: Expected[],
): { matched: number; missing: string[]; unexpected: string[] } {
    const remaining = findings.filter((f) => !f.waived).map((f) => f.message);
    const missing: string[] = [];
    let matched = 0;
    for (const e of expected) {
        const i = remaining.findIndex((m) => m.includes(e.table) && m.includes(e.column));
        if (i === -1) missing.push(`${e.table}.${e.column}`);
        else {
            matched += 1;
            remaining.splice(i, 1);
        }
    }
    // Any leftover gate finding is unexpected; a gate finding on a waived
    // column is a waiver-handling bug.
    const unexpected = remaining.concat(
        findings
            .filter((f) => !f.waived)
            .map((f) => f.message)
            .filter((m) => waived.some((w) => m.includes(w.table) && m.includes(w.column))),
    );
    return { matched, missing, unexpected: [...new Set(unexpected)] };
}

function main(): void {
    const eloquent = analyze(path.join(FIXTURES, 'eloquent'));
    const prisma = analyze(path.join(FIXTURES, 'prisma'));

    const m_eloquent = match_matrix(eloquent.findings, EXPECTED_ELOQUENT, WAIVED_ELOQUENT);
    const m_prisma = match_matrix(prisma.findings, EXPECTED_PRISMA, WAIVED_PRISMA);

    const resolved = eloquent.resolved + prisma.resolved;
    const unresolved = eloquent.unresolved + prisma.unresolved;
    const rate = resolved + unresolved === 0 ? 1 : resolved / (resolved + unresolved);

    const matrix_ok =
        m_eloquent.missing.length === 0 &&
        m_prisma.missing.length === 0 &&
        m_eloquent.unexpected.length === 0 &&
        m_prisma.unexpected.length === 0;
    const pass = rate >= 0.8 && matrix_ok;

    const verdict = {
        spike: 'S0.2',
        resolved,
        unresolved,
        total_where_columns: resolved + unresolved,
        resolution_rate: Number(rate.toFixed(3)),
        matrix: {
            eloquent: m_eloquent,
            prisma: m_prisma,
        },
        pass,
    };
    process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
    process.stdout.write(
        `${pass ? '✅' : '❌'}  S0.2 index-parity: resolution ${(rate * 100).toFixed(1)}% ` +
            `(threshold 80%), matrix ${matrix_ok ? 'ok' : 'MISMATCH'}\n`,
    );
}

main();

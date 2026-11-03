#!/usr/bin/env tsx
/**
 * Check an obligation ledger file (docs/contracts/reconstruction-obligations.md).
 *
 * The reference door runs this before it reports an `adapt` or `rebuild`
 * transfer as done. The file is JSON: `{ "evidence_ids": [...], "obligations": [...] }`
 * — the evidence ids the run recorded, and one row per behavior. A file that
 * records no evidence ids fails closed: no row's evidence can resolve.
 *
 * Usage: ./scripts-run src/scripts/reconstruction_ledger --check <file>
 *
 * Exit 0 closed · 1 open or unknown · 2 invalid, or a usage / read error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateLedger, type Obligation } from './_lib/reconstruction_ledger.js';

function fail(message: string): number {
    process.stderr.write(`reconstruction_ledger: ${message}\n`);
    return 2;
}

export function main(argv: readonly string[]): number {
    const i = argv.indexOf('--check');
    const file = i >= 0 ? argv[i + 1] : undefined;
    if (file === undefined) return fail('usage: reconstruction_ledger --check <file>');
    if (!fs.existsSync(file)) return fail(`no such file: ${file}`);
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
        return fail(`${file}: not JSON (${err instanceof Error ? err.message : String(err)})`);
    }
    const doc = data as { evidence_ids?: unknown; obligations?: unknown } | null;
    if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.obligations)) {
        return fail(`${file}: expected an object with an \`obligations\` array`);
    }
    if (!Array.isArray(doc.evidence_ids) || !doc.evidence_ids.every((e) => typeof e === 'string')) {
        return fail(`${file}: no \`evidence_ids\` list — without the run's records no evidence id can resolve`);
    }
    const verdict = evaluateLedger(doc.obligations as Obligation[], { evidenceIds: new Set(doc.evidence_ids as string[]) });
    const parity = verdict.parity === null ? 'n/a' : `${verdict.verified}/${verdict.counted}`;
    process.stdout.write(`ledger ${verdict.state} · parity ${parity}\n`);
    for (const e of verdict.errors) process.stdout.write(`  - ${e}\n`);
    if (verdict.state === 'closed') return 0;
    if (verdict.state === 'invalid') return 2;
    return 1;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}

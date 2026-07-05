#!/usr/bin/env node
/**
 * B7 — the falsifiability lock for the comparison-honesty table.
 *
 * Every `rows[].our_evidence` in `docs/comparison.yaml` must resolve to a real
 * pointer (file / file#substring / file:line / dated URL) — reusing the
 * check_claims resolver — and every `checkable: true` row must carry a resolving
 * `our_evidence`. So the proof page's comparison table can never claim
 * "checkable ✓" against a pointer that does not exist. Read-only; exit 0 clean /
 * 1 on any unresolved pointer or malformed row.
 *
 * We assert only OUR side. `their_evidence` is prose about the publicly-
 * observable category (no named source — check_no_external_sources guards that);
 * we never counter-claim a competitor number, so there is nothing to verify on
 * their side beyond "it is uncheckable", which is the point.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { REPO, pointer_unresolved } from './check_claims.js';

const _HERE = fileURLToPath(import.meta.url);
export const DATA_REL = 'docs/comparison.yaml';

export interface Row {
    claim: string;
    our_evidence: string;
    their_evidence: string;
    checkable: boolean;
}

export function loadRows(repo: string = REPO): Row[] {
    const p = path.join(repo, DATA_REL);
    if (!fs.existsSync(p)) return [];
    const data = parseYaml(fs.readFileSync(p, 'utf-8')) as { rows?: Row[] } | null;
    return Array.isArray(data?.rows) ? (data!.rows as Row[]) : [];
}

export function findErrors(rows: Row[]): string[] {
    const errs: string[] = [];
    rows.forEach((r, i) => {
        if (typeof r?.claim !== 'string' || !r.claim.trim()) errs.push(`row[${i}]: missing/empty claim`);
        if (typeof r?.their_evidence !== 'string' || !r.their_evidence.trim()) {
            errs.push(`row[${i}]: missing/empty their_evidence`);
        }
        if (typeof r?.checkable !== 'boolean') errs.push(`row[${i}]: checkable must be a boolean`);
        if (typeof r?.our_evidence !== 'string' || !r.our_evidence.trim()) {
            errs.push(`row[${i}]: missing/empty our_evidence`);
            return;
        }
        const bad = pointer_unresolved(r.our_evidence);
        if (bad !== null) errs.push(`row[${i}] (${r.claim.slice(0, 40)}…): our_evidence ${bad}: ${r.our_evidence}`);
    });
    return errs;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const quiet = argv.includes('--quiet');
    const rows = loadRows();
    const errs = findErrors(rows);
    if (errs.length > 0) {
        process.stdout.write('❌ comparison-honesty:\n');
        for (const e of errs.sort()) process.stdout.write(`  - ${e}\n`);
        return 1;
    }
    if (!quiet) {
        const checkable = rows.filter((r) => r.checkable).length;
        process.stdout.write(
            `✅  comparison-honesty: ${rows.length} row(s), ${checkable} checkable, all our_evidence pointers resolve.\n`,
        );
    }
    return 0;
}

const _isCli =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCli) process.exit(main());

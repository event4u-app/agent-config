import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readLedgers, tally } from '../../src/scripts/report_finding_precision.js';

const LEDGER_DIR = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'agents', 'evidence', 'release-findings');

describe('report_finding_precision — arithmetic', () => {
    it('precision is fixed over fixed plus false positives; the rest is counted apart', () => {
        const row = tally('x', [
            { status: 'fixed' },
            { status: 'fixed' },
            { status: 'fixed' },
            { status: 'false_positive' },
            { status: 'accepted_risk' },
            { status: 'still_open' },
            { status: 'open' },
            {},
        ]);
        expect(row).toMatchObject({ fixed: 3, false_positive: 1, accepted_risk: 1, still_open: 1, undisposed: 2 });
        expect(row.precision).toBe(0.75);
        expect(row.undisposed_share).toBe(0.25);
    });

    it('no adjudicated row gives a null precision, never zero', () => {
        expect(tally('x', [{ status: 'accepted_risk' }]).precision).toBeNull();
        expect(tally('x', []).undisposed_share).toBeNull();
    });

    it('releases sort by version, not by string', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledgers-'));
        for (const v of ['14.15.0', '9.14.0']) {
            fs.writeFileSync(path.join(dir, `${v}.json`), JSON.stringify({ release: v, findings: [{ status: 'fixed' }] }));
        }
        expect(readLedgers(dir).rows.map((r) => r.release)).toEqual(['9.14.0', '14.15.0']);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('report_finding_precision — the committed ledgers', () => {
    it('the total is the sum of the per-release rows', () => {
        const { rows, total } = readLedgers(LEDGER_DIR);
        expect(rows.length).toBeGreaterThan(0);
        expect(total.total).toBe(rows.reduce((n, r) => n + r.total, 0));
        expect(total.fixed).toBe(rows.reduce((n, r) => n + r.fixed, 0));
        expect(total.total).toBe(
            total.fixed + total.false_positive + total.accepted_risk + total.still_open + total.undisposed,
        );
    });
});

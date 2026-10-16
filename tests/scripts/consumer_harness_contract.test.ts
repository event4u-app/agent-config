/**
 * The consumer-claim subset in `docs/contracts/consumer-harness.md` is a list of
 * ids copied out of `docs/CLAIMS.md`. A copied list goes stale the moment the
 * ledger moves, so this reads both and fails on any disagreement.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT = fs.readFileSync(path.join(ROOT, 'docs/contracts/consumer-harness.md'), 'utf8');
const LEDGER = fs.readFileSync(path.join(ROOT, 'docs/CLAIMS.md'), 'utf8');

function ledgerStatus(): Map<string, string> {
    const out = new Map<string, string>();
    for (const block of LEDGER.split(/^### claim: /m).slice(1)) {
        const id = (block.split('\n')[0] ?? '').trim();
        const status = /^- status: (\S+)/m.exec(block)?.[1] ?? '';
        out.set(id, status);
    }
    return out;
}

function contractRows(): [string, string][] {
    const section = CONTRACT.split('## Consumer-facing claims')[1]?.split('\n## ')[0] ?? '';
    return [...section.matchAll(/^\| `([a-z0-9-]+)` \| ([a-z-]+) \|/gm)].map((m) => [m[1] as string, m[2] as string]);
}

describe('consumer-harness contract — claim subset', () => {
    it('lists at least one claim', () => {
        expect(contractRows().length).toBeGreaterThan(0);
    });

    it('every listed id exists in the ledger with the status the table states', () => {
        const ledger = ledgerStatus();
        for (const [id, status] of contractRows()) {
            expect(ledger.get(id), id).toBe(status);
        }
    });

    it('names tests/install/ as the harness and states the HOME rule', () => {
        expect(CONTRACT).toMatch(/`tests\/install\/` is the consumer harness/);
        expect(CONTRACT).toMatch(/env: \{ HOME, EVENT4U_CONFIG_HOME \}/);
    });
});

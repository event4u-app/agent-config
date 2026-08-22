// Tests for src/scripts/check_no_stub_inventory_table.ts.
//
// The gate replaces a paragraph that lost. `3793855b3` deleted the stub-inventory
// table and, in the same change, wrote a note telling future runs not to restore a
// row; a merge restored one anyway on 2026-08-22 (`28ba2f592`). So the cases below
// pin both edges deliberately: the shapes that MUST fail, and the ordinary tables
// in that file that must not — a blanket ban on markdown tables would trade one
// regression for a permanent block on legitimate documentation.
//
// The last describe runs the DEFAULT entry point against the real repository,
// because a test that only injects a fixture root proves the algorithm and not the
// gate: that is exactly how 14 gates in this repo came to scan a dead tree and exit
// green for months.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GUARDED, main, ROOT, scan_file } from '../../src/scripts/check_no_stub_inventory_table.js';

const GUARDED_REL = GUARDED[0]!;

/** Kinds the line trips, in the order the scanner reports them. */
function kinds(line: string): string[] {
    return scan_file('x.md', line).map((f) => f.kind);
}

describe('scan_file — inventory shapes that must fail', () => {
    it('flags the transfer-table header the deleted table used', () => {
        expect(
            kinds('| Stub | Transferred from | Outcome state | Re-entry gate (its own probe) |'),
        ).toEqual(['inventory-header']);
    });

    it('flags the org-mode header the OTHER deleted table used', () => {
        // Both historical tables opened with a `Stub` first cell; the gate keys on
        // that rather than on the remaining column names, which differed.
        expect(kinds('| Stub | Triggers org-mode surface | Gates |')).toEqual([
            'inventory-header',
        ]);
    });

    it('flags a body row linking to a sibling stub', () => {
        expect(
            kinds(
                '| [`road-to-org-telemetry-sink.md`](road-to-org-telemetry-sink.md) | parent | `transferred` | probe |',
            ),
        ).toEqual(['inventory-row']);
    });

    it('flags a sibling link without the backtick styling', () => {
        expect(kinds('| [road-to-x.md](road-to-x.md) | y |')).toEqual(['inventory-row']);
    });

    it('reports every row of a restored table, not just the first', () => {
        const table = [
            '| Stub | Transferred from |',
            '|---|---|',
            '| [`road-to-a.md`](road-to-a.md) | p |',
            '| [`road-to-b.md`](road-to-b.md) | q |',
        ].join('\n');
        expect(scan_file('x.md', table)).toHaveLength(3);
    });
});

describe('scan_file — legitimate tables that must pass', () => {
    // Review asked for the narrow structure, not a table ban. Each of these is a
    // table a future author could reasonably want in the guarded file.
    const allowed: ReadonlyArray<[string, string]> = [
        ['a two-column glossary', '| capability-gated | the scope decision is made |'],
        ['a glossary header', '| Term | Meaning |'],
        ['a delimiter row', '|---|---|'],
        [
            'a row citing a PARENT roadmap one directory up',
            '| [`road-to-estate-drawdown.md`](../archive/road-to-estate-drawdown.md) | 2.1 |',
        ],
        [
            'a row citing a pathed target elsewhere in the tree',
            '| [`ADR-241`](../../../docs/decisions/ADR-241-no-union-merge.md) | blocked |',
        ],
        ['prose naming a stub without a table', 'See [`road-to-a.md`](road-to-a.md) for the probe.'],
        ['a header whose first cell merely CONTAINS the word', '| Stub kind | Meaning |'],
    ];

    for (const [label, line] of allowed) {
        it(`ignores ${label}`, () => {
            expect(kinds(line)).toEqual([]);
        });
    }
});

describe('main — fixture root', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'stub-inv-'));
        fs.mkdirSync(path.dirname(path.join(root, GUARDED_REL)), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('exits 0 on a guarded file with no inventory table', () => {
        fs.writeFileSync(path.join(root, GUARDED_REL), '# Stubs\n\nThe directory is the index.\n');
        expect(main(['--quiet'], root)).toBe(0);
    });

    it('exits 1 on a reintroduced table', () => {
        fs.writeFileSync(
            path.join(root, GUARDED_REL),
            '| Stub | Transferred from |\n|---|---|\n| [`road-to-a.md`](road-to-a.md) | p |\n',
        );
        expect(main(['--quiet'], root)).toBe(1);
    });

    it('exits 1 — never 0 — when the guarded file does not exist', () => {
        // The `check_safety_floor_untouched` failure mode: a one-path guard whose
        // path moved announced success while guarding nothing. A rename must red.
        expect(main(['--quiet'], root)).toBe(1);
    });
});

describe('main — the default entry point, against the real repository', () => {
    it('resolves its guarded path and passes on the committed tree', () => {
        // Not a tautology: this is the invocation CI runs, and it is the half a
        // fixture-only test cannot prove. If the guarded file is ever moved without
        // updating GUARDED, this case fails rather than the gate going quiet.
        expect(fs.existsSync(path.join(ROOT, GUARDED_REL))).toBe(true);
        expect(main(['--quiet'])).toBe(0);
    });
});

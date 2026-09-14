import { describe, expect, it } from 'vitest';


import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    OWNERSHIP_CLASSES,
    decisionRowIds,
    checkFile,
    checkOwnershipColumn,
    checkUnresolvedMarkers,
    dischargeRanges,
    findDecisionsSection,
    readStatus,
    tableCells,
} from '../../src/scripts/lint_decision_classes.js';

const HEADER = '| ID | ownership | resolved by | decision | evidence | revisit if |';
const SEP = '|---|---|---|---|---|---|';

function table(...rows: string[]): string {
    return ['## Decisions', '', HEADER, SEP, ...rows, ''].join('\n');
}

describe('lint_decision_classes — the ownership vocabulary', () => {
    it('accepts each of the eight ownership classes', () => {
        for (const cls of OWNERSHIP_CLASSES) {
            const text = table(`| D1 | ${cls} | agent | pick x | file:1 | never |`);
            expect(checkFile('r.md', text)).toEqual([]);
        }
    });

    it('rejects an impact-axis class — the old axis leaking back in', () => {
        // The discrimination that matters: `high impact` is exactly the word the
        // ruling retired, and a gate that accepted it would enforce nothing.
        const v = checkFile('r.md', table('| D1 | high impact | owner | x | y | z |'));
        expect(v).toHaveLength(1);
        expect(v[0]?.reason).toMatch(/not one of the eight ownership classes/);
    });

    it.each(['critical', 'P1', 'high', 'blocker', 'technical'])(
        'rejects the near-miss class name %s',
        (name) => {
            expect(checkFile('r.md', table(`| D1 | ${name} | owner | x | y | z |`))).toHaveLength(1);
        },
    );

    it('reads the ownership column by NAME, not by position', () => {
        const text = [
            '## Decisions',
            '',
            '| ID | note | ownership | resolved by |',
            '|---|---|---|---|',
            '| D1 | anything | product-owned | owner |',
            '',
        ].join('\n');
        expect(checkOwnershipColumn('r.md', text.split('\n'))).toEqual([]);
    });

    it('a table with no ownership column is itself the finding', () => {
        const text = ['## Decisions', '', '| ID | decision |', '|---|---|', '| D1 | x |', ''].join(
            '\n',
        );
        const v = checkOwnershipColumn('r.md', text.split('\n'));
        expect(v).toHaveLength(1);
        expect(v[0]?.reason).toMatch(/no `ownership` column/);
    });

    it('an empty ownership cell reds', () => {
        expect(checkFile('r.md', table('| D1 |  | agent | x | y | z |'))).toHaveLength(1);
    });

    it('a roadmap with no `## Decisions` section is not judged on the vocabulary', () => {
        expect(checkOwnershipColumn('r.md', ['# Plan', '', 'Some prose.'])).toEqual([]);
    });
});

describe('lint_decision_classes — the resolver vocabulary', () => {
    it.each(['evidence', 'agent', 'owner', 'independent:gpt-5', 'council:rec-4', 'team:t-2'])(
        'accepts resolver %s',
        (r) => {
            expect(checkFile('r.md', table(`| D1 | deterministic | ${r} | x | y | z |`))).toEqual([]);
        },
    );

    it.each(['council', 'independent', 'team', 'me', 'the maintainer'])(
        'rejects resolver %s — a prefix form needs its record',
        (r) => {
            const v = checkFile('r.md', table(`| D1 | deterministic | ${r} | x | y | z |`));
            expect(v.map((x) => x.reason).join(' ')).toMatch(/resolved by/);
        },
    );
});

describe('lint_decision_classes — unresolved markers in a ready roadmap', () => {
    it.each(['TBD', 'to be decided', 'decide later', 'open question'])(
        'reds on the marker %s',
        (marker) => {
            const v = checkFile('r.md', `Pick the transport: ${marker}.\n`);
            expect(v).toHaveLength(1);
            expect(v[0]?.reason).toMatch(/unresolved decision marker/);
        },
    );

    it('the SAME marker resolved into a `## Decisions` row is green', () => {
        const text = [
            'Pick the transport.',
            '',
            table('| D1 | contested-technical | council:rec-9 | CLI first, API TBD on quota | rec-9 | quota changes |'),
        ].join('\n');
        expect(checkFile('r.md', text)).toEqual([]);
    });

    it('a `status: draft` roadmap is exempt from the marker check', () => {
        const text = '---\nstatus: draft\n---\n\nPick the transport: TBD.\n';
        expect(checkFile('r.md', text)).toEqual([]);
    });

    it('a marker inside a fenced block is not prose', () => {
        expect(checkFile('r.md', '```\nconst TBD = 1;\n```\n')).toEqual([]);
    });

    it('a structured `## Blockers` entry discharges its own open item', () => {
        // A five-field blocker is the recorded owner-routed decision. Firing here
        // would demand a roadmap close a decision it correctly did not own.
        const text = ['## Blockers', '', '### blocker: x', '- **Blocks:** the open question', ''].join(
            '\n',
        );
        expect(checkFile('r.md', text)).toEqual([]);
    });

    it('the ignore marker is respected', () => {
        expect(checkFile('r.md', 'TBD <!-- decision-marker: ignore -->\n')).toEqual([]);
    });
});

describe('lint_decision_classes — parsing helpers', () => {
    it('tableCells strips the outer pipes and trims', () => {
        expect(tableCells('| a | b |')).toEqual(['a', 'b']);
        expect(tableCells('not a row')).toEqual([]);
    });

    it('readStatus defaults to ready — status is binary and ready is implicit', () => {
        expect(readStatus('# Plan\n')).toBe('ready');
        expect(readStatus('---\nstatus: draft\n---\n')).toBe('draft');
    });

    it('findDecisionsSection stops at the next h2', () => {
        const lines = ['## Decisions', 'a', '## Next', 'b'];
        const sec = findDecisionsSection(lines);
        expect([sec.headingIdx, sec.start, sec.end]).toEqual([0, 1, 2]);
    });

    it('dischargeRanges covers both Decisions and Blockers', () => {
        const lines = ['## Decisions', 'a', '## Mid', 'b', '## Blockers', 'c'];
        expect(dischargeRanges(lines)).toEqual([
            [0, 2],
            [4, 6],
        ]);
    });

    it('checkUnresolvedMarkers reports a 1-based line number', () => {
        const v = checkUnresolvedMarkers('r.md', ['ok', 'TBD']);
        expect(v[0]?.line).toBe(2);
    });
});

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'decision-closure');

function readFixture(name: string): string {
    return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

describe('lint_decision_classes — the ready/resolved fixture pair', () => {
    it('R1: a ready roadmap with an unresolved marker is RED', () => {
        const v = checkFile('R1.md', readFixture('R1-ready-unresolved.md'));
        expect(v).toHaveLength(1);
        expect(v[0]?.reason).toMatch(/unresolved decision marker/);
    });

    it('R2: the same marker resolved into `## Decisions` is GREEN', () => {
        expect(checkFile('R2.md', readFixture('R2-ready-resolved.md'))).toEqual([]);
    });

    it('a marker naming a row that does not exist is still RED', () => {
        // Otherwise the cheapest repair is a dangling reference, which reads
        // as closed and records nothing.
        expect(checkFile('x.md', 'Pick it: TBD — closed as D9.\n')).toHaveLength(1);
    });

    it('decisionRowIds reads the first column of the table only', () => {
        const lines = readFixture('R2-ready-resolved.md').split('\n');
        expect([...decisionRowIds(lines)]).toEqual(['D1']);
    });
});

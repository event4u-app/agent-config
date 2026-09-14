/**
 * The obligation ledger's write side.
 *
 * Two properties carry most of the weight and neither is obvious from the
 * signature: a row must never enter the ledger wearing a class the closed
 * vocabulary denies, and a ledger file carrying another session's id must read
 * as empty rather than as that session's rows. The rest is append semantics.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    OBLIGATION_STATE_DIR,
    appendDelivered,
    ledgerWritable,
    parseRows,
    readDelivered,
    stamp,
    statePathFor,
    type DeliveredRow,
} from '../../src/scripts/_lib/obligations.js';
import { statePathFor as beforeCompletePathFor } from '../../src/scripts/before_complete_hook.js';

let root = '';

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'obligations-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const row = (rule: string, cls: DeliveredRow['cls'] = 'hook'): DeliveredRow => ({
    rule,
    cls,
    at: stamp(new Date('2026-09-13T10:00:00Z')),
});

const ledgerJson = (session: string): unknown =>
    JSON.parse(fs.readFileSync(path.join(root, statePathFor(session)), 'utf-8'));

describe('the path helper is shared, not reimplemented', () => {
    it('produces the same digest-keyed shape as the existing consumer', () => {
        const session = 'a-session-id-of-some-length';
        const mine = path.basename(statePathFor(session));
        const theirs = path.basename(beforeCompletePathFor(session));
        // Same filename for the same id — the digest keying is the shared part.
        expect(mine).toBe(theirs);
        expect(mine).toMatch(/^[0-9a-f]{32}\.json$/);
    });

    it('keys on the FULL id, so two long ids sharing a prefix do not collide', () => {
        const a = `${'x'.repeat(200)}-a`;
        const b = `${'x'.repeat(200)}-b`;
        expect(statePathFor(a)).not.toBe(statePathFor(b));
    });

    it('sits under the directory the continuity-surface row names', () => {
        expect(statePathFor('s').startsWith(OBLIGATION_STATE_DIR)).toBe(true);
    });
});

describe('appendDelivered', () => {
    it('writes one row per delivered rule and reports how many it added', () => {
        expect(appendDelivered(root, 's1', [row('ui-audit-gate'), row('minimal-safe-diff')])).toBe(
            2,
        );
        const rows = readDelivered(root, 's1');
        expect(rows.map((r) => r.rule)).toEqual(['ui-audit-gate', 'minimal-safe-diff']);
    });

    it('is idempotent per rule — a re-delivery after compaction adds nothing', () => {
        appendDelivered(root, 's1', [row('ui-audit-gate')]);
        expect(appendDelivered(root, 's1', [row('ui-audit-gate')])).toBe(0);
        expect(readDelivered(root, 's1')).toHaveLength(1);
    });

    it('keeps the FIRST timestamp, which is when the session came under the rule', () => {
        appendDelivered(root, 's1', [
            { rule: 'r', cls: 'hook', at: '2026-09-13T10:00:00Z' },
        ]);
        appendDelivered(root, 's1', [
            { rule: 'r', cls: 'hook', at: '2026-09-13T23:59:59Z' },
        ]);
        expect(readDelivered(root, 's1')[0]?.at).toBe('2026-09-13T10:00:00Z');
    });

    it('adds only the new rules when a batch partially overlaps', () => {
        appendDelivered(root, 's1', [row('a')]);
        expect(appendDelivered(root, 's1', [row('a'), row('b'), row('c')])).toBe(2);
        expect(readDelivered(root, 's1').map((r) => r.rule)).toEqual(['a', 'b', 'c']);
    });

    it('serialises the class under the key `class`, not `cls`', () => {
        appendDelivered(root, 's1', [row('a', 'observer')]);
        const delivered = (ledgerJson('s1') as { delivered: Record<string, unknown>[] }).delivered;
        expect(delivered[0]).toMatchObject({ rule: 'a', class: 'observer' });
        expect(delivered[0]).not.toHaveProperty('cls');
    });

    it('keeps sessions apart', () => {
        appendDelivered(root, 's1', [row('a')]);
        appendDelivered(root, 's2', [row('b')]);
        expect(readDelivered(root, 's1').map((r) => r.rule)).toEqual(['a']);
        expect(readDelivered(root, 's2').map((r) => r.rule)).toEqual(['b']);
    });

    it('does nothing, and does not throw, on an empty batch or a blank session id', () => {
        expect(appendDelivered(root, 's1', [])).toBe(0);
        expect(appendDelivered(root, '   ', [row('a')])).toBe(0);
    });

    it('never throws when the ledger cannot be written', () => {
        // A path whose parent is a FILE — mkdir fails, and the turn must not.
        const blocked = path.join(root, 'wall');
        fs.writeFileSync(blocked, 'not a directory');
        expect(() => appendDelivered(blocked, 's1', [row('a')])).not.toThrow();
        expect(appendDelivered(blocked, 's1', [row('a')])).toBe(0);
    });
});

describe('readDelivered refuses what it must not attribute', () => {
    it('reads a foreign session_id as empty rather than as this session rows', () => {
        appendDelivered(root, 's1', [row('a')]);
        const file = path.join(root, statePathFor('s1'));
        const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        doc['session_id'] = 'somebody-else';
        fs.writeFileSync(file, JSON.stringify(doc));
        expect(readDelivered(root, 's1')).toEqual([]);
    });

    it('is empty for a session with no ledger at all', () => {
        expect(readDelivered(root, 'never-seen')).toEqual([]);
    });

    it('is empty for an unparseable ledger rather than throwing', () => {
        const file = path.join(root, statePathFor('s1'));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '{ this is not json');
        expect(() => readDelivered(root, 's1')).not.toThrow();
        expect(readDelivered(root, 's1')).toEqual([]);
    });
});

describe('parseRows is strict about the row and lenient about the file', () => {
    it('DENIES a class outside the closed vocabulary', () => {
        // The state file must not be a back door around the schema.
        expect(
            parseRows({ delivered: [{ rule: 'a', class: 'judge', at: '2026-09-13T10:00:00Z' }] }),
        ).toEqual([]);
        expect(
            parseRows({
                delivered: [{ rule: 'a', class: 'validator-local', at: '2026-09-13T10:00:00Z' }],
            }),
        ).toEqual([]);
    });

    it('DENIES a row missing its rule, its class or its timestamp', () => {
        expect(parseRows({ delivered: [{ class: 'hook', at: 'x' }] })).toEqual([]);
        expect(parseRows({ delivered: [{ rule: 'a', at: 'x' }] })).toEqual([]);
        expect(parseRows({ delivered: [{ rule: 'a', class: 'hook' }] })).toEqual([]);
        expect(parseRows({ delivered: [{ rule: '', class: 'hook', at: 'x' }] })).toEqual([]);
    });

    it('keeps the intact rows of a partly corrupt ledger', () => {
        const rows = parseRows({
            delivered: [
                { rule: 'good', class: 'hook', at: '2026-09-13T10:00:00Z' },
                { rule: 'bad', class: 'nonsense', at: '2026-09-13T10:00:00Z' },
                null,
                'not an object',
                { rule: 'alsogood', class: 'none', at: '2026-09-13T10:00:00Z' },
            ],
        });
        expect(rows.map((r) => r.rule)).toEqual(['good', 'alsogood']);
    });

    it('is empty for shapes that are not a ledger', () => {
        expect(parseRows(null)).toEqual([]);
        expect(parseRows('nope')).toEqual([]);
        expect(parseRows({})).toEqual([]);
        expect(parseRows({ delivered: 'not an array' })).toEqual([]);
    });
});

describe('stamp and ledgerWritable', () => {
    it('stamps to second precision, with no milliseconds', () => {
        expect(stamp(new Date('2026-09-13T10:00:00.123Z'))).toBe('2026-09-13T10:00:00Z');
    });

    it('reports a writable ledger directory as writable', () => {
        expect(ledgerWritable(root)).toBe(true);
    });

    it('reports an unwritable one as false rather than throwing', () => {
        const blocked = path.join(root, 'wall');
        fs.writeFileSync(blocked, 'not a directory');
        expect(() => ledgerWritable(blocked)).not.toThrow();
        expect(ledgerWritable(blocked)).toBe(false);
    });

    it('leaves no probe file behind', () => {
        ledgerWritable(root);
        const dir = path.join(root, OBLIGATION_STATE_DIR);
        const left = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        expect(left.filter((f) => f.includes('writable-probe'))).toEqual([]);
    });
});

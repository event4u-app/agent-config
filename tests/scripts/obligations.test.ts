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
    WRITER_ROLES,
    appendDelivered,
    appendDischarge,
    appendShadow,
    isWriterRole,
    ledgerWritable,
    parseRows,
    readDelivered,
    readDischarged,
    readShadow,
    resolveWriterRole,
    stamp,
    statePathFor,
    type DeliveredRow,
    type WriterInput,
} from '../../src/scripts/_lib/obligations.js';
import { statePathFor as beforeCompletePathFor } from '../../src/scripts/before_complete_hook.js';

let root = '';

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'obligations-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const row = (rule: string, cls: DeliveredRow['cls'] = 'hook'): WriterInput<DeliveredRow> => ({
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

/**
 * The writer-identity field.
 *
 * The property under test is not "a field exists". It is that the field can
 * only ever carry one of three enumerated roles, that the caller cannot set it,
 * and that a maintainer checkout is never mislabelled as a consumer — because
 * the one reading the pre-registered shadow bar will be taken on a maintainer
 * checkout, and a `consumer` label there would invert the exact split the field
 * exists to make computable.
 */
const SENTINEL = '@event4u/agent-config';

/** Make `dir` look like this package's own checkout. */
const asPackage = (dir: string): string => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: SENTINEL }));
    return dir;
};

/** Make `dir` look like a project with this package installed. */
const asConsumer = (dir: string): string => {
    fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'agents', 'installed-tools.lock'), 'version: 1\n');
    return dir;
};

describe('resolveWriterRole classifies the tree, never names it', () => {
    it('reads a checkout carrying the package sentinel as `package`', () => {
        expect(resolveWriterRole(asPackage(path.join(root, 'pkg')))).toBe('package');
    });

    it('reads a project carrying only an install manifest as `consumer`', () => {
        expect(resolveWriterRole(asConsumer(path.join(root, 'proj')))).toBe('consumer');
    });

    it('reads a tree carrying neither marker as `unknown`, never as a guess', () => {
        const bare = path.join(root, 'bare');
        fs.mkdirSync(bare, { recursive: true });
        expect(resolveWriterRole(bare)).toBe('unknown');
    });

    it('reads a foreign package.json as `unknown`, not as `package`', () => {
        const other = path.join(root, 'other');
        fs.mkdirSync(other, { recursive: true });
        fs.writeFileSync(path.join(other, 'package.json'), JSON.stringify({ name: 'something' }));
        expect(resolveWriterRole(other)).toBe('unknown');
    });

    it('prefers `package` when BOTH markers are present — this repo installs itself', () => {
        // The order contract. A consumer-first test would label the maintainer
        // checkout `consumer` on exactly the machine the bar is read from.
        const both = path.join(root, 'both');
        asPackage(both);
        asConsumer(both);
        expect(resolveWriterRole(both)).toBe('package');
    });

    it('returns a value inside the closed vocabulary for every input, and never throws', () => {
        const missing = path.join(root, 'no-such-dir-at-all');
        expect(() => resolveWriterRole(missing)).not.toThrow();
        expect(WRITER_ROLES).toContain(resolveWriterRole(missing));
    });
});

describe('the writer is stamped onto every row type', () => {
    it('stamps a delivered row with the role of the root it was written under', () => {
        const pkg = asPackage(path.join(root, 'pkg'));
        appendDelivered(pkg, 's1', [row('a')]);
        expect(readDelivered(pkg, 's1')[0]?.writer).toBe('package');

        const proj = asConsumer(path.join(root, 'proj'));
        appendDelivered(proj, 's1', [row('a')]);
        expect(readDelivered(proj, 's1')[0]?.writer).toBe('consumer');
    });

    it('stamps a discharge row', () => {
        const proj = asConsumer(path.join(root, 'proj'));
        appendDischarge(proj, 's1', [{ rule: 'ui-audit-gate', by: 'design-pass', at: stamp() }]);
        expect(readDischarged(proj, 's1')[0]?.writer).toBe('consumer');
    });

    it('stamps a shadow row — the array the pre-registered bar actually counts', () => {
        const pkg = asPackage(path.join(root, 'pkg'));
        appendShadow(pkg, 's1', ['ui-audit-gate']);
        expect(readShadow(pkg, 's1')[0]?.writer).toBe('package');
    });

    it('serialises the writer under `writer` on disk', () => {
        appendDelivered(asPackage(path.join(root, 'pkg')), 's1', [row('a')]);
        const file = path.join(root, 'pkg', statePathFor('s1'));
        const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
            delivered: Record<string, unknown>[];
        };
        expect(doc.delivered[0]).toMatchObject({ writer: 'package' });
    });

    it('OVERRIDES a writer a caller tries to supply — provenance is not an input', () => {
        // Unreachable through the type, reachable from untyped JS. The stamp
        // wins, so a field a caller could forge is a field it cannot forge.
        const pkg = asPackage(path.join(root, 'pkg'));
        const forged = { rule: 'a', cls: 'hook', at: stamp(), writer: 'consumer' };
        appendDelivered(pkg, 's1', [forged as WriterInput<DeliveredRow>]);
        expect(readDelivered(pkg, 's1')[0]?.writer).toBe('package');
    });

    it('carries no free-form slot — the stored row is exactly four enumerated keys', () => {
        // The privacy property is the SHAPE, not a scrubber: a record with no
        // field able to hold a path cannot carry one.
        appendDelivered(asPackage(path.join(root, 'pkg')), 's1', [row('a')]);
        const file = path.join(root, 'pkg', statePathFor('s1'));
        const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
            delivered: Record<string, unknown>[];
        };
        expect(Object.keys(doc.delivered[0] ?? {}).sort()).toEqual([
            'at',
            'class',
            'rule',
            'writer',
        ]);
    });

    it('never puts a filesystem path into the row, whatever the root is called', () => {
        const named = asPackage(path.join(root, 'a-directory-name-nobody-should-see'));
        appendDelivered(named, 's1', [row('a')]);
        appendShadow(named, 's1', ['r']);
        const raw = fs.readFileSync(path.join(named, statePathFor('s1')), 'utf-8');
        expect(raw).not.toContain('a-directory-name-nobody-should-see');
        expect(raw).not.toContain(os.homedir());
    });
});

describe('the writer degrades, where the class is denied', () => {
    it('KEEPS a row written before the field existed, reading it `unknown`', () => {
        // Dropping it would destroy a real delivery record to punish a missing
        // label — the opposite of what the class check is for.
        const rows = parseRows({
            delivered: [{ rule: 'a', class: 'hook', at: '2026-09-13T10:00:00Z' }],
        });
        expect(rows.map((r) => r.writer)).toEqual(['unknown']);
    });

    it('KEEPS a row whose writer is outside the vocabulary, reading it `unknown`', () => {
        const rows = parseRows({
            delivered: [
                { rule: 'a', class: 'hook', at: '2026-09-13T10:00:00Z', writer: 'maintainer' },
                { rule: 'b', class: 'hook', at: '2026-09-13T10:00:00Z', writer: 17 },
            ],
        });
        expect(rows.map((r) => r.writer)).toEqual(['unknown', 'unknown']);
    });

    it('still DENIES a bad class, so the asymmetry is deliberate and not an oversight', () => {
        expect(
            parseRows({
                delivered: [
                    { rule: 'a', class: 'judge', at: '2026-09-13T10:00:00Z', writer: 'package' },
                ],
            }),
        ).toEqual([]);
    });

    it('guards the vocabulary at its one edge', () => {
        expect(WRITER_ROLES.every(isWriterRole)).toBe(true);
        expect(isWriterRole('maintainer')).toBe(false);
        expect(isWriterRole('')).toBe(false);
        expect(isWriterRole(undefined)).toBe(false);
    });
});

/**
 * The writer-split reporter.
 *
 * Two properties carry the weight. An ABSENT corpus must not read as a corpus of
 * zero — a reporter that prints "0 rows" for a directory it never found hands a
 * reader the same number a genuinely empty window would, and the pre-registered
 * bar is read off exactly that number. And `absent` must stay apart from
 * `unknown`: folding the pre-field rows into "we looked and could not tell" is a
 * stronger claim than the rows support.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OBLIGATION_STATE_DIR, appendDelivered, stamp } from '../../src/scripts/_lib/obligations.js';
import {
    classifyRow,
    main,
    readWriterSplit,
    render,
} from '../../src/scripts/report_obligation_writer_split.js';

let root = '';

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-split-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

/** Write one ledger file verbatim, so a test can plant pre-field rows. */
const plantLedger = (name: string, doc: unknown): void => {
    const dir = path.join(root, OBLIGATION_STATE_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(doc));
};

const deliveredRow = (writer?: unknown): Record<string, unknown> => {
    const r: Record<string, unknown> = { rule: 'a', class: 'hook', at: stamp() };
    if (writer !== undefined) r['writer'] = writer;
    return r;
};

describe('an absent corpus is not a corpus of zero', () => {
    it('reports storeExists false when the ledger directory does not exist', () => {
        const split = readWriterSplit(root);
        expect(split.storeExists).toBe(false);
        expect(split.ledgers).toBe(0);
    });

    it('says so in the text, rather than printing a table of zeroes', () => {
        const text = render(readWriterSplit(root));
        expect(text).toContain('does not exist');
        expect(text).toContain('absence of a corpus');
    });

    it('distinguishes that from a directory that exists and holds nothing', () => {
        fs.mkdirSync(path.join(root, OBLIGATION_STATE_DIR), { recursive: true });
        const split = readWriterSplit(root);
        expect(split.storeExists).toBe(true);
        expect(split.ledgers).toBe(0);
        expect(render(split)).toContain('holds nothing');
    });

    it('creates nothing — a missing directory is reported, never fixed', () => {
        readWriterSplit(root);
        expect(fs.existsSync(path.join(root, OBLIGATION_STATE_DIR))).toBe(false);
    });
});

describe('`absent` and `unknown` are reported apart', () => {
    it('classifies a row with no writer field as absent', () => {
        expect(classifyRow(deliveredRow())).toBe('absent');
    });

    it('classifies a row whose writer is outside the vocabulary as unknown', () => {
        expect(classifyRow(deliveredRow('maintainer'))).toBe('unknown');
        expect(classifyRow(deliveredRow(3))).toBe('unknown');
    });

    it('classifies each role as itself', () => {
        expect(classifyRow(deliveredRow('package'))).toBe('package');
        expect(classifyRow(deliveredRow('consumer'))).toBe('consumer');
        expect(classifyRow(deliveredRow('unknown'))).toBe('unknown');
    });

    it('keeps the two columns separate in the tally', () => {
        plantLedger('one', {
            session_id: 'one',
            delivered: [deliveredRow(), deliveredRow('unknown'), deliveredRow('package')],
            discharged: [],
            shadow: [],
        });
        const split = readWriterSplit(root);
        expect(split.byArray.delivered).toMatchObject({ absent: 1, unknown: 1, package: 1 });
    });
});

describe('the split it prints', () => {
    it('counts each row array separately and folds them into a total', () => {
        plantLedger('one', {
            session_id: 'one',
            delivered: [deliveredRow('package'), deliveredRow('package')],
            discharged: [{ rule: 'a', by: 'b', at: stamp(), writer: 'consumer' }],
            shadow: [{ at: stamp(), missing: ['a'], attempt: 1, would_refuse: true, writer: 'package' }],
        });
        const split = readWriterSplit(root);
        expect(split.byArray.delivered.package).toBe(2);
        expect(split.byArray.discharged.consumer).toBe(1);
        expect(split.byArray.shadow.package).toBe(1);
        expect(split.total).toMatchObject({ package: 3, consumer: 1, absent: 0, unknown: 0 });
    });

    it('reads rows the ledger itself wrote, not just planted ones', () => {
        // The producer and the reader must agree on the field name; a test that
        // only ever plants its own rows cannot see them disagree.
        fs.writeFileSync(
            path.join(root, 'package.json'),
            JSON.stringify({ name: '@event4u/agent-config' }),
        );
        appendDelivered(root, 'live-session', [{ rule: 'a', cls: 'hook', at: stamp() }]);
        expect(readWriterSplit(root).byArray.delivered.package).toBe(1);
    });

    it('counts an unparseable ledger rather than dropping it in silence', () => {
        const dir = path.join(root, OBLIGATION_STATE_DIR);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'broken.json'), '{ not json');
        const split = readWriterSplit(root);
        expect(split.unreadable).toBe(1);
        expect(split.ledgers).toBe(0);
    });

    it('names the shadow array as the one the bar counts', () => {
        plantLedger('one', { session_id: 'one', delivered: [deliveredRow('package')], discharged: [], shadow: [] });
        expect(render(readWriterSplit(root))).toContain('the only array the pre-registered bar counts');
    });

    it('reaches no verdict about arming or corpus fitness', () => {
        plantLedger('one', { session_id: 'one', delivered: [deliveredRow('package')], discharged: [], shadow: [] });
        const text = render(readWriterSplit(root));
        expect(text).toContain('not a verdict');
        expect(text).not.toMatch(/\b(may be armed|ready to arm|bar (is )?(met|cleared))\b/i);
    });

    it('echoes the scan root, so a reading names what it measured', () => {
        expect(render(readWriterSplit(root))).toContain(path.join(root, OBLIGATION_STATE_DIR));
    });

    it('leaks no session id, rule id or timestamp into the text', () => {
        plantLedger('one', {
            session_id: 'a-session-nobody-should-see',
            delivered: [{ rule: 'a-rule-nobody-should-see', class: 'hook', at: '2026-09-29T10:00:00Z', writer: 'package' }],
            discharged: [],
            shadow: [],
        });
        const text = render(readWriterSplit(root));
        expect(text).not.toContain('a-session-nobody-should-see');
        expect(text).not.toContain('a-rule-nobody-should-see');
        expect(text).not.toContain('2026-09-29T10:00:00Z');
    });
});

describe('the CLI gates nothing', () => {
    it('exits 0 on an absent corpus', () => {
        expect(main(['--root', root])).toBe(0);
    });

    it('exits 0 on a populated corpus', () => {
        plantLedger('one', { session_id: 'one', delivered: [deliveredRow('package')], discharged: [], shadow: [] });
        expect(main(['--root', root])).toBe(0);
    });

    it('exits 0 for --help', () => {
        expect(main(['--help'])).toBe(0);
    });
});

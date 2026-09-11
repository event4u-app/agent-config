/**
 * `measure_turn_end_gate` scoring detectors C and E over a transcript corpus.
 *
 * ADR-277 ships detector E with its false-positive rate unmeasured and names
 * that as an open limit. These cases assert the instrument that closes it reads
 * the population the SHIPPED gate reads — which is the only property that makes
 * the resulting number about the gate rather than about the instrument.
 *
 * The load-bearing case is the last pair: detector C silent while E fires. That
 * is the corpus form of the argument ADR-277 makes from a single unit test, so
 * if the two detectors ever converge, this is where it shows.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { measure } from '../../src/scripts/measure_turn_end_gate.js';

let store: string;

beforeEach(() => {
    store = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-turn-end-'));
});

afterEach(() => {
    fs.rmSync(store, { recursive: true, force: true });
});

function userEntry(text: string): Record<string, unknown> {
    return { type: 'user', message: { role: 'user', content: text } };
}

function toolEntry(name: string, input: Record<string, unknown>): Record<string, unknown> {
    return {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'tool_use', name, input }] },
    };
}

function replyEntry(text: string): Record<string, unknown> {
    return {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text }] },
    };
}

function writeSession(name: string, entries: Record<string, unknown>[]): void {
    fs.writeFileSync(
        path.join(store, `${name}.jsonl`),
        `${entries.map((e) => JSON.stringify(e)).join('\n')}\n`,
    );
}

describe('detector E over a corpus', () => {
    it('counts a turn that wrote production code, no test, and claimed done', () => {
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Done. The toggle is in place.'),
        ]);
        const c = measure(store, 30);
        expect(c.turns).toBe(1);
        expect(c.turns_with_edit).toBe(1);
        expect(c.untested_fires).toBe(1);
    });

    it('does not count the same turn once a test file is touched', () => {
        // The second of E's three conditions, isolated: everything else about
        // this turn is identical to the case above.
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            toolEntry('Write', { file_path: 'tests/Toggle.test.tsx' }),
            replyEntry('Done. The toggle is in place.'),
        ]);
        expect(measure(store, 30).untested_fires).toBe(0);
    });

    it('does not count a turn that claims nothing', () => {
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Fertig ist der Toggle noch nicht — der Test kommt als Nächstes.'),
        ]);
        expect(measure(store, 30).untested_fires).toBe(0);
    });

    it('scopes tool calls to their own turn, so a later turn is not charged', () => {
        // The reset the gate does at every genuine user prompt. Without it the
        // second turn inherits the first turn's edit and E fires on a reply that
        // changed nothing — which would make every trailing "done" a fire and
        // the published rate meaningless.
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Written.'),
            userEntry('what does it do?'),
            replyEntry('It toggles.\nDone.'),
        ]);
        const c = measure(store, 30);
        expect(c.turns).toBe(2);
        expect(c.untested_fires).toBe(0);
    });

    it('ignores a subagent’s own tool calls', () => {
        // A sidechain edit happened in another context. Charging the main
        // thread for it is the same class of error as the missing turn reset.
        writeSession('a', [
            userEntry('add the toggle'),
            { ...toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }), isSidechain: true },
            replyEntry('Done.'),
        ]);
        expect(measure(store, 30).untested_fires).toBe(0);
    });
});

describe('the C-silent overlap ADR-277 argues from', () => {
    it('records E firing while C stays silent when a linter ran', () => {
        // The audit's central claim: `npx eslint src` satisfies detector C's
        // "did anything verify" question and says nothing about whether the
        // change is tested. If this ever reads 0, ADR-277's "two different
        // questions deserve two detectors" is refuted and the record reopens.
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            toolEntry('Bash', { command: 'npx eslint src' }),
            replyEntry('Done. Lint is clean.'),
        ]);
        const c = measure(store, 30);
        expect(c.untested_fires).toBe(1);
        expect(c.unverified_fires).toBe(0);
        expect(c.untested_c_silent).toBe(1);
    });

    it('points at the fire with a PER-SESSION turn ordinal', () => {
        // The corpus-wide running total was the first label here, and it sent a
        // reader to turn 17 of a session whose fire was on turn 6. A pointer
        // that resolves to the wrong turn is worse than none: it reads as a
        // verified location.
        writeSession('aaaaaaaa-1111', [
            userEntry('one'),
            replyEntry('Nothing to see.'),
            userEntry('two'),
            replyEntry('Still nothing.'),
        ]);
        writeSession('bbbbbbbb-2222', [
            userEntry('first'),
            replyEntry('Looking.'),
            userEntry('now build it'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Done.'),
        ]);
        const c = measure(store, 30);
        expect(c.turns).toBe(4);
        expect(c.untested_sites).toHaveLength(1);
        // `sessionId` is the filename's first 8 chars, as the sibling scanner
        // keys it — the fixture names are UUID-shaped so the slice means here
        // what it means over a real store.
        expect(c.untested_sites[0]!.session).toBe('bbbbbbbb');
        expect(c.untested_sites[0]!.turn).toBe(2);
    });

    it('does not count the overlap when C fired too', () => {
        writeSession('a', [
            userEntry('add the toggle'),
            toolEntry('Write', { file_path: 'src/components/Toggle.tsx' }),
            replyEntry('Done.'),
        ]);
        const c = measure(store, 30);
        expect(c.untested_fires).toBe(1);
        expect(c.unverified_fires).toBe(1);
        expect(c.untested_c_silent).toBe(0);
    });
});

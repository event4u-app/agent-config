/**
 * `measure_turn_end_gate` scoring detectors C, E and F over a transcript corpus.
 *
 * ADR-277 ships detector F with its false-positive rate unmeasured and names
 * that as an open limit. These cases assert the instrument that closes it reads
 * the population the SHIPPED gate reads — which is the only property that makes
 * the resulting number about the gate rather than about the instrument.
 *
 * The load-bearing case is the last pair: detector C silent while F fires. That
 * is the corpus form of the argument ADR-277 makes from a single unit test, so
 * if the two detectors ever converge, this is where it shows.
 *
 * Detector E arrived here on 2026-09-11, having been scored by nothing until
 * then. Its cases carry one extra weight the others do not: E reads the turn's
 * assistant TEXTS, an accumulation no other detector needs, so the turn boundary
 * has to be asserted on the array itself rather than inherited from the tool-call
 * reset that already has coverage. The case that matters is the tool-only entry —
 * the ordinary shape of every working turn, and the one that would make E fire
 * across the corpus if a text-free entry ever entered the array.
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

describe('detector F over a corpus', () => {
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
        // The second of F's three conditions, isolated: everything else about
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
        // second turn inherits the first turn's edit and F fires on a reply that
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

describe('detector E over a corpus', () => {
    /** An ask: a numbered block plus the single recommendation line Iron Law 1 requires. */
    const ASKED = ['1. ship it', '2. measure first', '', 'Recommendation: 2'].join('\n');
    /** The closing reply that drops it — the measured failure, not an invented shape. */
    const DROPPED = 'The reviewer is through, no findings.';

    it('counts a turn that asked in one reply and closed without the ask', () => {
        writeSession('a', [userEntry('what next?'), replyEntry(ASKED), replyEntry(DROPPED)]);
        const c = measure(store, 30);
        expect(c.turns).toBe(1);
        expect(c.turns_multi_text).toBe(1);
        expect(c.dropped_fires).toBe(1);
    });

    it('is silent when the closing reply carries the ask forward', () => {
        writeSession('a', [userEntry('what next?'), replyEntry(ASKED), replyEntry(ASKED)]);
        expect(measure(store, 30).dropped_fires).toBe(0);
    });

    it('does not let a tool-only entry become a second assistant text', () => {
        // E's entire false-positive surface. A working turn is prose, tool call,
        // prose; if a text-free entry entered the array, every turn that asked
        // and then ran a command would read as a dropped ask. `assistantText`
        // returns null for it, exactly as the gate's `_messageText` does — this
        // asserts that rather than trusting the reading.
        writeSession('a', [
            userEntry('what next?'),
            replyEntry(ASKED),
            toolEntry('Bash', { command: 'npx vitest run' }),
        ]);
        const c = measure(store, 30);
        expect(c.turns_multi_text).toBe(0);
        expect(c.dropped_fires).toBe(0);
    });

    it('scopes the ask to its own turn, so a user answer ends it', () => {
        // The reset that makes "in the SAME user turn" true of the array rather
        // than merely intended. Without it the ask outlives the answer and every
        // later reply in the session reads as having dropped it.
        writeSession('a', [
            userEntry('what next?'),
            replyEntry(ASKED),
            userEntry('2'),
            replyEntry(DROPPED),
        ]);
        const c = measure(store, 30);
        expect(c.turns).toBe(2);
        expect(c.turns_multi_text).toBe(0);
        expect(c.dropped_fires).toBe(0);
    });

    it('separates a fire inside a tool-bearing turn from one outside it', () => {
        // E was designed from a stop-hook nudge producing a second assistant
        // execution mid-turn, which is a tool-bearing shape. The split is the
        // only thing that says whether a corpus fire is the designed-for case or
        // a shape nothing predicted, so a single total would hide the question.
        writeSession('aaaaaaaa-1111', [
            userEntry('what next?'),
            replyEntry(ASKED),
            toolEntry('Bash', { command: 'npx eslint src' }),
            replyEntry(DROPPED),
        ]);
        writeSession('bbbbbbbb-2222', [userEntry('what next?'), replyEntry(ASKED), replyEntry(DROPPED)]);
        const c = measure(store, 30);
        expect(c.dropped_fires).toBe(2);
        expect(c.dropped_with_tool).toBe(1);
    });

    it('points at the fire with a per-session ordinal and a text-free evidence span', () => {
        // Same pointer contract F's sites carry: the option NUMBERS and the span,
        // never the option text, because the evidence is quoted into a refusal
        // that reaches the transcript.
        writeSession('cccccccc-3333', [
            userEntry('one'),
            replyEntry('Nothing to see.'),
            userEntry('what next?'),
            replyEntry(ASKED),
            replyEntry(DROPPED),
        ]);
        const c = measure(store, 30);
        expect(c.dropped_sites).toHaveLength(1);
        expect(c.dropped_sites[0]!.session).toBe('cccccccc');
        expect(c.dropped_sites[0]!.turn).toBe(2);
        expect(c.dropped_sites[0]!.evidence).toContain('1/2');
        expect(c.dropped_sites[0]!.evidence).not.toContain('measure first');
    });

    it('ignores a subagent’s own asks', () => {
        // A sidechain reply happened in another context, so an ask inside it was
        // never put to this user — the same exclusion the tool-call path makes.
        writeSession('a', [
            userEntry('what next?'),
            { ...replyEntry(ASKED), isSidechain: true },
            replyEntry(DROPPED),
        ]);
        expect(measure(store, 30).dropped_fires).toBe(0);
    });
});

describe('the C-silent overlap ADR-277 argues from', () => {
    it('records F firing while C stays silent when a linter ran', () => {
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

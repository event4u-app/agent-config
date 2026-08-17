/**
 * interruption_ledger — road-to-user-out-of-the-loop Phase 0 Step 1.
 *
 * The classifier IS the measurement, so its boundaries are what these tests
 * pin. A baseline is pre-registered against these numbers; a detector that
 * over- or under-counts does not fail a build, it silently decides whether the
 * roadmap later reads as a success.
 *
 * Two directions are covered deliberately, because a contact metric can be
 * wrong in both and only one of them is visible:
 *   · under-counting — a hand-back with no `?` reads as zero contacts, which
 *     flatters the design (the package's own preferred yield shape);
 *   · over-counting — a rhetorical or quoted question inflates the BEFORE
 *     number, which flatters the change measured against it.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    alreadyRecorded,
    classifyReply,
    hasNumberedOptions,
    readClaimedRoadmap,
} from '../../../src/scripts/hooks/interruption_ledger_hook.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'interruption-ledger-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('hasNumberedOptions', () => {
    it('needs two numbered lines — one is prose enumeration, not a decision surface', () => {
        expect(hasNumberedOptions('1. read the file and move on')).toBe(false);
        expect(hasNumberedOptions('1. keep it\n2. drop it')).toBe(true);
    });

    it('accepts the "1)" form as well as "1."', () => {
        expect(hasNumberedOptions('1) keep it\n2) drop it')).toBe(true);
    });

    it('does not fire on a numbered line with no content after the marker', () => {
        expect(hasNumberedOptions('1.\n2.')).toBe(false);
    });
});

describe('classifyReply — the ask direction', () => {
    it('classifies a closing question as an open-question ask', () => {
        const v = classifyReply('I found two candidates.\n\nWhich one should I take?');
        expect(v.kind).toBe('ask');
        expect(v.class).toBe('open-question');
    });

    it('classifies a closing question carrying a numbered block as numbered-options', () => {
        const reply = [
            'Two ways to go.',
            '',
            '1. Extract the module',
            '2. Raise the baseline',
            '',
            'Which do you want?',
        ].join('\n');
        const v = classifyReply(reply);
        expect(v.kind).toBe('ask');
        expect(v.class).toBe('numbered-options');
    });

    it('tolerates a closing quote or bracket after the question mark', () => {
        expect(classifyReply('So the real question is "what now?"').kind).toBe('ask');
    });
});

describe('classifyReply — the over-counting direction', () => {
    it('does NOT count a rhetorical question that is not the closing sentence', () => {
        const reply = 'Why did it fail? The baseline was stale. I re-anchored it and moved on.';
        expect(classifyReply(reply).kind).toBe('none');
    });

    it('does NOT count a question that only appears inside a fenced block', () => {
        const reply = ['Ran the probe.', '', '```', 'usage: is this right?', '```', ''].join('\n');
        expect(classifyReply(reply).kind).toBe('none');
    });

    it('treats an empty or whitespace-only reply as no contact', () => {
        expect(classifyReply('').kind).toBe('none');
        expect(classifyReply('   \n\n  ').kind).toBe('none');
    });
});

describe('classifyReply — the under-counting direction', () => {
    it('counts a German hand-back with no question mark as a contact', () => {
        const v = classifyReply('Der Rest ist fertig.\n\nDas entscheidest Du.');
        expect(v.kind).toBe('handback');
        expect(v.class).toBe('handback');
    });

    it('counts an English hand-back with no question mark as a contact', () => {
        expect(classifyReply('Both paths work. Your call.').kind).toBe('handback');
    });

    it('prefers the ask classification when a hand-back also ends in a question', () => {
        const v = classifyReply('Your call — which one?');
        expect(v.kind).toBe('ask');
    });
});

describe('classifyReply — a finished turn is not a contact', () => {
    it('records no contact for a plain completion report', () => {
        const v = classifyReply('Ran the sweep: 25 files, 285 tests, all green.');
        expect(v.kind).toBe('none');
        expect(v.class).toBe('none');
    });
});

describe('readClaimedRoadmap', () => {
    function writeClaim(session: string, body: string): void {
        const dir = path.join(tmp, 'agents', 'runtime', 'state');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `roadmap-claim-${session}.json`), body, 'utf8');
    }

    it('returns the claimed slug', () => {
        writeClaim('s1', JSON.stringify({ slug: 'road-to-x', session_id: 's1' }));
        expect(readClaimedRoadmap(tmp, 's1')).toBe('road-to-x');
    });

    it('returns null when no claim exists — the common non-roadmap session', () => {
        expect(readClaimedRoadmap(tmp, 's-none')).toBeNull();
    });

    it('returns null rather than throwing on a corrupt claim file', () => {
        writeClaim('s2', '{ not json');
        expect(readClaimedRoadmap(tmp, 's2')).toBeNull();
    });

    it('returns null on a claim carrying an empty slug', () => {
        writeClaim('s3', JSON.stringify({ slug: '' }));
        expect(readClaimedRoadmap(tmp, 's3')).toBeNull();
    });

    it('returns null for an empty session id', () => {
        expect(readClaimedRoadmap(tmp, '')).toBeNull();
    });
});

describe('alreadyRecorded', () => {
    function ledger(lines: readonly object[]): string {
        const file = path.join(tmp, 'interruptions.jsonl');
        fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
        return file;
    }

    it('is false when the ledger does not exist', () => {
        expect(alreadyRecorded(path.join(tmp, 'absent.jsonl'), 'r1', 3)).toBe(false);
    });

    it('detects the duplicate a repeated stop produces', () => {
        const file = ledger([{ run_id: 'r1', turn: 3 }]);
        expect(alreadyRecorded(file, 'r1', 3)).toBe(true);
    });

    it('does not collide across runs on the same turn ordinal', () => {
        const file = ledger([{ run_id: 'r1', turn: 3 }]);
        expect(alreadyRecorded(file, 'r2', 3)).toBe(false);
    });

    it('does not collide across turns within one run', () => {
        const file = ledger([{ run_id: 'r1', turn: 3 }]);
        expect(alreadyRecorded(file, 'r1', 4)).toBe(false);
    });

    it('survives a corrupt line without losing the write', () => {
        const file = path.join(tmp, 'interruptions.jsonl');
        fs.writeFileSync(file, '{ broken\n' + JSON.stringify({ run_id: 'r1', turn: 3 }) + '\n');
        expect(alreadyRecorded(file, 'r1', 3)).toBe(true);
        expect(alreadyRecorded(file, 'r1', 9)).toBe(false);
    });

    it('only scans the tail — an old duplicate beyond the window re-records rather than being lost', () => {
        const old = { run_id: 'r1', turn: 1 };
        const filler = Array.from({ length: 30 }, (_, i) => ({ run_id: 'r1', turn: i + 100 }));
        const file = ledger([old, ...filler]);
        // Documented boundary, not an accident: the dedupe window is the last 20
        // lines because a repeated `stop` is always adjacent. A turn that old
        // re-recording is the deliberate trade for not re-reading the whole
        // ledger on every turn.
        expect(alreadyRecorded(file, 'r1', 1)).toBe(false);
        expect(alreadyRecorded(file, 'r1', 129)).toBe(true);
    });
});

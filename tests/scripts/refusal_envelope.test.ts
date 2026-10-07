import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isOpaqueRoundId } from '../../src/scripts/_lib/source_shape.js';
import {
    batchLaneRefusals,
    renderEnvelope,
    writeEnvelope,
    type EnvelopeInput,
} from '../../src/scripts/refusal_envelope.js';

const input: EnvelopeInput = {
    task: 'Ship the auto-merge authority change',
    done: ['ADR written', 'classifier written'],
    refusals: [{ action: 'run the classifier tests', reason: 'Auto-Mode Bypass', lane: 'main' }],
    remaining: ['run tests/scripts/classify_merge_risk.test.ts', 'merge the PR'],
    ownerDirective: 'agents/evidence/owner-directives/2026-10-07-round-abc123.md',
};

describe('renderEnvelope', () => {
    it('carries every part a fresh session needs, in a fixed order', () => {
        const body = renderEnvelope(input);
        const order = ['## Task', '## Done', '## Refused by the host classifier', '## Remaining steps', '## Owner authorization'];
        const at = order.map((h) => body.indexOf(h));
        expect(at.every((i) => i >= 0)).toBe(true);
        expect([...at].sort((a, b) => a - b)).toEqual(at);
        expect(body).toContain('Auto-Mode Bypass');
        expect(body).toContain(input.ownerDirective);
    });

    it('tells the next session not to route around the refusal', () => {
        expect(renderEnvelope(input)).toMatch(/do not retry or route around/i);
    });

    it('refuses an envelope with no refusal — there is nothing to hand off', () => {
        expect(() => renderEnvelope({ ...input, refusals: [] })).toThrow();
    });
});

describe('writeEnvelope', () => {
    it('writes prompt.md under an opaque round directory in agents/tmp', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'));
        const file = writeEnvelope(root, input);
        const rel = path.relative(root, file).split(path.sep);
        expect(rel[0]).toBe('agents');
        expect(rel[1]).toBe('tmp');
        expect(isOpaqueRoundId(rel[2] ?? '')).toBe(true);
        expect(rel[3]).toBe('prompt.md');
        expect(fs.readFileSync(file, 'utf8')).toBe(renderEnvelope(input));
    });

    it('never overwrites an earlier envelope', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'));
        expect(writeEnvelope(root, input)).not.toBe(writeEnvelope(root, input));
    });
});

describe('batchLaneRefusals', () => {
    it('collects the fixed lane field from many reports into one list, tagged by lane', () => {
        const merged = batchLaneRefusals([
            { lane: 'a', classifier_refusals: [{ action: 'x', reason: 'r1' }] },
            { lane: 'b', classifier_refusals: [] },
            { lane: 'c', classifier_refusals: [{ action: 'y', reason: 'r2' }] },
        ]);
        expect(merged).toEqual([
            { lane: 'a', action: 'x', reason: 'r1' },
            { lane: 'c', action: 'y', reason: 'r2' },
        ]);
    });

    it('treats a report that omits the field as malformed, not as "no refusals"', () => {
        expect(() => batchLaneRefusals([{ lane: 'a' } as never])).toThrow(/classifier_refusals/);
    });
});

// The third of the three payload numbers
// (`road-to-the-delivery-flip-that-tells-the-truth` Phase 3).
//
// Two properties are worth a test and one of them is the whole point. The first
// is that the reading exists and is honest about not existing: a tree with no
// frozen corpus must report `measured: false` with a reason, never a plausible
// distribution. The second is that it is INFORMATIONAL — it may not reach the
// exit code, and it may not be summed into either of the two quantities ADR-270
// already keeps apart.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    measureActivationPayload,
    percentile,
    ROUTING_MATRIX_REL,
} from '../../src/scripts/_lib/activation_payload.js';
import { evaluate, main, renderActivation } from '../../src/scripts/check_preamble_payload_budget.js';
import { CAP_BYTES } from '../../src/scripts/hooks/rule_inject_hook.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

const tmps: string[] = [];
function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'activation-payload-'));
    tmps.push(d);
    return d;
}
afterEach(() => {
    while (tmps.length > 0) fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
});

describe('percentile — nearest rank, and an empty sample is zero rather than NaN', () => {
    it('picks a real member of the sample', () => {
        // Index is `floor(q * (n - 1))` over the sorted sample, so p90 of five
        // members is the fourth, not the fifth. Pinned at the value the shipped
        // budget rows were derived from rather than at an idealised definition:
        // changing the convention would move every registered p90 silently.
        const xs = [5, 1, 4, 2, 3];
        expect(percentile(xs, 0.5)).toBe(3);
        expect(percentile(xs, 0.9)).toBe(4);
        expect(percentile(xs, 1)).toBe(5);
        expect(percentile(xs, 0)).toBe(1);
    });

    it('an empty sample is 0, never NaN — a NaN would render as a number', () => {
        expect(percentile([], 0.9)).toBe(0);
    });
});

describe('the activation reading is measured, or honestly unmeasured', () => {
    it('the real tree yields a per-slot distribution bounded by the cap', () => {
        const a = measureActivationPayload(REPO_ROOT, CAP_BYTES);
        expect(a.scope).toBe('activation-payload');
        expect(a.measured).toBe(true);
        expect(a.unmeasured_reason).toBeNull();
        expect(a.cap_bytes).toBe(CAP_BYTES);
        expect(a.corpus).toBe(ROUTING_MATRIX_REL);
        const slots = Object.fromEntries(a.slots.map((s) => [s.slot, s]));
        expect(Object.keys(slots).sort()).toStrictEqual([
            'pre_compact',
            'pre_tool_use',
            'user_prompt_submit',
        ]);
        const ups = slots['user_prompt_submit'];
        expect(ups, 'the shipped slot must actually sample fires').toBeDefined();
        expect((ups as { fires: number }).fires).toBeGreaterThan(0);
        // Ordering is a property of the statistic, not of this corpus, so it
        // holds at any HEAD — unlike the values, which are deliberately not
        // pinned here.
        expect((ups as { p50: number }).p50).toBeLessThanOrEqual((ups as { p90: number }).p90);
        expect((ups as { p90: number }).p90).toBeLessThanOrEqual((ups as { max: number }).max);
        // `selectForInjection` drops whole bodies to stay under the cap, so a
        // fire is truncated and never over-emitted.
        expect((ups as { max: number }).max).toBeLessThanOrEqual(CAP_BYTES);
        expect(slots['pre_compact']).toStrictEqual({
            slot: 'pre_compact',
            fires: 0,
            p50: 0,
            p90: 0,
            max: 0,
        });
    });

    it('a tree with no frozen corpus reports unmeasured, not an estimate', () => {
        const a = measureActivationPayload(tmpdir(), CAP_BYTES);
        expect(a.measured).toBe(false);
        expect(a.unmeasured_reason).toContain(ROUTING_MATRIX_REL);
        expect(a.slots).toStrictEqual([]);
        // The cap is still reported: it is a fact about the concern, not about
        // this tree, and withholding it would make the absence unreadable.
        expect(a.cap_bytes).toBe(CAP_BYTES);
    });

    it('a corpus shape the reader cannot parse is unmeasured, never under-counted', () => {
        // The sabotage direction. A single-quoted prompt is legal YAML this
        // hand parser skips; silently sampling the remainder would publish a
        // distribution over a subset while calling it the corpus.
        const root = tmpdir();
        const dir = path.join(root, ROUTING_MATRIX_REL);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'x.yaml'),
            "positives:\n  - prompt: 'single quoted'\n",
            'utf-8',
        );
        const a = measureActivationPayload(root, CAP_BYTES);
        expect(a.measured).toBe(false);
        expect(a.unmeasured_reason).toContain('under-counted');
        expect(a.slots).toStrictEqual([]);
    });

    it('renderActivation names the unit and the reason, and never a token count', () => {
        const measured = renderActivation(measureActivationPayload(REPO_ROOT, CAP_BYTES));
        expect(measured).toContain('activation payload');
        expect(measured).toContain('per trigger-match fire, BYTES');
        expect(measured).toContain('not gated');
        // No FIGURE in this section carries the other two numbers' unit. The
        // prose may say the word while explaining that they are not summed;
        // a number followed by `tok` would be the confusion itself.
        for (const line of measured.split('\n')) {
            if (/\d[\d,]*\s*tok\b/u.test(line)) {
                throw new Error(`activation line reports a token figure: ${line}`);
            }
        }
        const absent = renderActivation(measureActivationPayload(tmpdir(), CAP_BYTES));
        expect(absent).toContain('UNMEASURED');
        expect(absent).not.toMatch(/p50\s+\d/u);
    });
});

describe('three numbers, three labels — and the third moves neither of the other two', () => {
    it('the source verdict is byte-identical across a run that takes the activation reading', () => {
        const before = evaluate();
        const code = main([]);
        const after = evaluate();
        expect(after.measured).toBe(before.measured);
        expect(after.ceiling).toBe(before.ceiling);
        expect(after.buckets).toStrictEqual(before.buckets);
        expect(typeof code).toBe('number');
    });

    it('the JSON carries the three as separate fields and sums none of them', () => {
        const chunks: string[] = [];
        const spy = vi
            .spyOn(process.stdout, 'write')
            .mockImplementation((c: string | Uint8Array) => {
                chunks.push(typeof c === 'string' ? c : Buffer.from(c).toString('utf-8'));
                return true;
            });
        try {
            main(['--json']);
        } finally {
            spy.mockRestore();
        }
        const payload = JSON.parse(chunks.join('')) as {
            measurement_scope: string;
            source_corpus: { measured: number };
            host_payload: unknown;
            activation_payload: { scope: string; measured: boolean; cap_bytes: number };
        };
        // Distinct keys, so no caller can reach one while meaning another.
        expect(payload.activation_payload.scope).toBe('activation-payload');
        expect(payload.measurement_scope.split('+')).toContain('source-corpus');
        expect(payload.measurement_scope.split('+')).toContain('activation-payload');
        expect(payload.host_payload).toBeNull();
        // The gated total is the SOURCE reading and nothing else. If the fire
        // distribution were folded in, this equality breaks — which is the
        // failure this assertion exists to catch.
        expect(payload.source_corpus.measured).toBe(evaluate().measured);
    });
});

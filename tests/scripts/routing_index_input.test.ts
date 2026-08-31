/**
 * Step 6.5 of road-to-governed-harness-evolution — the index input set derives
 * from the 5.1 verdict file.
 *
 * > *Index the body only if 5.1 measured a signal. Otherwise description-only.*
 * > verify: **the indexer`s input set derives from the 5.1 verdict file.**
 *
 * THE OUTCOME IS NOT WHAT IS UNDER TEST. Today`s verdict is `harmful`, so
 * description-only is the right answer — and a resolver that returned
 * description-only unconditionally would produce that same right answer while
 * failing the verify completely. So every case below flips the FIXTURE and
 * asserts the resolved set follows it. The sabotage is the test.
 *
 * NO TRACKED FILE IS WRITTEN. The fixtures live in a temp directory and the
 * resolver is pointed at them, because a test that mutates
 * `agents/evidence/analysis/routing-body-signal-verdict.json` would corrupt the
 * artefact the run publishes.
 *
 * FAIL-CLOSED IS ASSERTED IN BOTH DIRECTIONS. A record that says `signal` but
 * has lost its `proxy_to_real_fidelity` bound must NOT widen the index: the
 * bound ships with the conclusion, and a provenance-stripped record is refused
 * rather than half-trusted.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import {
    DESCRIPTION_AND_BODY,
    DESCRIPTION_ONLY,
    resolveIndexArm,
    resolveIndexInput,
} from '../../src/scripts/_lib/routing_index_input.js';
import { measureDelivery } from '../../src/scripts/measure_delivery_sets.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-index-input-'));

afterAll(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
});

/** A verdict fixture on disk, returning its path. */
function fixture(name: string, body: unknown): string {
    const file = path.join(TMP, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(body, null, 2));
    return file;
}

const bound = { value: null, status: 'unmeasured-by-construction', reason: 'the 5.2 park' };

describe('6.5 — the input set follows the verdict token', () => {
    it('`signal` widens the index to the body', () => {
        const f = fixture('signal', {
            proxy_to_real_fidelity: bound,
            body_signal: { verdict: 'signal' },
        });
        const got = resolveIndexInput(REPO, f);
        expect(got.fields).toEqual([...DESCRIPTION_AND_BODY]);
        expect(got.indexesBody).toBe(true);
        expect(resolveIndexArm(REPO, f)).toBe('description+body');
    });

    it('every non-signal token resolves to description-only', () => {
        for (const token of ['harmful', 'null', 'underpowered', 'Signal', 'SIGNAL', '']) {
            const f = fixture(`t-${token || 'empty'}`, {
                proxy_to_real_fidelity: bound,
                body_signal: { verdict: token },
            });
            const got = resolveIndexInput(REPO, f);
            expect(got.fields).toEqual([...DESCRIPTION_ONLY]);
            expect(got.indexesBody).toBe(false);
            expect(got.verdict).toBe(token);
        }
    });
});

describe('6.5 — fail-closed, and only in the narrowing direction', () => {
    it('a missing verdict file narrows, it does not widen', () => {
        const got = resolveIndexInput(REPO, path.join(TMP, 'does-not-exist.json'));
        expect(got.fields).toEqual([...DESCRIPTION_ONLY]);
        expect(got.verdict).toBeNull();
        expect(got.reason).toContain('fail-closed');
    });

    it('unparseable JSON narrows', () => {
        const f = path.join(TMP, 'broken.json');
        fs.writeFileSync(f, '{ not json');
        expect(resolveIndexInput(REPO, f).fields).toEqual([...DESCRIPTION_ONLY]);
    });

    it('`signal` WITHOUT the fidelity bound is REFUSED, not honoured', () => {
        // The sharpest case: the token says widen, the provenance is gone.
        const f = fixture('stripped', { body_signal: { verdict: 'signal' } });
        const got = resolveIndexInput(REPO, f);
        expect(got.fields).toEqual([...DESCRIPTION_ONLY]);
        expect(got.indexesBody).toBe(false);
        expect(got.reason).toContain('proxy_to_real_fidelity');
    });

    it('a record with the bound but no verdict token narrows', () => {
        const f = fixture('no-token', { proxy_to_real_fidelity: bound, body_signal: {} });
        expect(resolveIndexInput(REPO, f).fields).toEqual([...DESCRIPTION_ONLY]);
    });
});

describe('6.5 — the real tree resolves to description-only, and it DERIVES it', () => {
    it('the committed 5.1 verdict is `harmful`, so the body is not indexed', () => {
        const got = resolveIndexInput(REPO);
        expect(got.verdict).toBe('harmful');
        expect(got.fields).toEqual([...DESCRIPTION_ONLY]);
        expect(got.indexesBody).toBe(false);
    });

    it('the consumer`s index set comes from the resolver, not from a literal', () => {
        // `measureDelivery` records the resolved input on its own result, so the
        // derivation is observable in the published record rather than asserted.
        const m = measureDelivery(REPO);
        expect(m.indexInput.fields).toEqual([...DESCRIPTION_ONLY]);
        expect(m.indexInput.reason).toContain('harmful');
    });
});
